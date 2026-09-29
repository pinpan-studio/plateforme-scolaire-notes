"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, indexErreurs, messageUtilisateur } from "@/lib/api-client";
import type { EvaluationEnvoi, TypeEvaluation } from "@/lib/api-client/types";
import { formatCoefficient, formatDate } from "@/lib/format";
import { libelleTypeEvaluation } from "@/lib/labels";
import { peutEcrire } from "@/lib/ui-permissions";
import { useApiData } from "@/components/data/use-api-data";
import { useListe } from "@/components/data/use-liste";
import { QueryGate } from "@/components/data/query-gate";
import { useSession } from "@/components/layout/session";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { FiltreSelect } from "@/components/ui/filtre-select";
import { SelectField, TextField } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";

export function EvaluationsPage() {
  const paramsUrl = useSearchParams();
  const saisie = paramsUrl.get("vue") === "saisie";
  const { anneeId, session } = useSession();
  const toast = useToast();
  const ecriture = peutEcrire(session.utilisateur.role, "evaluation");
  const [classeId, setClasseId] = useState("");
  const [matiereId, setMatiereId] = useState("");
  const [periodeId, setPeriodeId] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [formulaire, setFormulaire] = useState({
    libelle: "",
    classeId: "",
    matiereId: "",
    enseignantId: "",
    periodeId: "",
    type: "DEVOIR" as TypeEvaluation,
    date: "",
    noteMax: "20",
    coefficient: "1",
  });
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const liste = useListe(anneeId, {
    classeId: classeId || undefined,
    matiereId: matiereId || undefined,
    periodeId: periodeId || undefined,
  });
  const evaluations = useApiData(liste.cle, () => api.evaluations(liste.params));
  const classes = useApiData(`classes-eval-${anneeId ?? ""}`, () => api.classes({ anneeId, page: 1, pageSize: 100 }));
  const matieres = useApiData("matieres-eval", () => api.matieres({ page: 1, pageSize: 100 }));
  const periodes = useApiData(`periodes-eval-${anneeId ?? ""}`, () => api.periodes(anneeId));
  const affectations = useApiData(
    `affect-${formulaire.classeId}-${formulaire.matiereId}-${anneeId ?? ""}`,
    () => api.affectations({ anneeId, classeId: formulaire.classeId || undefined, matiereId: formulaire.matiereId || undefined, page: 1, pageSize: 100 }),
  );
  const optionsClasses = (classes.data?.items ?? []).map((classe) => ({ value: classe.id, label: classe.nom }));
  const optionsMatieres = (matieres.data?.items ?? []).map((matiere) => ({ value: matiere.id, label: matiere.nom }));
  const optionsPeriodes = (periodes.data ?? []).map((periode) => ({ value: periode.id, label: periode.libelle }));

  async function enregistrer() {
    const suivants: Record<string, string> = {};
    if (!formulaire.libelle.trim()) suivants.libelle = "Indiquez un libellé.";
    if (!formulaire.classeId || !formulaire.matiereId) suivants.couple = "Choisissez une classe et une matière.";
    if (!formulaire.enseignantId) suivants.enseignantId = "Choisissez un enseignant affecté à cette classe et cette matière.";
    if (!formulaire.periodeId) suivants.periodeId = "Choisissez une période.";
    if (!formulaire.date) suivants.date = "Indiquez une date.";
    const noteMax = Number(formulaire.noteMax.replace(",", "."));
    const coefficient = Number(formulaire.coefficient.replace(",", "."));
    if (!(noteMax > 0)) suivants.noteMax = "Indiquez un nombre supérieur à 0.";
    if (!(coefficient > 0)) suivants.coefficient = "Indiquez un nombre supérieur à 0.";
    setErreurs(suivants);
    if (Object.keys(suivants).length > 0) return;
    const corps: EvaluationEnvoi = {
      libelle: formulaire.libelle.trim(),
      classeId: formulaire.classeId,
      matiereId: formulaire.matiereId,
      enseignantId: formulaire.enseignantId,
      periodeId: formulaire.periodeId,
      type: formulaire.type,
      date: formulaire.date,
      noteMax,
      coefficient,
    };
    setBusy(true);
    try {
      await api.creerEvaluation(corps);
      setOuvert(false);
      evaluations.retry();
      toast("Évaluation enregistrée.");
    } catch (error) {
      const champs = indexErreurs(error);
      setErreurs(Object.keys(champs).length > 0 ? champs : { formulaire: messageUtilisateur(error, "Impossible d'enregistrer l'évaluation.") });
    } finally {
      setBusy(false);
    }
  }

  const pastilles = [
    ...(optionsClasses.find((option) => option.value === classeId)
      ? [{ id: "classe", label: "Classe", valeur: optionsClasses.find((option) => option.value === classeId)!.label, onRetirer: () => setClasseId("") }]
      : []),
    ...(optionsMatieres.find((option) => option.value === matiereId)
      ? [{ id: "matiere", label: "Matière", valeur: optionsMatieres.find((option) => option.value === matiereId)!.label, onRetirer: () => setMatiereId("") }]
      : []),
    ...(optionsPeriodes.find((option) => option.value === periodeId)
      ? [{ id: "periode", label: "Période", valeur: optionsPeriodes.find((option) => option.value === periodeId)!.label, onRetirer: () => setPeriodeId("") }]
      : []),
  ];

  return (
    <div>
      <PageHeader
        titre={saisie ? "Saisie des notes" : "Évaluations"}
        description={saisie ? "Choisissez une évaluation pour ouvrir la grille." : undefined}
        action={ecriture && !saisie ? <Button onClick={() => setOuvert(true)}>Ajouter une évaluation</Button> : undefined}
      />
      <QueryGate loading={evaluations.loading} error={evaluations.error} onRetry={evaluations.retry} hasData={evaluations.data !== null}>
        <DataTable
          mode="externe"
          lignes={evaluations.data?.items ?? []}
          total={evaluations.data?.total ?? 0}
          page={liste.page}
          onPage={liste.setPage}
          recherche={liste.recherche}
          onRecherche={liste.setRecherche}
          tri={liste.tri}
          onTri={liste.changerTri}
          getId={(ligne) => ligne.id}
          texteRecherche={(ligne) => `${ligne.matiere} ${ligne.classe} ${ligne.libelle}`}
          hrefLigne={(ligne) => (saisie ? `/evaluations/${ligne.id}/notes` : `/evaluations/${ligne.id}`)}
          singulier="évaluation"
          pluriel="évaluations"
          titreVide="Aucune évaluation."
          pastilles={pastilles}
          onReinitialiserFiltres={pastilles.length > 0 ? () => { setClasseId(""); setMatiereId(""); setPeriodeId(""); } : undefined}
          filtres={
            <>
              <FiltreSelect id="filtre-classe-eval" label="Classe" value={classeId} onChange={setClasseId} options={optionsClasses} />
              <FiltreSelect id="filtre-matiere-eval" label="Matière" value={matiereId} onChange={setMatiereId} options={optionsMatieres} />
              <FiltreSelect id="filtre-periode-eval" label="Période" value={periodeId} onChange={setPeriodeId} options={optionsPeriodes} />
            </>
          }
          colonnes={[
            { key: "date", entete: "Date", triable: true, cellule: (ligne) => formatDate(ligne.date) },
            { key: "type", entete: "Type", cellule: (ligne) => libelleTypeEvaluation(ligne.type) },
            { key: "matiere", entete: "Matière", triable: true, cellule: (ligne) => ligne.matiere },
            { key: "classe", entete: "Classe", triable: true, cellule: (ligne) => ligne.classe },
            { key: "periode", entete: "Période", cellule: (ligne) => ligne.periode },
            { key: "noteMax", entete: "Note max", cellule: (ligne) => formatCoefficient(ligne.noteMax) },
            { key: "coefficient", entete: "Coefficient", cellule: (ligne) => formatCoefficient(ligne.coefficient) },
            { key: "avancement", entete: "Avancement", cellule: (ligne) => `${ligne.saisies}/${ligne.effectif}` },
          ]}
        />
      </QueryGate>
      <Drawer ouvert={ouvert} titre="Ajouter une évaluation" onFermer={() => setOuvert(false)} onSubmit={() => void enregistrer()} busy={busy} erreurs={Object.values(erreurs)}>
        <TextField id="libelle-eval" label="Libellé" obligatoire erreur={erreurs.libelle} value={formulaire.libelle} onChange={(event) => setFormulaire({ ...formulaire, libelle: event.target.value })} />
        <SelectField id="classe-eval" label="Classe" obligatoire value={formulaire.classeId} onChange={(event) => setFormulaire({ ...formulaire, classeId: event.target.value, enseignantId: "" })}>
          <option value="">Choisir</option>
          {optionsClasses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </SelectField>
        <SelectField id="matiere-eval" label="Matière" obligatoire value={formulaire.matiereId} onChange={(event) => setFormulaire({ ...formulaire, matiereId: event.target.value, enseignantId: "" })}>
          <option value="">Choisir</option>
          {optionsMatieres.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </SelectField>
        <SelectField id="enseignant-eval" label="Enseignant" obligatoire erreur={erreurs.enseignantId} value={formulaire.enseignantId} onChange={(event) => setFormulaire({ ...formulaire, enseignantId: event.target.value })}>
          <option value="">Choisir</option>
          {(affectations.data?.items ?? []).map((affectation) => (
            <option key={affectation.id} value={affectation.enseignantId}>{affectation.enseignant}</option>
          ))}
        </SelectField>
        <SelectField id="periode-eval" label="Période" obligatoire erreur={erreurs.periodeId} value={formulaire.periodeId} onChange={(event) => setFormulaire({ ...formulaire, periodeId: event.target.value })}>
          <option value="">Choisir</option>
          {optionsPeriodes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </SelectField>
        <SelectField id="type-eval" label="Type" value={formulaire.type} onChange={(event) => setFormulaire({ ...formulaire, type: event.target.value as TypeEvaluation })}>
          <option value="DEVOIR">Devoir</option>
          <option value="INTERROGATION">Contrôle</option>
          <option value="COMPOSITION">Composition</option>
        </SelectField>
        <TextField id="date-eval" label="Date" type="date" obligatoire erreur={erreurs.date} value={formulaire.date} onChange={(event) => setFormulaire({ ...formulaire, date: event.target.value })} />
        <TextField id="max-eval" label="Note maximale" obligatoire erreur={erreurs.noteMax} value={formulaire.noteMax} onChange={(event) => setFormulaire({ ...formulaire, noteMax: event.target.value })} />
        <TextField id="coef-eval" label="Coefficient" obligatoire erreur={erreurs.coefficient} value={formulaire.coefficient} onChange={(event) => setFormulaire({ ...formulaire, coefficient: event.target.value })} />
      </Drawer>
    </div>
  );
}
