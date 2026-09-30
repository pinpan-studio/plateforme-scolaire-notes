import type { Role } from "@/lib/api-client/types";
import { peutEcrire } from "@/lib/ui-permissions";

/** Affectation déjà renvoyée par `GET /api/affectations`. */
export type AffectationSaisie = {
  enseignantId: string;
  classeId: string;
  matiereId: string;
  anneeScolaireId: string;
};

/**
 * L'enseignant n'écrit que sa propre affectation classe + matière + année.
 * Une affectation du même couple détenue par un collègue ne compte pas
 * (le professeur principal voit celles de sa classe).
 */
export function estAffecte(
  affectations: readonly AffectationSaisie[],
  critere: {
    enseignantId: string | null;
    classeId: string;
    matiereId: string;
    anneeScolaireId: string;
  },
): boolean {
  if (!critere.enseignantId) {
    return false;
  }
  return affectations.some(
    (item) =>
      item.enseignantId === critere.enseignantId &&
      item.classeId === critere.classeId &&
      item.matiereId === critere.matiereId &&
      item.anneeScolaireId === critere.anneeScolaireId,
  );
}

/**
 * Aide d'interface, calquée sur `canWriteClassSubject`.
 * L'API reste souveraine : un 403 peut encore refuser l'enregistrement.
 */
export function droitSaisie(params: {
  role: Role;
  anneeCloturee: boolean;
  affecte: boolean;
}): { peutModifier: boolean; motifLectureSeule: string | null } {
  if (params.role === "ADMIN") {
    return { peutModifier: true, motifLectureSeule: null };
  }
  if (params.anneeCloturee) {
    return {
      peutModifier: false,
      motifLectureSeule: "Année clôturée. Les notes ne sont plus modifiables.",
    };
  }
  if (!peutEcrire(params.role, "note")) {
    return {
      peutModifier: false,
      motifLectureSeule: "Consultation seule. Vous pouvez lire les notes, pas les modifier.",
    };
  }
  if (params.affecte) {
    return { peutModifier: true, motifLectureSeule: null };
  }
  return {
    peutModifier: false,
    motifLectureSeule: "Hors de votre affectation. Vous pouvez consulter ces notes, pas les modifier.",
  };
}
