import type { ConflitVersionNote, LigneGrille } from "@/lib/api-client/types";

export type LigneConflitVisible = {
  eleveId: string;
  nom: string;
  /** La note a disparu : le corps 409 a `noteId` ou `version` à null. Aucune valeur n'est exposée. */
  disparue: boolean;
  /** `index` null : PATCH ou DELETE unitaire. La grille n'envoie un index null que pour une suppression. */
  suppression: boolean;
};

/**
 * Prépare l'affichage d'un 409 CONFLIT_VERSION.
 * Ne recopie ni `version`, ni `noteId`, ni aucune valeur de note.
 */
export function lignesEnConflit(conflits: readonly ConflitVersionNote[], lignes: readonly LigneGrille[]): LigneConflitVisible[] {
  const parEleve = new Map(lignes.map((ligne) => [ligne.eleveId, ligne]));
  const vus = new Set<string>();
  const resultat: LigneConflitVisible[] = [];
  for (const conflit of conflits) {
    if (!conflit.eleveId || vus.has(conflit.eleveId)) {
      continue;
    }
    vus.add(conflit.eleveId);
    const ligne = parEleve.get(conflit.eleveId);
    resultat.push({
      eleveId: conflit.eleveId,
      nom: ligne ? `${ligne.nom} ${ligne.prenom}` : "Une ligne",
      disparue: conflit.noteId === null || conflit.version === null,
      suppression: conflit.index === null,
    });
  }
  return resultat;
}
