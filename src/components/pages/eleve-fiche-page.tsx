"use client";

import { useRef, useState } from "react";
import { api, messageEchecEnregistrement } from "@/lib/api-client";
import { formatCoefficient, formatDate, formatMoyenne, formatRang } from "@/lib/format";
import { libelleInscription, libelleSexe, libelleTypeEvaluation } from "@/lib/labels";
import { peutEcrire } from "@/lib/ui-permissions";
import { useApiData } from "@/components/data/use-api-data";
import { QueryGate } from "@/components/data/query-gate";
import { useSession } from "@/components/layout/session";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";

export function EleveFichePage({ eleveId }: { eleveId: string }) {
  const { anneeId, session } = useSession();
  const toast = useToast();
  const ecriture = peutEcrire(session.utilisateur.role, "eleve");
  const fiche = useApiData(`eleve-${eleveId}-${anneeId ?? ""}`, () => api.eleve(eleveId, anneeId));
  const classes = useApiData(
    ecriture ? `classes-eleve-${anneeId ?? ""}` : "classes-eleve-skip",
    () =>
      ecriture
        ? api.classes({ anneeId, page: 1, pageSize: 100 })
        : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 }),
  );
  const eleve = fiche.data;
  const contexte = `${eleveId}:${anneeId ?? ""}`;
  const [contexteFormulaire, setContexteFormulaire] = useState<string | null>(null);
  const [classeId, setClasseId] = useState("");
  const [erreurChamp, setErreurChamp] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const verrou = useRef(false);

  if (eleve && contexteFormulaire !== contexte) {
    setContexteFormulaire(contexte);
    setClasseId(eleve.inscription?.classeId ?? "");
    setErreur(null);
    setErreurChamp(null);
  }

  async function enregistrerClasse() {
    if (!eleve || verrou.current) return;
    if (!classeId) {
      setErreurChamp("Choisissez une classe.");
      setErreur(null);
      return;
    }
    if (classeId === (eleve.inscription?.classeId ?? "")) {
      setErreur(null);
      setErreurChamp(null);
      return;
    }
    verrou.current = true;
    setBusy(true);
    setErreur(null);
    setErreurChamp(null);
    try {
      await api.modifierEleve(eleve.id, { classeId });
      fiche.retry();
      toast("Classe enregistrée.");
    } catch (error) {
      setErreur(messageEchecEnregistrement(error));
    } finally {
      verrou.current = false;
      setBusy(false);
    }
  }

  const optionsClasses = (classes.data?.items ?? []).map((classe) => ({ value: classe.id, label: classe.nom }));
  if (eleve?.inscription && !optionsClasses.some((option) => option.value === eleve.inscription?.classeId)) {
    optionsClasses.unshift({ value: eleve.inscription.classeId, label: eleve.inscription.classeNom });
  }

  return (
    <QueryGate loading={fiche.loading} error={fiche.error} onRetry={fiche.retry} hasData={eleve !== null}>
      {eleve ? (
        <div>
          <PageHeader titre={`${eleve.nom} ${eleve.prenom}`} description={eleve.matricule} />
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-lg font-semibold">Identité</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted">Matricule</dt><dd>{eleve.matricule}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Classe</dt><dd>{eleve.inscription?.classeNom ?? "—"}</dd></div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Statut</dt>
                  <dd>{eleve.inscription ? <Badge>{libelleInscription(eleve.inscription.statut)}</Badge> : "—"}</dd>
                </div>
                {eleve.dateNaissance ? (
                  <div className="flex justify-between gap-4"><dt className="text-muted">Date de naissance</dt><dd>{formatDate(eleve.dateNaissance)}</dd></div>
                ) : null}
                {eleve.sexe ? (
                  <div className="flex justify-between gap-4"><dt className="text-muted">Sexe</dt><dd>{libelleSexe(eleve.sexe)}</dd></div>
                ) : null}
              </dl>
              {ecriture ? (
                <form
                  className="mt-4 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void enregistrerClasse();
                  }}
                >
                  <h3 className="text-base font-semibold">Changer de classe</h3>
                  {erreur ? <Banner ton="danger">{erreur}</Banner> : null}
                  <SelectField
                    id="classe-eleve"
                    label="Classe"
                    obligatoire
                    erreur={erreurChamp ?? undefined}
                    value={classeId}
                    onChange={(event) => setClasseId(event.target.value)}
                  >
                    <option value="">Choisir</option>
                    {optionsClasses.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectField>
                  <Button type="submit" busy={busy}>
                    Enregistrer
                  </Button>
                </form>
              ) : null}
            </section>
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-lg font-semibold">Résultats</h2>
              {eleve.resultats ? (
                <>
                  <p className="mt-3 text-sm">
                    Moyenne générale {formatMoyenne(eleve.resultats.moyenneGenerale)} · {formatRang(eleve.resultats.rang, eleve.resultats.effectif)} · {eleve.resultats.appreciation}
                  </p>
                  {eleve.resultats.matieresSansNote > 0 ? (
                    <p className="mt-1 text-sm text-muted">{eleve.resultats.matieresSansNote} matières sans note, non comptées.</p>
                  ) : null}
                  <table className="mt-3 w-full text-sm">
                    <thead>
                      <tr>
                        <th scope="col" className="border-b border-border py-1 text-left">Matière</th>
                        <th scope="col" className="border-b border-border py-1 text-left">Moyenne</th>
                        <th scope="col" className="border-b border-border py-1 text-left">Appréciation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eleve.resultats.matieres.map((matiere) => (
                        <tr key={matiere.matiereId}>
                          <th scope="row" className="py-1 text-left font-normal">{matiere.nom} (coef. {formatCoefficient(matiere.coefficient)})</th>
                          <td>{formatMoyenne(matiere.moyenne)}</td>
                          <td>{matiere.appreciation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted">Aucun résultat pour cette année.</p>
              )}
            </section>
          </div>
          <section className="mt-6">
            <h2 className="text-lg font-semibold">Historique des notes</h2>
            {eleve.historique.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Aucune note enregistrée.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th scope="col" className="border-b border-border px-3 py-2 text-left">Date</th>
                      <th scope="col" className="border-b border-border px-3 py-2 text-left">Matière</th>
                      <th scope="col" className="border-b border-border px-3 py-2 text-left">Évaluation</th>
                      <th scope="col" className="border-b border-border px-3 py-2 text-left">Note</th>
                      <th scope="col" className="border-b border-border px-3 py-2 text-left">Commentaire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eleve.historique.map((note) => (
                      <tr key={note.evaluationId} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-2">{formatDate(note.date)}</td>
                        <td className="px-3 py-2">{note.matiere}</td>
                        <td className="px-3 py-2">{libelleTypeEvaluation(note.type)} · {note.libelle}</td>
                        <td className="px-3 py-2">{note.absent ? "Abs." : formatMoyenne(note.valeur)}</td>
                        <td className="px-3 py-2">{note.commentaire ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </QueryGate>
  );
}
