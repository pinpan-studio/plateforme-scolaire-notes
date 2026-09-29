"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { formatMoyenne } from "@/lib/format";
import { useApiData } from "@/components/data/use-api-data";
import { QueryGate } from "@/components/data/query-gate";
import { useSession } from "@/components/layout/session";
import { GraphiqueBarres, GraphiqueEvolution, TableauDonnees } from "@/components/charts/analysis-charts";
import { FiltreSelect } from "@/components/ui/filtre-select";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export function AnalysesPage() {
  const { anneeId } = useSession();
  const [classeId, setClasseId] = useState("");
  const [matiereId, setMatiereId] = useState("");
  const [periodeId, setPeriodeId] = useState("");
  const classes = useApiData(`classes-an-${anneeId ?? ""}`, () => api.classes({ anneeId, page: 1, pageSize: 100 }));
  const matieres = useApiData("matieres-an", () => api.matieres({ page: 1, pageSize: 100 }));
  const periodes = useApiData(`periodes-an-${anneeId ?? ""}`, () => api.periodes(anneeId));
  const filtres = { anneeId, classeId: classeId || undefined, matiereId: matiereId || undefined, periodeId: periodeId || undefined };
  const cle = JSON.stringify(filtres);
  const distribution = useApiData(`dist-${cle}`, () => api.distribution(filtres));
  const moyennes = useApiData(`moy-${cle}`, () => api.moyennesMatieres(filtres));
  const evolution = useApiData(`evo-${anneeId ?? ""}-${classeId}`, () => api.evolution({ anneeId, classeId: classeId || undefined }));
  const sousSeuil = useApiData(`seuil-${cle}`, () => api.sousSeuil({ ...filtres, seuil: 10 }));

  const barresDistribution = (distribution.data?.tranches ?? []).map((tranche) => ({
    libelle: tranche.libelle,
    valeur: tranche.effectif,
    effectif: tranche.effectif,
  }));
  const barresMatieres = (moyennes.data?.matieres ?? []).map((matiere) => ({
    libelle: matiere.nom,
    valeur: matiere.moyenne,
    effectif: matiere.effectif,
  }));
  const courbe = (evolution.data?.points ?? []).map((point) => ({
    libelle: point.libelle,
    valeur: point.moyenne,
    effectif: point.effectif,
  }));

  return (
    <div className="space-y-8">
      <PageHeader titre="Analyses" description="Distributions, moyennes et élèves sous 10/20." />
      <div className="flex flex-wrap gap-3">
        <FiltreSelect id="periode-analyses" label="Période" value={periodeId} onChange={setPeriodeId} options={(periodes.data ?? []).map((periode) => ({ value: periode.id, label: periode.libelle }))} tousLabel="Année entière" />
        <FiltreSelect id="classe-analyses" label="Classe" value={classeId} onChange={setClasseId} options={(classes.data?.items ?? []).map((classe) => ({ value: classe.id, label: classe.nom }))} />
        <FiltreSelect id="matiere-analyses" label="Matière" value={matiereId} onChange={setMatiereId} options={(matieres.data?.items ?? []).map((matiere) => ({ value: matiere.id, label: matiere.nom }))} />
      </div>
      {(classeId || matiereId || periodeId) ? (
        <button type="button" className="text-sm font-medium text-primary" onClick={() => { setClasseId(""); setMatiereId(""); setPeriodeId(""); }}>
          Réinitialiser les filtres
        </button>
      ) : null}
      <section>
        <h2 className="text-lg font-semibold">Distribution des moyennes générales</h2>
        <QueryGate loading={distribution.loading} error={distribution.error} onRetry={distribution.retry} hasData={distribution.data !== null}>
          <GraphiqueBarres points={barresDistribution} libelleValeur="Effectif" />
          <TableauDonnees points={barresDistribution} colonne="Effectif" />
        </QueryGate>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Moyenne par matière</h2>
        <QueryGate loading={moyennes.loading} error={moyennes.error} onRetry={moyennes.retry} hasData={moyennes.data !== null}>
          <GraphiqueBarres points={barresMatieres} libelleValeur="Moyenne" />
          <TableauDonnees points={barresMatieres} colonne="Moyenne" />
        </QueryGate>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Évolution</h2>
        <QueryGate loading={evolution.loading} error={evolution.error} onRetry={evolution.retry} hasData={evolution.data !== null}>
          <GraphiqueEvolution points={courbe} />
          <TableauDonnees points={courbe} colonne="Moyenne" />
        </QueryGate>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Élèves sous 10/20</h2>
        <QueryGate loading={sousSeuil.loading} error={sousSeuil.error} onRetry={sousSeuil.retry} hasData={sousSeuil.data !== null}>
          {sousSeuil.data && sousSeuil.data.eleves.length === 0 ? (
            <EmptyState titre="Aucun élève sous 10/20 pour cette sélection." />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted">Effectif : {sousSeuil.data?.effectif ?? 0}</p>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="border-b border-border py-1 text-left">Élève</th>
                    <th scope="col" className="border-b border-border py-1 text-left">Classe</th>
                    <th scope="col" className="border-b border-border py-1 text-left">Moyenne</th>
                  </tr>
                </thead>
                <tbody>
                  {sousSeuil.data?.eleves.map((eleve) => (
                    <tr key={eleve.eleveId}>
                      <th scope="row" className="py-1 text-left font-normal">
                        <a href={`/eleves/${eleve.eleveId}`} className="text-primary">{eleve.nom} {eleve.prenom}</a>
                      </th>
                      <td>{eleve.classe}</td>
                      <td>{formatMoyenne(eleve.moyenne)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </QueryGate>
      </section>
    </div>
  );
}
