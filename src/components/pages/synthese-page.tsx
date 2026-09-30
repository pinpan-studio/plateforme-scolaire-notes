"use client";

import { useState } from "react";
import Link from "next/link";
import { api, messageUtilisateur } from "@/lib/api-client";
import { formatCoefficient, formatMoyenne, formatRang } from "@/lib/format";
import { useApiData } from "@/components/data/use-api-data";
import { QueryGate } from "@/components/data/query-gate";
import { useSession } from "@/components/layout/session";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FiltreSelect } from "@/components/ui/filtre-select";
import { PageHeader } from "@/components/ui/page-header";
import { TextAreaField } from "@/components/ui/fields";

export function SynthesePage({ classeInitiale }: { classeInitiale?: string }) {
  const { anneeId, session } = useSession();
  const [classeId, setClasseId] = useState(classeInitiale ?? "");
  const [periodeId, setPeriodeId] = useState("");
  const [eleveId, setEleveId] = useState("");
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const classes = useApiData(`classes-syn-${anneeId ?? ""}`, () => api.classes({ anneeId, page: 1, pageSize: 100 }));
  const periodes = useApiData(`periodes-syn-${anneeId ?? ""}`, () => api.periodes(anneeId));
  const synthese = useApiData(classeId ? `syn-${classeId}-${periodeId}` : "syn-vide", () =>
    classeId ? api.synthese(classeId, anneeId, periodeId || undefined) : Promise.resolve(null),
  );
  const roles = ["ADMIN", "DIRECTION", "PROFESSEUR_PRINCIPAL", "CONSULTATION"] as const;
  if (!roles.includes(session.utilisateur.role as (typeof roles)[number])) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Accès refusé</h1>
        <p className="mt-2 text-sm">Cette action n&apos;est pas disponible pour votre rôle.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-primary">Retour au tableau de bord</Link>
      </div>
    );
  }

  async function enregistrer() {
    if (!eleveId || !periodeId) return;
    try {
      await api.enregistrerAppreciation({ eleveId, periodeId, texte });
      setErreur(null);
      synthese.retry();
    } catch (error) {
      setErreur(messageUtilisateur(error, "Impossible d'enregistrer l'appréciation."));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader titre="Synthèse de classe" />
      <div className="flex flex-wrap gap-3">
        <FiltreSelect id="classe-synthese" label="Classe" value={classeId} onChange={setClasseId} options={(classes.data?.items ?? []).map((classe) => ({ value: classe.id, label: classe.nom }))} tousLabel="Choisir" />
        <FiltreSelect id="periode-synthese" label="Période" value={periodeId} onChange={setPeriodeId} options={(periodes.data ?? []).map((periode) => ({ value: periode.id, label: periode.libelle }))} tousLabel="Année entière" />
      </div>
      {!classeId ? <EmptyState titre="Choisissez une classe." /> : null}
      {classeId ? (
        <QueryGate loading={synthese.loading} error={synthese.error} onRetry={synthese.retry} hasData={synthese.data !== null}>
          {synthese.data ? (
            <div className="space-y-6">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="border-b border-border py-1 text-left">Matière</th>
                    <th scope="col" className="border-b border-border py-1 text-left">Coefficient</th>
                    <th scope="col" className="border-b border-border py-1 text-left">Moyenne</th>
                  </tr>
                </thead>
                <tbody>
                  {synthese.data.moyennesMatieres.map((matiere) => (
                    <tr key={matiere.matiereId}>
                      <th scope="row" className="py-1 text-left font-normal">{matiere.nom}</th>
                      <td>{formatCoefficient(matiere.coefficient)}</td>
                      <td>{formatMoyenne(matiere.moyenne)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="border-b border-border py-1 text-left">Élève</th>
                    <th scope="col" className="border-b border-border py-1 text-left">Moyenne</th>
                    <th scope="col" className="border-b border-border py-1 text-left">Rang</th>
                    <th scope="col" className="border-b border-border py-1 text-left">Appréciation</th>
                  </tr>
                </thead>
                <tbody>
                  {synthese.data.eleves.map((eleve) => (
                    <tr key={eleve.eleveId}>
                      <th scope="row" className="py-1 text-left font-normal">
                        <button type="button" className="text-primary" onClick={() => { setEleveId(eleve.eleveId); setTexte(eleve.appreciationGenerale ?? ""); }}>
                          {eleve.nom} {eleve.prenom}
                        </button>
                        {eleve.appreciationManquante ? " · appréciation manquante" : ""}
                      </th>
                      <td>{formatMoyenne(eleve.moyenne)}</td>
                      <td>{formatRang(eleve.rang, eleve.effectifClasse ?? eleve.effectif)}</td>
                      <td>{eleve.appreciation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {synthese.data.peutRedigerAppreciation && eleveId && periodeId ? (
                <div>
                  <TextAreaField id="appreciation-synthese" label="Appréciation générale" value={texte} onChange={(event) => setTexte(event.target.value)} />
                  {erreur ? <div className="mt-2"><Banner ton="danger">{erreur}</Banner></div> : null}
                  <Button className="mt-3" onClick={() => void enregistrer()}>Enregistrer</Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </QueryGate>
      ) : null}
    </div>
  );
}
