import { formatCoefficient } from "@/lib/format";

export type SaisieLigne = {
  saisie: string;
  absent: boolean;
  commentaire: string;
};

/** Validation de saisie. La moyenne affichée passe par le module de calcul. */
export function validerNote(ligne: SaisieLigne, noteMax: number): string | null {
  if (ligne.absent) {
    return null;
  }
  const texte = ligne.saisie.trim();
  if (!texte) {
    if (ligne.commentaire.trim()) {
      return "Indiquez une note ou cochez Absent.";
    }
    return null;
  }
  const normalise = texte.replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalise)) {
    return "Indiquez une note ou cochez Absent.";
  }
  const valeur = Number(normalise);
  if (valeur < 0) {
    return "La note ne peut pas être négative.";
  }
  if (valeur > noteMax) {
    return `La note ne peut pas dépasser ${formatCoefficient(noteMax)}.`;
  }
  return null;
}

export function noteValide(ligne: SaisieLigne, noteMax: number): boolean {
  return validerNote(ligne, noteMax) === null && !ligne.absent && ligne.saisie.trim() !== "";
}
