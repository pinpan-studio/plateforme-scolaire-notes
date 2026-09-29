"use client";

import { useState } from "react";
import { api, messageUtilisateur } from "@/lib/api-client";
import { formatCoefficient, formatMoyenne, formatRang } from "@/lib/format";
import { useApiData } from "@/components/data/use-api-data";
import { QueryGate } from "@/components/data/query-gate";
import { useSession } from "@/components/layout/session";
import { GraphiqueEvolution, TableauDonnees } from "@/components/charts/analysis-charts";
import { AideMoyenne } from "@/components/help/aide-moyenne";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { FiltreSelect } from "@/components/ui/filtre-select";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TextAreaField } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";

export function ResultatsPage() {
  const { anneeId } = useSession();
  const toast = useToast();
  const [classeId, setClasseId] = useState("");
  const [periodeId, setPeriodeId] = useState("");
  const [eleveId, setEleveId] = useState("");
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const classes = useApiData(`classes-res-${anneeId ?? ""}`, () => api.classes({ anneeId, page: 1, pageSize: 100 }));
  const periodes = useApiData(`periodes-res-${anneeId ?? ""}`, () => api.periodes(anneeId));
  const resultats = useApiData(
    classeId ? `resultats-${classeId}-${periodeId}-${anneeId ?? ""}` : "resultats-attente",
    () => (classeId ? api.resultats({ anneeId, classeId, periodeId: periodeId || undefined }) : Promise.resolve(null)),
  );
  const optionsClasses = (classes.data?.items ?? []).map((classe) => ({ value: classe.id, label: classe.nom }));
  const optionsPeriodes = (periodes.data ?? []).map((periode) => ({ value: periode.id, label: periode.libelle }));
  const ligne = resultats.data?.lignes.find((item) => item.eleveId === eleveId) ?? null;
  const courbe = (ligne?.evolution ?? resultats.data?.evolutionClasse ?? []).map((point) => ({
    libelle: point.libelle,
    valeur: point.moyenne,
    effectif: "effectif" in point && typeof point.effectif === "number" ? point.effectif : 0,
  }));

  async function enregistrerAppreciation() {
    if (!ligne || !periodeId) return;
    setErreur(null);
    try {
      await api.enregistrerAppreciation({ eleveId: ligne.eleveId, periodeId, texte });
      toast("Appréciation enregistrée.");
      resultats.retry();
    } catch (error) {
      setErreur(messageUtilisateur(error, "Impossible d'enregistrer l'appréciation."));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader titre="Résultats" description="Moyennes, classement, matières et évolution." />
      <AideMoyenne />
      <div className="flex flex-wrap gap-3">
        <FiltreSelect id="classe-resultats" label="Classe" value={classeId} onChange={(valeur) => { setClasseId(valeur); setEleveId(""); }} options={optionsClasses} tousLabel="Choisir" />
        <FiltreSelect id="periode-resultats" label="Période" value={periodeId} onChange={setPeriodeId} options={optionsPeriodes} tousLabel="Année entière" />
      </div>
      {!classeId ? <EmptyState titre="Choisissez une classe pour afficher les résultats." /> : null}
      {classeId ? (
        <QueryGate loading={resultats.loading} error={resultats.error} onRetry={resultats.retry} hasData={resultats.data !== null}>
          {resultats.data && resultats.data.lignes.length === 0 ? (
            <EmptyState titre="Aucun élève classé pour cette sélection." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="border-b border-border px-3 py-2 text-left">Élève</th>
                    <th scope="col" className="border-b border-border px-3 py-2 text-left">Moyenne</th>
                    <th scope="col" className="border-b border-border px-3 py-2 text-left">Rang</th>
                    <th scope="col" className="border-b border-border px-3 py-2 text-left">Appréciation</th>
                    <th scope="col" className="border-b border-border px-3 py-2 text-left"><span className="sr-only">Détail</span></th>
                  </tr>
                </thead>
                <tbody>
                  {resultats.data?.lignes.map((item) => (
                    <tr key={item.eleveId} className="border-b border-border last:border-b-0">
                      <th scope="row" className="px-3 py-2 text-left font-medium">{item.nom} {item.prenom}</th>
                      <td className="px-3 py-2">{formatMoyenne(item.moyenneGenerale)}</td>
                      <td className="px-3 py-2">{formatRang(item.rang, item.effectif)}</td>
                      <td className="px-3 py-2">{item.appreciation}</td>
                      <td className="px-3 py-2">
                        <button type="button" className="font-medium text-primary" onClick={() => { setEleveId(item.eleveId); setTexte(item.appreciationGenerale ?? ""); }}>
                          Ouvrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {ligne ? (
            <section className="space-y-4 rounded-lg border border-border bg-card p-4">
              <h2 className="text-lg font-semibold">{ligne.nom} {ligne.prenom}</h2>
              <p className="text-sm">
                Moyenne {formatMoyenne(ligne.moyenneGenerale)} · {formatRang(ligne.rang, ligne.effectif)} · {ligne.appreciation}
              </p>
              {ligne.matieresSansNote > 0 ? (
                <p className="text-sm text-muted">{ligne.matieresSansNote} matières sans note, non comptées.</p>
              ) : null}
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="border-b border-border py-1 text-left">Matière</th>
                    <th scope="col" className="border-b border-border py-1 text-left">Coefficient</th>
                    <th scope="col" className="border-b border-border py-1 text-left">Moyenne</th>
                    <th scope="col" className="border-b border-border py-1 text-left">Rang</th>
                    <th scope="col" className="border-b border-border py-1 text-left">Appréciation</th>
                  </tr>
                </thead>
                <tbody>
                  {ligne.matieres.map((matiere) => (
                    <tr key={matiere.matiereId}>
                      <th scope="row" className="py-1 text-left font-normal">{matiere.nom}</th>
                      <td>{formatCoefficient(matiere.coefficient)}</td>
                      <td>{formatMoyenne(matiere.moyenne)}</td>
                      <td>{formatRang(matiere.rang, ligne.effectif)}</td>
                      <td>{matiere.appreciation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div>
                <h3 className="text-base font-semibold">Évolution</h3>
                <GraphiqueEvolution points={courbe} />
                <TableauDonnees points={courbe} colonne="Moyenne" />
              </div>
              <div>
                <h3 className="mb-2 text-base font-semibold">Appréciation générale</h3>
                {resultats.data?.peutRedigerAppreciation && periodeId ? (
                  <>
                    <TextAreaField id="appreciation" label="Appréciation générale" value={texte} onChange={(event) => setTexte(event.target.value)} />
                    {erreur ? <div className="mt-2"><Banner ton="danger">{erreur}</Banner></div> : null}
                    <Button className="mt-3" onClick={() => void enregistrerAppreciation()}>Enregistrer</Button>
                  </>
                ) : (
                  <p className="text-sm">{ligne.appreciationGenerale || "Aucune appréciation générale."}</p>
                )}
              </div>
            </section>
          ) : null}
        </QueryGate>
      ) : null}
    </div>
  );
}
