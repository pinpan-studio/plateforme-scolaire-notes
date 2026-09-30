"use client";

import { useState } from "react";
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
import { useToast } from "@/components/ui/toast";

export function BulletinsPage() {
  const { anneeId } = useSession();
  const toast = useToast();
  const [classeId, setClasseId] = useState("");
  const [periodeId, setPeriodeId] = useState("");
  const [eleveId, setEleveId] = useState("");
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const classes = useApiData(`classes-bul-${anneeId ?? ""}`, () => api.classes({ anneeId, page: 1, pageSize: 100 }));
  const periodes = useApiData(`periodes-bul-${anneeId ?? ""}`, () => api.periodes(anneeId));
  const eleves = useApiData(classeId ? `eleves-bul-${classeId}` : "eleves-bul-vide", () =>
    classeId ? api.eleves({ anneeId, classeId, page: 1, pageSize: 100 }) : Promise.resolve(null),
  );
  const bulletin = useApiData(eleveId ? `bulletin-${eleveId}-${periodeId}-${anneeId ?? ""}` : "bulletin-vide", () =>
    eleveId ? api.bulletin(eleveId, { anneeId, periodeId: periodeId || undefined }) : Promise.resolve(null),
  );

  async function enregistrer() {
    if (!bulletin.data || !periodeId) return;
    try {
      await api.enregistrerAppreciation({ eleveId: bulletin.data.eleve.id, periodeId, texte });
      toast("Appréciation enregistrée.");
      bulletin.retry();
    } catch (error) {
      setErreur(messageUtilisateur(error, "Impossible d'enregistrer l'appréciation."));
    }
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader titre="Bulletins" description="Aperçu calculé pour une classe et une période." />
        <div className="flex flex-wrap gap-3">
          <FiltreSelect id="classe-bulletin" label="Classe" value={classeId} onChange={(valeur) => { setClasseId(valeur); setEleveId(""); }} options={(classes.data?.items ?? []).map((classe) => ({ value: classe.id, label: classe.nom }))} tousLabel="Choisir" />
          <FiltreSelect id="periode-bulletin" label="Période" value={periodeId} onChange={setPeriodeId} options={(periodes.data ?? []).map((periode) => ({ value: periode.id, label: periode.libelle }))} tousLabel="Année entière" />
          <FiltreSelect id="eleve-bulletin" label="Élève" value={eleveId} onChange={(valeur) => { setEleveId(valeur); setTexte(""); }} options={(eleves.data?.items ?? []).map((eleve) => ({ value: eleve.id, label: `${eleve.nom} ${eleve.prenom}` }))} tousLabel="Choisir" />
        </div>
        {eleveId ? (
          <Button className="mt-4" variant="secondary" onClick={() => window.print()}>Imprimer</Button>
        ) : (
          <div className="mt-4"><EmptyState titre="Choisissez une classe, puis un élève." /></div>
        )}
      </div>
      {eleveId ? (
        <QueryGate loading={bulletin.loading} error={bulletin.error} onRetry={bulletin.retry} hasData={bulletin.data !== null}>
          {bulletin.data ? (
            <article className="bulletin-impression mx-auto max-w-3xl bg-card p-6 text-sm text-ink">
              <header>
                <p className="text-base font-semibold">{bulletin.data.etablissement.nom}</p>
                <p className="text-muted">{bulletin.data.etablissement.adresse}</p>
                <h1 className="mt-4 text-2xl font-semibold">Bulletin</h1>
                <p className="mt-1">
                  {bulletin.data.eleve.nom} {bulletin.data.eleve.prenom} · {bulletin.data.eleve.matricule} · {bulletin.data.classe.nom} · {bulletin.data.periode?.libelle ?? "Année"}
                </p>
              </header>
              {bulletin.data.reduitAuxMatieres ? <p className="mt-3 text-muted">Bulletin limité aux matières de votre affectation.</p> : null}
              <table className="mt-4 w-full">
                <thead>
                  <tr>
                    <th scope="col" className="border-b border-border py-1 text-left">Matière</th>
                    <th scope="col" className="border-b border-border py-1 text-left">Moyenne</th>
                    <th scope="col" className="border-b border-border py-1 text-left">Coefficient</th>
                    <th scope="col" className="border-b border-border py-1 text-left">Appréciation</th>
                    <th scope="col" className="border-b border-border py-1 text-left">Rang</th>
                  </tr>
                </thead>
                <tbody>
                  {bulletin.data.matieres.map((matiere) => (
                    <tr key={matiere.matiereId}>
                      <th scope="row" className="py-1 text-left font-normal">{matiere.nom}</th>
                      <td>{formatMoyenne(matiere.moyenne)}</td>
                      <td>{formatCoefficient(matiere.coefficient)}</td>
                      <td>{matiere.appreciation}</td>
                      <td>{formatRang(matiere.rang, matiere.effectifClasse)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4">
                Moyenne générale {formatMoyenne(bulletin.data.moyenneGenerale)} · {formatRang(bulletin.data.rang, bulletin.data.effectifClasse ?? bulletin.data.classe.effectif)} · {bulletin.data.appreciation} · effectif {bulletin.data.classe.effectif}
              </p>
              {bulletin.data.matieresSansNote > 0 ? <p className="text-muted">{bulletin.data.matieresSansNote} matières sans note, non comptées.</p> : null}
              <section className="mt-4">
                <h2 className="font-semibold">Appréciation générale</h2>
                {bulletin.data.peutRedigerAppreciation && periodeId ? (
                  <div className="print:hidden">
                    <TextAreaField id="appreciation-bulletin" label="Appréciation générale" value={texte || bulletin.data.appreciationGenerale || ""} onChange={(event) => setTexte(event.target.value)} />
                    {erreur ? <div className="mt-2"><Banner ton="danger">{erreur}</Banner></div> : null}
                    <Button className="mt-3" onClick={() => void enregistrer()}>Enregistrer</Button>
                  </div>
                ) : null}
                <p className={bulletin.data.peutRedigerAppreciation && periodeId ? "hidden print:block" : "mt-1"}>
                  {bulletin.data.appreciationGenerale || "—"}
                </p>
              </section>
            </article>
          ) : null}
        </QueryGate>
      ) : null}
    </div>
  );
}
