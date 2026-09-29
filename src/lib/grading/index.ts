/**
 * Calcul des moyennes, rangs et appréciations.
 *
 * Module pur, sans accès base ni React : le backend (Route Handlers)
 * et le frontend importent ces fonctions pour que les formules ne divergent jamais.
 *
 * Règles (voir docs/01-analyse-fonctionnelle.md) :
 * - chaque note est ramenée sur 20 : valeur / noteMax * 20 ;
 * - la moyenne de matière pondère ces notes par le coefficient d'évaluation ;
 * - la moyenne générale pondère les moyennes de matières par le coefficient de matière ;
 * - une note absente, ou une matière sans moyenne, est exclue (numérateur et dénominateur) ;
 * - le résultat publié est arrondi au centième, half-up ;
 * - le rang est un rang concours (1, 1, 3) dans la classe.
 */

export type NoteSaisie = {
  valeur: number | null;
  absent: boolean;
  noteMax: number;
  coefficient: number;
};

export type MatiereMoyenne = {
  matiereId: string;
  coefficient: number;
  moyenne: number | null;
};

export type LigneClassement = {
  eleveId: string;
  moyenne: number | null;
};

export const BAREME_APPRECIATION = [
  { min: 16, libelle: "Très bien" },
  { min: 14, libelle: "Bien" },
  { min: 12, libelle: "Assez bien" },
  { min: 10, libelle: "Passable" },
  { min: 8, libelle: "Insuffisant" },
  { min: 0, libelle: "Très insuffisant" },
] as const;

export function roundHalfUp(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  const scaled = value * factor;
  const rounded = Math.sign(scaled) * Math.floor(Math.abs(scaled) + 0.5);
  return rounded / factor;
}

export function noteSurVingt(valeur: number, noteMax: number): number {
  if (!(noteMax > 0)) {
    throw new Error("note_max doit être strictement positif");
  }
  return (valeur / noteMax) * 20;
}

/** Moyenne pondérée par les coefficients d'évaluation, sur 20. */
export function moyenneMatiere(notes: NoteSaisie[]): number | null {
  let somme = 0;
  let coefs = 0;

  for (const note of notes) {
    if (note.absent || note.valeur === null) {
      continue;
    }
    if (!(note.coefficient > 0)) {
      throw new Error("Le coefficient d'évaluation doit être strictement positif");
    }
    somme += noteSurVingt(note.valeur, note.noteMax) * note.coefficient;
    coefs += note.coefficient;
  }

  if (coefs === 0) {
    return null;
  }

  return roundHalfUp(somme / coefs);
}

/**
 * Moyenne générale pondérée par les coefficients de matières.
 * Exemple : (15×4 + 12×2) / (4+2) = 14.
 * Une matière sans moyenne est ignorée, coefficient compris.
 */
export function moyenneGenerale(matieres: MatiereMoyenne[]): number | null {
  let somme = 0;
  let coefs = 0;

  for (const matiere of matieres) {
    if (matiere.moyenne === null) {
      continue;
    }
    if (!(matiere.coefficient > 0)) {
      throw new Error("Le coefficient de matière doit être strictement positif");
    }
    somme += matiere.moyenne * matiere.coefficient;
    coefs += matiere.coefficient;
  }

  if (coefs === 0) {
    return null;
  }

  return roundHalfUp(somme / coefs);
}

export function appreciationPourMoyenne(moyenne: number | null): string {
  if (moyenne === null || Number.isNaN(moyenne)) {
    return "Non noté";
  }

  for (const palier of BAREME_APPRECIATION) {
    if (moyenne >= palier.min) {
      return palier.libelle;
    }
  }

  return "Très insuffisant";
}

/**
 * Rang concours dans la classe, moyenne générale décroissante.
 * Deux moyennes égales partagent le rang ; le suivant est sauté.
 * Une moyenne nulle n'est pas classée.
 */
export function classer(lignes: LigneClassement[]): Map<string, number | null> {
  const classees = lignes
    .filter((ligne): ligne is LigneClassement & { moyenne: number } => ligne.moyenne !== null)
    .sort((a, b) => b.moyenne - a.moyenne || a.eleveId.localeCompare(b.eleveId));

  const rangs = new Map<string, number | null>();
  let rang = 0;
  let precedente: number | null = null;

  classees.forEach((ligne, index) => {
    if (precedente === null || ligne.moyenne !== precedente) {
      rang = index + 1;
      precedente = ligne.moyenne;
    }
    rangs.set(ligne.eleveId, rang);
  });

  for (const ligne of lignes) {
    if (ligne.moyenne === null) {
      rangs.set(ligne.eleveId, null);
    }
  }

  return rangs;
}
