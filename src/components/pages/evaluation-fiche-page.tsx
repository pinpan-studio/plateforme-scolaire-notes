"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, indexErreurs, messageEchecEnregistrement, messageUtilisateur, TEXTE_EVALUATION_DEJA_NOTEE } from "@/lib/api-client";
import type { EvaluationDetail, EvaluationEnvoi, TypeEvaluation } from "@/lib/api-client/types";
import { formatCoefficient, formatDate } from "@/lib/format";
import { libelleTypeEvaluation } from "@/lib/labels";
import { peutEcrire } from "@/lib/ui-permissions";
import { useApiData } from "@/components/data/use-api-data";
import { QueryGate } from "@/components/data/query-gate";
import { useSession } from "@/components/layout/session";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextField } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";

const ID_FIGEE = "evaluation-notes-figees";

type Formulaire = {
  libelle: string;
  classeId: string;
  matiereId: string;
  periodeId: string;
  type: TypeEvaluation;
  date: string;
  noteMax: string;
  coefficient: string;
};

function depuisEvaluation(evaluation: EvaluationDetail): Formulaire {
  return {
    libelle: evaluation.libelle,
    classeId: evaluation.classeId,
    matiereId: evaluation.matiereId,
    periodeId: evaluation.periodeId,
    type: evaluation.type,
    date: evaluation.date.slice(0, 10),
    noteMax: String(evaluation.noteMax),
    coefficient: String(evaluation.coefficient),
  };
}

function avecCourante(options: { value: string; label: string }[], value: string, label: string) {
  if (!value || options.some((option) => option.value === value)) {
    return options;
  }
  return [{ value, label }, ...options];
}

