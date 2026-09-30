"use client";

import { useState } from "react";
import { api, messageUtilisateur } from "@/lib/api-client";
import type { Bulletin } from "@/lib/api-client/types";
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

const APPRECIATION_ABSENTE = "Aucune appréciation générale.";
const APPRECIATION_HORS_PERIODE = "Aucune appréciation générale. Elle est enregistrée pour une période.";

function accord(nombre: number, singulier: string, pluriel: string): string {
  return `${nombre} ${nombre === 1 ? singulier : pluriel}`;
}

function RedactionAppreciation({
  valeurInitiale,
  erreur,
  onEnregistrer,
}: {
  valeurInitiale: string;
  erreur: string | null;
  onEnregistrer: (texte: string) => void;
}) {
  const [texte, setTexte] = useState(valeurInitiale);
  return (
    <div className="print:hidden">
      <TextAreaField
        id="appreciation-bulletin"
        label="Appréciation générale"
        value={texte}
        onChange={(event) => setTexte(event.target.value)}
      />
      {erreur ? (
        <div className="mt-2">
          <Banner ton="danger">{erreur}</Banner>
        </div>
      ) : null}
      <Button className="mt-3" onClick={() => onEnregistrer(texte)}>
        Enregistrer
      </Button>
    </div>
  );
}

