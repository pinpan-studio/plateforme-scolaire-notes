"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { ConflitVersionNote, GrilleNotes, LigneGrille, LigneNoteEnvoi } from "@/lib/api-client/types";
import { ApiError } from "@/lib/api-client";
import { formatCoefficient, formatDate, formatMoyenne, formatNoteSaisie, videOuNull } from "@/lib/format";
import { libelleTypeEvaluation } from "@/lib/labels";
import { apercuMoyenneEvaluation } from "@/components/grades/apercu-moyenne";
import { lignesEnConflit } from "@/components/grades/conflit-version";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { collageMultiple, parserCollage } from "@/components/grades/paste-notes";
import { useUnsavedChanges } from "@/components/grades/use-unsaved-changes";
import { noteValide, validerNote, type SaisieLigne } from "@/components/grades/validate-note";

function brouillonsDepuis(lignes: LigneGrille[]): Record<string, SaisieLigne> {
  return Object.fromEntries(
    lignes.map((ligne) => [
      ligne.eleveId,
      {
        saisie: ligne.valeur === null ? "" : formatNoteSaisie(ligne.valeur),
        absent: ligne.absent,
        commentaire: ligne.commentaire ?? "",
      },
    ]),
  );
}

function signatureLignes(lignes: LigneGrille[]): string {
  return lignes
    .map((ligne) => `${ligne.eleveId}:${ligne.valeur ?? ""}:${ligne.absent}:${ligne.commentaire ?? ""}:${ligne.version ?? ""}`)
    .join("|");
}

function idsDecrits(...ids: Array<string | false | undefined>): string | undefined {
  const presents = ids.filter((id): id is string => Boolean(id));
  return presents.length > 0 ? presents.join(" ") : undefined;
}

function CelluleVerrouillee({ nomAccessible, valeur, motif }: { nomAccessible: string; valeur: string; motif: string }) {
  return (
    <div
      role="group"
      aria-label={`${nomAccessible}, cellule verrouillée. ${motif}`}
      className="min-h-9 min-w-24 rounded-md border border-dashed border-slate-400 bg-slate-100 px-2 py-1 text-sm text-slate-700"
    >
      <span className="block text-xs font-semibold text-slate-600">Verrouillée</span>
      <span>{valeur}</span>
    </div>
  );
}

type Colonne = "note" | "absent" | "commentaire";