export function EvaluationFichePage({ evaluationId }: { evaluationId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { session } = useSession();
  const fiche = useApiData(`evaluation-${evaluationId}`, () => api.evaluation(evaluationId));
  const [confirmer, setConfirmer] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);
  const [erreurFormulaire, setErreurFormulaire] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null);
  const [formulaireId, setFormulaireId] = useState<string | null>(null);
  const verrou = useRef(false);
  const evaluation = fiche.data;
  const ecriture = peutEcrire(session.utilisateur.role, "evaluation");
  const anneeEvaluation = evaluation?.anneeScolaireId ?? null;

  const classes = useApiData(
    ecriture ? `classes-fiche-eval-${anneeEvaluation ?? "aucune"}` : "classes-fiche-eval-skip",
    () =>
      ecriture
        ? api.classes({ anneeId: anneeEvaluation, page: 1, pageSize: 100 })
        : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 }),
  );
  const matieres = useApiData(ecriture ? "matieres-fiche-eval" : "matieres-fiche-eval-skip", () =>
    ecriture ? api.matieres({ page: 1, pageSize: 100 }) : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 }),
  );
  const periodes = useApiData(ecriture ? `periodes-fiche-eval-${anneeEvaluation ?? "aucune"}` : "periodes-fiche-eval-skip", () =>
    ecriture ? api.periodes(anneeEvaluation) : Promise.resolve([]),
  );

  if (evaluation && formulaireId !== evaluation.id) {
    setFormulaireId(evaluation.id);
    setFormulaire(depuisEvaluation(evaluation));
    setErreurFormulaire(null);
    setErreurs({});
  }

  async function supprimer() {
    try {
      await api.supprimerEvaluation(evaluationId);
      router.push("/evaluations");
    } catch (error) {
      setErreurSuppression(messageUtilisateur(error, "Des notes sont déjà saisies. La suppression est impossible."));
      setConfirmer(false);
    }
  }

  async function enregistrer(event: FormEvent) {
    event.preventDefault();
    if (!evaluation || !formulaire || verrou.current) return;
    const suivants: Record<string, string> = {};
    if (!formulaire.libelle.trim()) suivants.libelle = "Indiquez un libellé.";
    if (!formulaire.classeId || !formulaire.matiereId) suivants.couple = "Choisissez une classe et une matière.";
    if (!formulaire.periodeId) suivants.periodeId = "Choisissez une période.";
    if (!formulaire.date) suivants.date = "Indiquez une date.";
    const noteMax = Number(formulaire.noteMax.replace(",", "."));
    const coefficient = Number(formulaire.coefficient.replace(",", "."));
    if (!(noteMax > 0)) suivants.noteMax = "Indiquez un nombre supérieur à 0.";
    if (!(coefficient > 0)) suivants.coefficient = "Indiquez un nombre supérieur à 0.";
    setErreurs(suivants);
    if (Object.keys(suivants).length > 0) {
      setErreurFormulaire(null);
      return;
    }
    const corps: EvaluationEnvoi = {
      libelle: formulaire.libelle.trim(),
      classeId: formulaire.classeId,
      matiereId: formulaire.matiereId,
      enseignantId: evaluation.enseignantId,
      periodeId: formulaire.periodeId,
      type: formulaire.type,
      date: formulaire.date,
      noteMax,
      coefficient,
    };
    verrou.current = true;
    setBusy(true);
    setErreurFormulaire(null);
    try {
      await api.modifierEvaluation(evaluation.id, corps);
      fiche.retry();
      toast("Évaluation enregistrée.");
    } catch (error) {
      const champs = indexErreurs(error);
      if (Object.keys(champs).length > 0) {
        setErreurs(champs);
      } else {
        setErreurFormulaire(messageEchecEnregistrement(error));
      }
    } finally {
      verrou.current = false;
      setBusy(false);
    }
  }

  const figee = (evaluation?.saisies ?? 0) > 0;
  const optionsClasses = avecCourante(
    (classes.data?.items ?? []).map((classe) => ({ value: classe.id, label: classe.nom })),
    evaluation?.classeId ?? "",
    evaluation?.classe ?? "",
  );
  const optionsMatieres = avecCourante(
    (matieres.data?.items ?? []).map((matiere) => ({ value: matiere.id, label: matiere.nom })),
    evaluation?.matiereId ?? "",
    evaluation?.matiere ?? "",
  );
  const optionsPeriodes = avecCourante(
    (periodes.data ?? []).map((periode) => ({ value: periode.id, label: periode.libelle })),
    evaluation?.periodeId ?? "",
    evaluation?.periode ?? "",
  );

  return (
    <QueryGate loading={fiche.loading} error={fiche.error} onRetry={fiche.retry} hasData={evaluation !== null}>
      {evaluation && formulaire ? (
        <div>
          <PageHeader
            titre={evaluation.libelle}
            description={`${evaluation.classe} · ${evaluation.matiere} · ${libelleTypeEvaluation(evaluation.type)} du ${formatDate(evaluation.date)}`}
            action={
              <a href={`/evaluations/${evaluation.id}/notes`} className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white">
                {ecriture ? "Saisir les notes" : "Consulter les notes"}
              </a>
            }
          />
          <dl className="grid max-w-xl gap-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted">Période</dt><dd>{evaluation.periode}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Enseignant</dt><dd>{evaluation.enseignant}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Note maximale</dt><dd>{formatCoefficient(evaluation.noteMax)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Coefficient</dt><dd>{formatCoefficient(evaluation.coefficient)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Avancement</dt><dd>{evaluation.saisies}/{evaluation.effectif}</dd></div>
          </dl>
          {erreurSuppression ? <div className="mt-4 max-w-xl"><Banner ton="danger">{erreurSuppression}</Banner></div> : null}
          {ecriture ? (
            <form className="mt-6 max-w-xl space-y-4" onSubmit={(event) => void enregistrer(event)}>
              <h2 className="text-lg font-semibold">{"Modifier l'évaluation"}</h2>
              {erreurFormulaire ? <Banner ton="danger">{erreurFormulaire}</Banner> : null}
              {figee ? (
                <Banner id={ID_FIGEE} ton="warning" tabIndex={0}>
                  {TEXTE_EVALUATION_DEJA_NOTEE}
                </Banner>
              ) : null}
              {erreurs.couple ? <Banner ton="danger">{erreurs.couple}</Banner> : null}
              <TextField
                id="libelle-eval-fiche"
                label="Libellé"
                obligatoire
                erreur={erreurs.libelle}
                value={formulaire.libelle}
                onChange={(event) => setFormulaire({ ...formulaire, libelle: event.target.value })}
              />
              <SelectField
                id="classe-eval-fiche"
                label="Classe"
                obligatoire
                disabled={figee}
                descriptionId={figee ? ID_FIGEE : undefined}
                value={formulaire.classeId}
                onChange={(event) => setFormulaire({ ...formulaire, classeId: event.target.value })}
              >
                <option value="">Choisir</option>
                {optionsClasses.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </SelectField>
              <SelectField
                id="matiere-eval-fiche"
                label="Matière"
                obligatoire
                disabled={figee}
                descriptionId={figee ? ID_FIGEE : undefined}
                value={formulaire.matiereId}
                onChange={(event) => setFormulaire({ ...formulaire, matiereId: event.target.value })}
              >
                <option value="">Choisir</option>
                {optionsMatieres.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </SelectField>
              <SelectField
                id="periode-eval-fiche"
                label="Période"
                obligatoire
                erreur={erreurs.periodeId}
                disabled={figee}
                descriptionId={figee ? ID_FIGEE : undefined}
                value={formulaire.periodeId}
                onChange={(event) => setFormulaire({ ...formulaire, periodeId: event.target.value })}
              >
                <option value="">Choisir</option>
                {optionsPeriodes.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </SelectField>
              <SelectField
                id="type-eval-fiche"
                label="Type"
                value={formulaire.type}
                onChange={(event) => setFormulaire({ ...formulaire, type: event.target.value as TypeEvaluation })}
              >
                <option value="DEVOIR">Devoir</option>
                <option value="INTERROGATION">Contrôle</option>
                <option value="COMPOSITION">Composition</option>
              </SelectField>
              <TextField
                id="date-eval-fiche"
                label="Date"
                type="date"
                obligatoire
                erreur={erreurs.date}
                value={formulaire.date}
                onChange={(event) => setFormulaire({ ...formulaire, date: event.target.value })}
              />
              <TextField
                id="max-eval-fiche"
                label="Note maximale"
                obligatoire
                erreur={erreurs.noteMax}
                disabled={figee}
                descriptionId={figee ? ID_FIGEE : undefined}
                value={formulaire.noteMax}
                onChange={(event) => setFormulaire({ ...formulaire, noteMax: event.target.value })}
              />
              <TextField
                id="coef-eval-fiche"
                label="Coefficient"
                obligatoire
                erreur={erreurs.coefficient}
                value={formulaire.coefficient}
                onChange={(event) => setFormulaire({ ...formulaire, coefficient: event.target.value })}
              />
              <Button type="submit" busy={busy}>
                Enregistrer
              </Button>
            </form>
          ) : null}
          {ecriture && evaluation.supprimable ? (
            <Button variant="danger" className="mt-6" onClick={() => setConfirmer(true)}>Supprimer</Button>
          ) : null}
          {ecriture && !evaluation.supprimable ? (
            <p className="mt-6 text-sm text-muted">{evaluation.motifSuppression ?? "Retirez les notes avant de supprimer l'évaluation."}</p>
          ) : null}
          <Dialog
            ouvert={confirmer}
            titre="Supprimer l'évaluation ?"
            description="Cette action retire l'évaluation."
            confirmerLabel="Supprimer"
            danger
            onAnnuler={() => setConfirmer(false)}
            onConfirmer={() => void supprimer()}
          />
        </div>
      ) : null}
    </QueryGate>
  );
}
