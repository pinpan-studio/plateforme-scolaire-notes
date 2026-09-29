export type LigneCollee = {
  saisie: string;
  absent: boolean;
  commentaire?: string;
};

const ABSENTS = new Set(["abs", "abs.", "absent", "a"]);

function estAbsent(valeur: string): boolean {
  return ABSENTS.has(valeur.trim().toLowerCase());
}

function estMarqueur(valeur: string): boolean | null {
  const texte = valeur.trim().toLowerCase();
  if (["oui", "1", "x", "absent", "abs"].includes(texte)) {
    return true;
  }
  if (["non", "0", ""].includes(texte)) {
    return false;
  }
  return null;
}

/** Colle une colonne de tableur, ou note, commentaire, ou note + absence + commentaire. */
export function parserCollage(texte: string): LigneCollee[] {
  const lignes = texte.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  while (lignes.length > 0 && lignes[lignes.length - 1] === "") {
    lignes.pop();
  }
  return lignes.map((ligne) => {
    const cellules = ligne.split("\t");
    const premiere = cellules[0] ?? "";
    if (cellules.length >= 3) {
      const marqueur = estMarqueur(cellules[1] ?? "");
      return {
        saisie: estAbsent(premiere) ? "" : premiere.trim(),
        absent: estAbsent(premiere) || marqueur === true,
        commentaire: (cellules[2] ?? "").trim(),
      };
    }
    if (cellules.length === 2) {
      return {
        saisie: estAbsent(premiere) ? "" : premiere.trim(),
        absent: estAbsent(premiere),
        commentaire: (cellules[1] ?? "").trim(),
      };
    }
    return {
      saisie: estAbsent(premiere) ? "" : premiere.trim(),
      absent: estAbsent(premiere),
    };
  });
}

export function collageMultiple(texte: string): boolean {
  return texte.includes("\n") || texte.includes("\t") || texte.includes("\r");
}
