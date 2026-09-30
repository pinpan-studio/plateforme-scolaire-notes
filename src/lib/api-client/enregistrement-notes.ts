import { ApiError } from "@/lib/api-client/http";
import type { LigneNoteEnvoi } from "@/lib/api-client/types";

/** Même plafond que `LOT_NOTES_MAX` côté API. Le client refuse avant l'envoi. */
export const TAILLE_LOT_NOTES = 100;

export type SuppressionNote = {
  eleveId: string;
  noteId: string;
  version: string;
};

export type LigneLot = {
  eleveId: string;
  valeur: number | null;
  estAbsent: boolean;
  commentaire: string | null;
  version: string | null;
};

export type PlanEnregistrement = {
  suppressions: SuppressionNote[];
  lot: LigneLot[];
};

/**
 * Prépare l'enregistrement sans relire les versions.
 * Une suppression envoie la version chargée avec la grille.
 * Au-delà de 100 lignes à écrire, rien n'est préparé : l'appelant n'envoie pas.
 */
export function preparerEnregistrement(lignes: readonly LigneNoteEnvoi[]): PlanEnregistrement {
  const aSupprimer = lignes.filter((ligne) => ligne.supprimer);
  const aEcrire = lignes.filter((ligne) => !ligne.supprimer);
  if (aEcrire.length > TAILLE_LOT_NOTES) {
    throw new ApiError(
      422,
      "VALIDATION",
      "Ce lot dépasse 100 notes. Rien n'a été envoyé. Enregistrez au plus 100 modifications à la fois : vos saisies restent sur cette page.",
      [{ champ: "lignes", message: "Lot trop volumineux." }],
    );
  }
  const suppressions: SuppressionNote[] = [];
  for (const ligne of aSupprimer) {
    if (!ligne.noteId) {
      continue;
    }
    if (!ligne.version) {
      throw new ApiError(
        422,
        "VALIDATION",
        "La suppression n'a pas été envoyée : la version de la note est manquante. Vos saisies sont encore sur cette page. Rechargez les valeurs à jour, puis réessayez.",
        [{ champ: "version", message: "Version requise." }],
      );
    }
    suppressions.push({ eleveId: ligne.eleveId, noteId: ligne.noteId, version: ligne.version });
  }
  return {
    suppressions,
    lot: aEcrire.map((ligne) => ({
      eleveId: ligne.eleveId,
      valeur: ligne.absent ? null : ligne.valeur,
      estAbsent: ligne.absent,
      commentaire: ligne.commentaire,
      version: ligne.version,
    })),
  };
}
