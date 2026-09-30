import { computeStatistics } from "@/lib/grading";
import type { MoyennesMatieres } from "@/lib/api-client/types";

/** Moyenne de matière déjà publiée par l'API, avant agrégation. */
export type MoyenneMatiereLue = {
  matiereId: string;
  nom: string;
  moyenne: number | null;
};

function rec(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/**
 * Lit `statistiques.moyenneClasse` publié par `GET /api/analyses/matiere`.
 * `null` si le corps n'est pas une analyse de matière.
 */
export function moyenneDepuisAnalyseMatiere(
  detail: unknown,
  repli: { id: string; nom: string },
): MoyennesMatieres["matieres"][number] | null {
  const corps = rec(detail);
  if (!("statistiques" in corps) && !("matiere" in corps)) return null;
  const sujet = rec(corps.matiere);
  const stats = rec(corps.statistiques);
  const matiereId = str(sujet.matiereId, repli.id);
  if (!matiereId) return null;
  return {
    matiereId,
    nom: str(sujet.nom, repli.nom),
    moyenne: numOrNull(stats.moyenneClasse),
    effectif: num(stats.calculables),
  };
}

/** Moyennes de matière déjà publiées sur chaque élève de `GET /api/analyses/classe`. */
export function moyennesElevesDepuisClasse(detail: unknown): MoyenneMatiereLue[] {
  const elevesBruts = rec(detail).eleves;
  const eleves: unknown[] = Array.isArray(elevesBruts) ? elevesBruts : [];
  const lignes: MoyenneMatiereLue[] = [];
  for (const row of eleves) {
    const item = rec(row);
    const matieresBrutes = item.matieres;
    const matieres: unknown[] = Array.isArray(matieresBrutes) ? matieresBrutes : [];
    for (const brut of matieres) {
      const matiere = rec(brut);
      const matiereId = str(matiere.matiereId);
      if (!matiereId) continue;
      lignes.push({
        matiereId,
        nom: str(matiere.nom),
        moyenne: numOrNull(matiere.moyenne),
      });
    }
  }
  return lignes;
}

/**
 * Une barre par matière. La moyenne est celle de `computeStatistics`
 * sur les moyennes d'élèves déjà publiées — le même agrégat que
 * `moyenneClasse` côté API, étendu à plusieurs classes.
 */
export function agregerMoyennesMatieres(lignes: readonly MoyenneMatiereLue[]): MoyennesMatieres {
  const parMatiere = new Map<string, { nom: string; valeurs: number[] }>();
  for (const ligne of lignes) {
    const actuel = parMatiere.get(ligne.matiereId) ?? { nom: ligne.nom, valeurs: [] };
    if (ligne.nom) actuel.nom = ligne.nom;
    if (ligne.moyenne !== null) actuel.valeurs.push(ligne.moyenne);
    parMatiere.set(ligne.matiereId, actuel);
  }
  const matieres = [...parMatiere.entries()]
    .map(([matiereId, item]) => {
      const stats = computeStatistics(item.valeurs);
      return {
        matiereId,
        nom: item.nom,
        moyenne: stats?.average ?? null,
        effectif: stats?.count ?? 0,
      };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  return { matieres };
}
