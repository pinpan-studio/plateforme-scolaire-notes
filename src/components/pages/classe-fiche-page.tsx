"use client";

import { api } from "@/lib/api-client";
import { formatMoyenne } from "@/lib/format";
import { libelleInscription } from "@/lib/labels";
import { useApiData } from "@/components/data/use-api-data";
import { QueryGate } from "@/components/data/query-gate";
import { useSession } from "@/components/layout/session";
import { GraphiqueBarres, TableauDonnees } from "@/components/charts/analysis-charts";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";

export function ClasseFichePage({ classeId }: { classeId: string }) {
  const { anneeId } = useSession();
  const classe = useApiData(`classe-${classeId}`, () => api.classe(classeId));
  const stats = useApiData(`stats-classe-${classeId}-${anneeId ?? ""}`, () => api.moyennesMatieres({ anneeId, classeId }));
  const detail = classe.data;
  const points = (stats.data?.matieres ?? []).map((matiere) => ({
    libelle: matiere.nom,
    valeur: matiere.moyenne,
    effectif: matiere.effectif,
  }));

  return (
    <QueryGate loading={classe.loading} error={classe.error} onRetry={classe.retry} hasData={detail !== null}>
      {detail ? (
        <div className="space-y-8">
          <PageHeader
            titre={detail.nom}
            description={`${detail.niveau} · ${detail.annee} · ${detail.professeurPrincipal ?? "Sans professeur principal"}`}
            action={
              <a href={`/classes/${detail.id}/synthese`} className="text-sm font-medium text-primary">
                Synthèse
              </a>
            }
          />
          <section>
            <h2 className="mb-3 text-lg font-semibold">Élèves</h2>
            <DataTable
              lignes={detail.eleves}
              getId={(ligne) => ligne.id}
              texteRecherche={(ligne) => `${ligne.nom} ${ligne.prenom} ${ligne.matricule}`}
              hrefLigne={(ligne) => `/eleves/${ligne.id}`}
              singulier="élève"
              pluriel="élèves"
              titreVide="Aucun élève dans cette classe. Ajoutez le premier élève."
              colonnes={[
                { key: "matricule", entete: "Matricule", triable: true, valeurTri: (ligne) => ligne.matricule, cellule: (ligne) => ligne.matricule },
                { key: "nom", entete: "Nom", triable: true, valeurTri: (ligne) => ligne.nom, cellule: (ligne) => ligne.nom },
                { key: "prenom", entete: "Prénom", triable: true, valeurTri: (ligne) => ligne.prenom, cellule: (ligne) => ligne.prenom },
                { key: "statut", entete: "Statut", cellule: (ligne) => libelleInscription(ligne.statut) },
              ]}
            />
          </section>
          <section>
            <h2 className="text-lg font-semibold">Enseignants et matières</h2>
            {detail.enseignements.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Aucune affectation pour cette classe.</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="border-b border-border py-2 text-left">Enseignant</th>
                    <th scope="col" className="border-b border-border py-2 text-left">Matière</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.enseignements.map((ligne) => (
                    <tr key={`${ligne.enseignantId}-${ligne.matiereId}`}>
                      <td className="py-2">{ligne.enseignant}</td>
                      <td>{ligne.matiere}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section>
            <h2 className="text-lg font-semibold">Statistiques</h2>
            <QueryGate loading={stats.loading} error={stats.error} onRetry={stats.retry} hasData={stats.data !== null}>
              <GraphiqueBarres points={points} libelleValeur="Moyenne" />
              <TableauDonnees points={points} colonne="Moyenne" />
              <ul className="mt-3 text-sm text-muted">
                {(stats.data?.matieres ?? []).map((matiere) => (
                  <li key={matiere.matiereId}>
                    {matiere.nom} : {formatMoyenne(matiere.moyenne)}
                  </li>
                ))}
              </ul>
            </QueryGate>
          </section>
        </div>
      ) : null}
    </QueryGate>
  );
}