function DocumentBulletin({
  bulletin,
  periodeChoisie,
  erreur,
  onEnregistrer,
}: {
  bulletin: Bulletin;
  periodeChoisie: boolean;
  erreur: string | null;
  onEnregistrer: (texte: string) => void;
}) {
  const peutRediger = bulletin.peutRedigerAppreciation && periodeChoisie;
  const texte = bulletin.appreciationGenerale?.trim() ?? "";
  const messageVide = periodeChoisie ? APPRECIATION_ABSENTE : APPRECIATION_HORS_PERIODE;
  const effectifClasse = bulletin.effectifClasse;
  const effectifInscrits = bulletin.classe.effectif;
  const rangGeneral = formatRang(bulletin.rang, effectifClasse ?? effectifInscrits);
  const effectifVisible = bulletin.reduitAuxMatieres ? "—" : String(effectifInscrits);
  const classementsDistincts =
    effectifClasse !== null && !bulletin.reduitAuxMatieres && effectifClasse !== effectifInscrits;

  return (
    <article className="bulletin-impression mx-auto max-w-3xl bg-card p-4 text-sm text-ink sm:p-6">
      <header>
        <p className="text-base font-semibold">{bulletin.etablissement.nom}</p>
        {bulletin.etablissement.adresse ? <p className="text-muted">{bulletin.etablissement.adresse}</p> : null}
        <h2 className="mt-4 text-2xl font-semibold text-ink">Bulletin</h2>
        <p className="mt-1 break-words">
          {bulletin.eleve.nom} {bulletin.eleve.prenom} · {bulletin.eleve.matricule} · {bulletin.classe.nom} ·{" "}
          {bulletin.periode?.libelle ?? "Année"}
        </p>
      </header>
      {bulletin.reduitAuxMatieres ? (
        <p className="mt-3 text-muted">Bulletin limité aux matières de votre affectation.</p>
      ) : null}
      {bulletin.matieres.length === 0 ? (
        <p className="mt-4">Aucune matière sur ce bulletin.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse">
            <caption className="mb-2 text-left font-semibold text-ink">Résultats par matière</caption>
            <thead>
              <tr>
                <th scope="col" className="border-b border-border py-2 pr-3 text-left">
                  Matière
                </th>
                <th scope="col" className="border-b border-border py-2 pr-3 text-left">
                  Moyenne
                </th>
                <th scope="col" className="border-b border-border py-2 pr-3 text-left">
                  Coefficient
                </th>
                <th scope="col" className="border-b border-border py-2 pr-3 text-left">
                  Appréciation
                </th>
                <th scope="col" className="border-b border-border py-2 text-left">
                  Rang
                </th>
              </tr>
            </thead>
            <tbody>
              {bulletin.matieres.map((matiere) => (
                <tr key={matiere.matiereId} className="border-b border-border last:border-b-0">
                  <th scope="row" className="py-2 pr-3 text-left font-medium">
                    {matiere.nom}
                  </th>
                  <td className="py-2 pr-3">{formatMoyenne(matiere.moyenne)}</td>
                  <td className="py-2 pr-3">{formatCoefficient(matiere.coefficient)}</td>
                  <td className="py-2 pr-3">{matiere.appreciation || "—"}</td>
                  <td className="whitespace-nowrap py-2">{formatRang(matiere.rang, matiere.effectifClasse)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
        <div>
          <dt className="text-muted">Moyenne générale</dt>
          <dd className="text-base font-semibold">{formatMoyenne(bulletin.moyenneGenerale)}</dd>
        </div>
        <div>
          <dt className="text-muted">Rang</dt>
          <dd className="text-base font-semibold">{rangGeneral}</dd>
        </div>
        <div>
          <dt className="text-muted">Appréciation</dt>
          <dd className="text-base font-semibold">{bulletin.appreciation || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Effectif</dt>
          <dd className="text-base font-semibold">{effectifVisible}</dd>
        </div>
      </dl>
      {classementsDistincts ? (
        <p className="mt-2 text-muted">
          Le rang porte sur {accord(effectifClasse, "élève classé", "élèves classés")}, pour{" "}
          {accord(effectifInscrits, "inscrit", "inscrits")}.
        </p>
      ) : null}
      {bulletin.matieresSansNote > 0 ? (
        <p className="mt-2 text-muted">
          {bulletin.matieresSansNote} {bulletin.matieresSansNote > 1 ? "matières" : "matière"} sans note, non{" "}
          {bulletin.matieresSansNote > 1 ? "comptées" : "comptée"}.
        </p>
      ) : null}
      <section className="mt-4 border-t border-border pt-4" aria-labelledby="appreciation-generale-titre">
        <h3 id="appreciation-generale-titre" className="font-semibold text-ink">
          Appréciation générale
        </h3>
        {texte ? (
          <p className={peutRediger ? "mt-3 hidden whitespace-pre-wrap break-words print:block" : "mt-1 whitespace-pre-wrap break-words"}>
            {texte}
          </p>
        ) : (
          <p className="mt-1">{messageVide}</p>
        )}
        {peutRediger ? (
          <RedactionAppreciation
            key={`${bulletin.eleve.id}:${bulletin.periode?.id ?? ""}:${texte}`}
            valeurInitiale={texte}
            erreur={erreur}
            onEnregistrer={onEnregistrer}
          />
        ) : null}
      </section>
    </article>
  );
}

export function BulletinsPage() {
  const { anneeId } = useSession();
  const toast = useToast();
  const [classeId, setClasseId] = useState("");
  const [periodeId, setPeriodeId] = useState("");
  const [eleveId, setEleveId] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const classes = useApiData(`classes-bul-${anneeId ?? ""}`, () => api.classes({ anneeId, page: 1, pageSize: 100 }));
  const periodes = useApiData(`periodes-bul-${anneeId ?? ""}`, () => api.periodes(anneeId));
  const eleves = useApiData(classeId ? `eleves-bul-${classeId}` : "eleves-bul-vide", () =>
    classeId ? api.eleves({ anneeId, classeId, page: 1, pageSize: 100 }) : Promise.resolve(null),
  );
  const bulletin = useApiData(eleveId ? `bulletin-${eleveId}-${periodeId}-${anneeId ?? ""}` : "bulletin-vide", () =>
    eleveId ? api.bulletin(eleveId, { anneeId, periodeId: periodeId || undefined }) : Promise.resolve(null),
  );

  const periodeDocument = bulletin.data?.periode?.id ?? "";
  const documentBulletin =
    bulletin.data && bulletin.data.eleve.id === eleveId && periodeDocument === periodeId && !bulletin.loading
      ? bulletin.data
      : null;
  const erreurFiltres = classes.error ?? periodes.error ?? (classeId ? eleves.error : null);

  async function enregistrer(texte: string) {
    if (!documentBulletin || !periodeId) return;
    setErreur(null);
    try {
      await api.enregistrerAppreciation({ eleveId: documentBulletin.eleve.id, periodeId, texte });
      toast("Appréciation enregistrée.");
      bulletin.retry();
    } catch (error) {
      setErreur(messageUtilisateur(error, "Impossible d'enregistrer l'appréciation."));
    }
  }

  let invitation = "Choisissez une classe, puis un élève.";
  if (classeId && eleves.data && eleves.data.items.length === 0) {
    invitation = "Aucun élève inscrit dans cette classe.";
  } else if (classeId && !eleveId) {
    invitation = "Choisissez un élève pour afficher le bulletin.";
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader titre="Bulletins" description="Aperçu calculé pour une classe et une période." />
        <div className="flex flex-wrap gap-3">
          <FiltreSelect
            id="classe-bulletin"
            label="Classe"
            value={classeId}
            onChange={(valeur) => {
              setClasseId(valeur);
              setEleveId("");
              setErreur(null);
            }}
            options={(classes.data?.items ?? []).map((classe) => ({ value: classe.id, label: classe.nom }))}
            tousLabel="Choisir"
          />
          <FiltreSelect
            id="periode-bulletin"
            label="Période"
            value={periodeId}
            onChange={(valeur) => {
              setPeriodeId(valeur);
              setErreur(null);
            }}
            options={(periodes.data ?? []).map((periode) => ({ value: periode.id, label: periode.libelle }))}
            tousLabel="Année entière"
          />
          <FiltreSelect
            id="eleve-bulletin"
            label="Élève"
            value={eleveId}
            onChange={(valeur) => {
              setEleveId(valeur);
              setErreur(null);
            }}
            options={(eleves.data?.items ?? []).map((eleve) => ({ value: eleve.id, label: `${eleve.nom} ${eleve.prenom}` }))}
            tousLabel="Choisir"
          />
        </div>
        {erreurFiltres ? (
          <div className="mt-4">
            <Banner ton="danger">{erreurFiltres}</Banner>
          </div>
        ) : null}
        {eleveId ? (
          <Button className="mt-4" variant="secondary" onClick={() => window.print()}>
            Imprimer
          </Button>
        ) : erreurFiltres ? null : (
          <div className="mt-4">
            <EmptyState titre={invitation} />
          </div>
        )}
      </div>
      {eleveId ? (
        <QueryGate
          loading={documentBulletin === null && !bulletin.error}
          error={bulletin.error}
          onRetry={bulletin.retry}
          hasData={documentBulletin !== null}
        >
          {documentBulletin ? (
            <DocumentBulletin
              bulletin={documentBulletin}
              periodeChoisie={Boolean(periodeId)}
              erreur={erreur}
              onEnregistrer={(texte) => void enregistrer(texte)}
            />
          ) : null}
        </QueryGate>
      ) : null}
    </div>
  );
}
