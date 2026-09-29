"use client";

import { api } from "@/lib/api-client";
import { formatDate, formatMoyenne } from "@/lib/format";
import { periodeCourante } from "@/lib/periode";
import { useApiData } from "@/components/data/use-api-data";
import { QueryGate } from "@/components/data/query-gate";
import { GraphiqueBarres, GraphiqueEvolution, TableauDonnees } from "@/components/charts/analysis-charts";
import { useSession } from "@/components/layout/session";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Banner } from "@/components/ui/banner";

export function DashboardPage() {
  const { session, anneeId } = useSession();
  const bord = useApiData(`tableau-${anneeId ?? ""}`, () => api.tableauDeBord(anneeId));
  const periodes = useApiData(`periodes-dash-${anneeId ?? ""}`, () => api.periodes(anneeId));
  const periode = periodeCourante(periodes.data ?? []);
  const distribution = useApiData(`distribution-${anneeId ?? ""}-${periode?.id ?? "annee"}`, () =>
    api.distribution({ anneeId, periodeId: periode?.id }),
  );
  const evolution = useApiData(`evolution-${anneeId ?? ""}`, () => api.evolution({ anneeId }));
  const role = session.utilisateur.role;
  const saisie = role === "ENSEIGNANT" || role === "PROFESSEUR_PRINCIPAL" || role === "ADMIN";

  const barres = (distribution.data?.tranches ?? []).map((tranche) => ({
    libelle: tranche.libelle,
    valeur: tranche.effectif,
    effectif: tranche.effectif,
  }));
  const courbe = (evolution.data?.points ?? []).map((point) => ({
    libelle: point.libelle,
    valeur: point.moyenne,
    effectif: point.effectif,
  }));

  return (
    <div>
      <PageHeader
        titre={`Bonjour ${session.utilisateur.prenom}`}
        description={session.etablissement.nom}
      />
      {bord.data?.alerteSansDirection ? (
        <div className="mb-4">
          <Banner ton="warning">Aucun utilisateur n&apos;a le rôle Direction.</Banner>
        </div>
      ) : null}
      <QueryGate loading={bord.loading} error={bord.error} onRetry={bord.retry} hasData={bord.data !== null}>
        {bord.data && bord.data.indicateurs.length === 0 ? (
          <EmptyState titre="Aucun indicateur pour cette année." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {bord.data?.indicateurs.map((indicateur) => (
              <li key={indicateur.id} className="rounded-lg border border-border bg-card p-4">
                <p className="text-3xl font-semibold">{indicateur.valeur}</p>
                <p className="mt-1 text-sm text-muted">{indicateur.libelle}</p>
                <a href={indicateur.href} className="mt-3 inline-block text-sm font-medium text-primary">
                  Ouvrir
                </a>
              </li>
            ))}
          </ul>
        )}
      </QueryGate>
      {saisie ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Évaluations sans notes complètes</h2>
          {bord.data && bord.data.evaluationsASaisir.length === 0 ? (
            <div className="mt-3">
              <EmptyState titre="Aucune évaluation en attente de saisie." />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
              {bord.data?.evaluationsASaisir.map((evaluation) => (
                <li key={evaluation.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span>
                    {evaluation.classe} · {evaluation.matiere} · {evaluation.libelle} · {formatDate(evaluation.date)} · {evaluation.saisies}/{evaluation.effectif}
                  </span>
                  <a href={`/evaluations/${evaluation.id}/notes`} className="font-medium text-primary">
                    Saisir
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      {bord.data && bord.data.affectations.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Affectations</h2>
          <ul className="mt-3 text-sm text-muted">
            {bord.data.affectations.map((affectation) => (
              <li key={affectation.id}>
                {affectation.classe} — {affectation.matiere}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {bord.data?.dernierEnregistrement ? (
        <p className="mt-4 text-sm text-muted">
          Dernier enregistrement : {bord.data.dernierEnregistrement.libelle} · {formatDate(bord.data.dernierEnregistrement.horodatage.slice(0, 10))}
        </p>
      ) : null}
      {typeof bord.data?.appreciationsManquantes === "number" ? (
        <p className="mt-4 text-sm">
          Appréciations de bulletin manquantes : {bord.data.appreciationsManquantes}.{" "}
          <a href="/synthese" className="font-medium text-primary">
            Ouvrir la synthèse
          </a>
        </p>
      ) : null}
      {bord.data && bord.data.classesEnDifficulte.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Classes les plus en difficulté</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {bord.data.classesEnDifficulte.map((classe) => (
              <li key={classe.classeId}>
                <a href={`/classes/${classe.classeId}`} className="text-primary">
                  {classe.nom}
                </a>{" "}
                · moyenne {formatMoyenne(classe.moyenne)}
              </li>
            ))}
          </ul>
          <a href="/analyses" className="mt-3 inline-block text-sm font-medium text-primary">
            Ouvrir les analyses
          </a>
        </section>
      ) : null}
      <section className="mt-8 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Distribution des moyennes</h2>
          <QueryGate loading={distribution.loading} error={distribution.error} onRetry={distribution.retry} hasData={distribution.data !== null}>
            <GraphiqueBarres points={barres} libelleValeur="Effectif" />
            <TableauDonnees points={barres} colonne="Effectif" />
          </QueryGate>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Évolution</h2>
          <QueryGate loading={evolution.loading} error={evolution.error} onRetry={evolution.retry} hasData={evolution.data !== null}>
            <GraphiqueEvolution points={courbe} />
            <TableauDonnees points={courbe} colonne="Moyenne" />
          </QueryGate>
        </div>
      </section>
    </div>
  );
}