export function SaisieNotes({
  grille,
  onEnregistrer,
  onRecharger,
  onNavigate,
}: {
  grille: GrilleNotes;
  onEnregistrer: (lignes: LigneNoteEnvoi[]) => Promise<void>;
  /** Relit la grille. Le parent remplace `grille` : les brouillons suivent alors les valeurs enregistrées. */
  onRecharger?: () => Promise<void>;
  onNavigate?: (href: string) => void;
}) {
  const signature = signatureLignes(grille.lignes);
  const [signatureVue, setSignatureVue] = useState(signature);
  const [brouillons, setBrouillons] = useState(() => brouillonsDepuis(grille.lignes));
  const [recherche, setRecherche] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [rechargement, setRechargement] = useState(false);
  const [banniere, setBanniere] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);
  const [conflit, setConflit] = useState<ConflitVersionNote[] | null>(null);
  const [confirmerRechargement, setConfirmerRechargement] = useState(false);
  const occupeRef = useRef(false);

  if (signature !== signatureVue) {
    setSignatureVue(signature);
    setBrouillons(brouillonsDepuis(grille.lignes));
    setConflit(null);
    setBanniere(null);
  }

  const noteMax = grille.evaluation.noteMax;
  const lectureSeule = !grille.peutModifier;
  const motifVerrou = grille.motifLectureSeule ?? "Consultation seule";
  const occupe = envoi || rechargement;
  const conflitsVisibles = conflit ? lignesEnConflit(conflit, grille.lignes) : [];
  const elevesEnConflit = new Set(conflitsVisibles.map((ligne) => ligne.eleveId));
  const depart = brouillonsDepuis(grille.lignes);
  const sale =
    !lectureSeule &&
    grille.lignes.some((ligne) => {
      const actuel = brouillons[ligne.eleveId];
      const initial = depart[ligne.eleveId];
      if (!actuel || !initial) {
        return false;
      }
      return actuel.saisie !== initial.saisie || actuel.absent !== initial.absent || actuel.commentaire !== initial.commentaire;
    });

  const { hrefEnAttente, rester, quitter } = useUnsavedChanges(sale && !occupe, onNavigate);

  const erreurs = new Map<string, string>();
  let saisies = 0;
  let absents = 0;
  let restantes = 0;
  for (const ligne of grille.lignes) {
    const brouillon = brouillons[ligne.eleveId];
    if (!brouillon) {
      continue;
    }
    const message = validerNote(brouillon, noteMax);
    if (message) {
      erreurs.set(ligne.eleveId, message);
    }
    if (brouillon.absent) {
      absents += 1;
    } else if (noteValide(brouillon, noteMax)) {
      saisies += 1;
    } else {
      restantes += 1;
    }
  }

  const apercu = apercuMoyenneEvaluation(
    grille.lignes.flatMap((ligne) => {
      const brouillon = brouillons[ligne.eleveId];
      return brouillon ? [brouillon] : [];
    }),
    noteMax,
    grille.evaluation.coefficient,
  );

  const terme = recherche.trim().toLowerCase();
  const visibles = terme
    ? grille.lignes.filter((ligne) => `${ligne.nom} ${ligne.prenom} ${ligne.matricule}`.toLowerCase().includes(terme))
    : grille.lignes;

  function mettre(eleveId: string, patch: Partial<SaisieLigne>) {
    setSucces(false);
    setBrouillons((actuel) => {
      const ligne = actuel[eleveId];
      if (!ligne) {
        return actuel;
      }
      return { ...actuel, [eleveId]: { ...ligne, ...patch } };
    });
  }

  function deplacer(event: React.KeyboardEvent, index: number, colonne: Colonne) {
    if (event.key !== "Enter" && event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    const cible = visibles[index + (event.key === "ArrowUp" ? -1 : 1)];
    if (!cible) {
      return;
    }
    document.getElementById(`${colonne}-${cible.eleveId}`)?.focus();
  }

  function surColler(event: React.ClipboardEvent<HTMLInputElement>, index: number) {
    const texte = event.clipboardData.getData("text/plain");
    if (!collageMultiple(texte)) {
      return;
    }
    event.preventDefault();
    const collees = parserCollage(texte);
    setSucces(false);
    setBrouillons((actuel) => {
      const suivant = { ...actuel };
      collees.forEach((collee, decalage) => {
        const ligne = visibles[index + decalage];
        if (!ligne) {
          return;
        }
        const precedent = suivant[ligne.eleveId];
        if (!precedent) {
          return;
        }
        suivant[ligne.eleveId] = {
          saisie: collee.absent ? "" : collee.saisie,
          absent: collee.absent,
          commentaire: (collee.commentaire ?? precedent.commentaire).slice(0, 200),
        };
      });
      return suivant;
    });
  }

  function construirePayload(): LigneNoteEnvoi[] {
    const envois: LigneNoteEnvoi[] = [];
    for (const ligne of grille.lignes) {
      const brouillon = brouillons[ligne.eleveId];
      const initial = depart[ligne.eleveId];
      if (!brouillon || !initial) {
        continue;
      }
      if (
        brouillon.saisie === initial.saisie &&
        brouillon.absent === initial.absent &&
        brouillon.commentaire === initial.commentaire
      ) {
        continue;
      }
      if (brouillon.absent) {
        envois.push({
          eleveId: ligne.eleveId,
          valeur: null,
          absent: true,
          commentaire: videOuNull(brouillon.commentaire),
          supprimer: false,
          version: ligne.version,
          noteId: ligne.noteId ?? null,
        });
        continue;
      }
      const texte = brouillon.saisie.trim();
      if (!texte) {
        envois.push({
          eleveId: ligne.eleveId,
          valeur: null,
          absent: false,
          commentaire: null,
          supprimer: true,
          version: ligne.version,
          noteId: ligne.noteId ?? null,
        });
        continue;
      }
      envois.push({
        eleveId: ligne.eleveId,
        valeur: Number(texte.replace(",", ".")),
        absent: false,
        commentaire: videOuNull(brouillon.commentaire),
        supprimer: false,
        version: ligne.version,
        noteId: ligne.noteId ?? null,
      });
    }
    return envois;
  }

  async function enregistrer() {
    if (lectureSeule || occupeRef.current) {
      return;
    }
    if (erreurs.size > 0) {
      setSucces(false);
      setConflit(null);
      setBanniere("Corrigez les lignes signalées avant d'enregistrer.");
      return;
    }
    occupeRef.current = true;
    setEnvoi(true);
    setBanniere(null);
    try {
      await onEnregistrer(construirePayload());
      setSucces(true);
      setConflit(null);
      setBanniere(null);
    } catch (error) {
      setSucces(false);
      if (error instanceof ApiError && error.code === "CONFLIT_VERSION") {
        setConflit(error.conflits);
        setBanniere(null);
        return;
      }
      setConflit(null);
      if (error instanceof ApiError && error.code === "VALIDATION" && error.champs.some((champ) => champ.champ === "version" || champ.champ.endsWith(".version"))) {
        setBanniere("L'enregistrement a été refusé : la version de la note est manquante ou illisible. Vos saisies sont encore sur cette page. Rechargez les valeurs à jour, puis réessayez.");
      } else if (error instanceof ApiError && error.status !== 0) {
        setBanniere(error.message);
      } else {
        setBanniere("L'enregistrement a échoué. Vos saisies sont encore sur cette page. Réessayez.");
      }
    } finally {
      occupeRef.current = false;
      setEnvoi(false);
    }
  }

  async function rechargerValeurs() {
    if (!onRecharger || occupeRef.current) {
      return;
    }
    occupeRef.current = true;
    setConfirmerRechargement(false);
    setRechargement(true);
    setBanniere(null);
    try {
      await onRecharger();
    } catch {
      setBanniere("Le rechargement a échoué. Vos saisies sont encore sur cette page.");
    } finally {
      occupeRef.current = false;
      setRechargement(false);
    }
  }

  const evaluation = grille.evaluation;
  const type = libelleTypeEvaluation(evaluation.type);

  return (
    <div className="space-y-4">
      <nav aria-label="Fil d'Ariane" className="text-sm text-muted">
        <Link href="/evaluations" className="text-primary">
          Évaluations
        </Link>
        <span> / {evaluation.classe} / {evaluation.matiere} / {type} du {formatDate(evaluation.date)}</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Saisie des notes</h1>
          <p className="mt-1 text-sm text-muted">
            {evaluation.periode} · sur {formatCoefficient(evaluation.noteMax)} · coefficient {formatCoefficient(evaluation.coefficient)} · {evaluation.enseignant}
          </p>
        </div>
        <div className="text-sm text-ink">
          <p aria-live="polite">
            {saisies} saisies · {absents} absents · {restantes} restantes
          </p>
          <p aria-live="polite">
            Aperçu de la moyenne : {formatMoyenne(apercu.valeur)} · {apercu.appreciation}
          </p>
        </div>
      </div>
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-warning md:hidden">
        La saisie des notes est prévue pour un écran plus large.
      </p>
      <p className="sr-only" aria-live="polite">
        {envoi ? "Enregistrement en cours." : rechargement ? "Rechargement des notes en cours." : ""}
      </p>
      {lectureSeule ? <Banner ton="info">{motifVerrou}</Banner> : null}
      {succes ? <Banner ton="success">Notes enregistrées.</Banner> : null}
      {!lectureSeule && !succes && erreurs.size > 0 ? <Banner ton="danger">Corrigez les lignes signalées avant d’enregistrer.</Banner> : null}
      {!succes && erreurs.size === 0 && banniere ? <Banner ton="danger">{banniere}</Banner> : null}
      {conflit ? (
        <div
          id="alerte-conflit-version"
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-danger"
        >
          <p className="font-medium">Conflit de version</p>
          <p className="mt-1">
            Une ou plusieurs notes ont été modifiées par ailleurs. Si l&apos;écart porte sur le lot, aucune de ses lignes n&apos;est écrite. Si l&apos;écart porte sur une suppression, elle n&apos;est pas faite. Vos saisies sont toujours dans la grille.
          </p>
          {conflitsVisibles.length > 0 ? (
            <>
              <p className="mt-2 font-medium">Cellules concernées</p>
              <ul className="mt-1 list-disc pl-5">
                {conflitsVisibles.map((ligne) => (
                  <li key={ligne.eleveId}>
                    {ligne.nom}
                    {ligne.disparue ? " — la note n'existe plus" : ligne.suppression ? " — suppression refusée" : ""}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2">Les cellules concernées ne sont pas identifiées. Rechargez les valeurs à jour avant de réessayer.</p>
          )}
          <p className="mt-2">
            Pour continuer, rechargez les valeurs à jour. Cela remplace vos saisies par les notes actuellement enregistrées. Vous pourrez ensuite les modifier et enregistrer de nouveau.
          </p>
          {onRecharger ? (
            <div className="mt-3">
              <Button variant="secondary" disabled={occupe} onClick={() => setConfirmerRechargement(true)}>
                {rechargement ? "Rechargement…" : "Recharger les valeurs à jour"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <label className="block max-w-sm text-sm font-medium">
        Rechercher
        <input
          value={recherche}
          onChange={(event) => setRecherche(event.target.value)}
          className="mt-1 w-full rounded-lg border-2 border-border bg-card px-3 py-2 text-base focus-visible:border-primary focus-visible:outline-none"
        />
      </label>
      <div className="overflow-x-auto rounded-lg border border-border bg-card" aria-busy={occupe}>
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="sticky top-0 bg-card">
            <tr>
              <th scope="col" className="border-b border-border px-2 py-2 text-left font-medium">Matricule</th>
              <th scope="col" className="border-b border-border px-2 py-2 text-left font-medium">Nom et prénom</th>
              <th scope="col" className="border-b border-border px-2 py-2 text-left font-medium">Note</th>
              <th scope="col" className="border-b border-border px-2 py-2 text-left font-medium">Absent</th>
              <th scope="col" className="border-b border-border px-2 py-2 text-left font-medium">Commentaire</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((ligne, index) => {
              const brouillon = brouillons[ligne.eleveId] ?? { saisie: "", absent: false, commentaire: "" };
              const erreur = erreurs.get(ligne.eleveId);
              const nom = `${ligne.nom} ${ligne.prenom}`;
              const enConflit = elevesEnConflit.has(ligne.eleveId);
              const idConflit = enConflit ? `conflit-${ligne.eleveId}` : undefined;
              return (
                <tr key={ligne.eleveId} className={enConflit ? "border-b border-amber-300 bg-amber-50 last:border-b-0" : "border-b border-border last:border-b-0"}>
                  <td className="px-2 py-1">{ligne.matricule}</td>
                  <th scope="row" className="px-2 py-1 text-left font-medium">
                    {nom}
                    {enConflit ? (
                      <span id={idConflit} className="mt-1 block text-xs font-medium text-warning">
                        Conflit de version
                      </span>
                    ) : null}
                  </th>
                  <td className="px-2 py-1">
                    {lectureSeule ? (
                      <CelluleVerrouillee
                        nomAccessible={`Note de ${nom}`}
                        valeur={brouillon.absent ? "Abs." : brouillon.saisie || "—"}
                        motif={motifVerrou}
                      />
                    ) : (
                      <>
                        <input
                          id={`note-${ligne.eleveId}`}
                          aria-label={`Note de ${nom}`}
                          inputMode="decimal"
                          disabled={brouillon.absent || occupe}
                          value={brouillon.saisie}
                          aria-invalid={erreur || enConflit ? true : undefined}
                          aria-describedby={idsDecrits(erreur ? `erreur-${ligne.eleveId}` : undefined, idConflit)}
                          onChange={(event) => mettre(ligne.eleveId, { saisie: event.target.value })}
                          onKeyDown={(event) => deplacer(event, index, "note")}
                          onPaste={(event) => surColler(event, index)}
                          className="h-9 w-24 rounded-md border-2 border-border px-2 text-sm focus-visible:border-primary focus-visible:outline-none disabled:bg-slate-100"
                        />
                        {erreur ? (
                          <p id={`erreur-${ligne.eleveId}`} className="mt-1 text-xs text-danger">
                            {erreur}
                          </p>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    {lectureSeule ? (
                      <CelluleVerrouillee
                        nomAccessible={`Absence de ${nom}`}
                        valeur={brouillon.absent ? "Absent" : "Présent"}
                        motif={motifVerrou}
                      />
                    ) : (
                      <input
                        id={`absent-${ligne.eleveId}`}
                        type="checkbox"
                        aria-label={`Absent — ${nom}`}
                        checked={brouillon.absent}
                        disabled={occupe}
                        aria-describedby={idConflit}
                        onChange={(event) =>
                          mettre(ligne.eleveId, { absent: event.target.checked, saisie: event.target.checked ? "" : brouillon.saisie })
                        }
                        onKeyDown={(event) => deplacer(event, index, "absent")}
                        className="size-4 accent-primary"
                      />
                    )}
                  </td>
                  <td className="px-2 py-1">
                    {lectureSeule ? (
                      <CelluleVerrouillee
                        nomAccessible={`Commentaire de ${nom}`}
                        valeur={brouillon.commentaire || "—"}
                        motif={motifVerrou}
                      />
                    ) : (
                      <span className="flex items-center gap-2">
                        <input
                          id={`commentaire-${ligne.eleveId}`}
                          aria-label={`Commentaire de ${nom}`}
                          maxLength={200}
                          disabled={occupe}
                          value={brouillon.commentaire}
                          aria-describedby={idConflit}
                          onChange={(event) => mettre(ligne.eleveId, { commentaire: event.target.value.slice(0, 200) })}
                          onKeyDown={(event) => deplacer(event, index, "commentaire")}
                          className="h-9 w-full min-w-40 rounded-md border-2 border-border px-2 text-sm focus-visible:border-primary focus-visible:outline-none disabled:bg-slate-100"
                        />
                        <span className="text-xs text-muted">{brouillon.commentaire.length}/200</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visibles.length === 0 ? <p className="text-sm text-muted">Aucun élève ne correspond à cette recherche.</p> : null}
      {lectureSeule ? null : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void enregistrer()} busy={envoi} disabled={!sale || erreurs.size > 0 || rechargement}>
            Enregistrer
          </Button>
          <Button
            variant="secondary"
            disabled={!sale || occupe}
            onClick={() => {
              setBrouillons(brouillonsDepuis(grille.lignes));
              setBanniere(null);
              setSucces(false);
              setConflit(null);
            }}
          >
            Annuler les modifications
          </Button>
        </div>
      )}
      <Dialog
        ouvert={hrefEnAttente !== null}
        titre="Quitter sans enregistrer ?"
        description="Des notes modifiées ne sont pas encore enregistrées."
        annulerLabel="Rester"
        confirmerLabel="Quitter"
        danger
        onAnnuler={rester}
        onConfirmer={quitter}
      />
      <Dialog
        ouvert={confirmerRechargement}
        titre="Recharger les valeurs à jour ?"
        description="Les notes affichées seront remplacées par celles qui sont enregistrées. Ce que vous avez tapé et qui n'est pas encore enregistré sera effacé."
        annulerLabel="Garder mes saisies"
        confirmerLabel="Recharger"
        danger
        onAnnuler={() => setConfirmerRechargement(false)}
        onConfirmer={() => void rechargerValeurs()}
      />
    </div>
  );
}
