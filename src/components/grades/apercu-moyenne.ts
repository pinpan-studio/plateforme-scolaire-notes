import { appreciate, computeSubjectAverage, GradingError, type GradeInput } from "@/lib/grading";
import { noteValide, type SaisieLigne } from "@/components/grades/validate-note";

export type ApercuMoyenne = {
  valeur: number | null;
  appreciation: string;
};

/**
 * Moyenne de l'évaluation en cours de saisie.
 * Seules les notes valides et les absences sont transmises au module :
 * une ligne vide ou invalide n'entre pas dans l'aperçu.
 */
export function apercuMoyenneEvaluation(
  lignes: readonly SaisieLigne[],
  noteMax: number,
  coefficient: number,
): ApercuMoyenne {
  const notes: GradeInput[] = [];
  for (const ligne of lignes) {
    if (ligne.absent) {
      notes.push({ score: 0, maxScore: noteMax, coefficient, absent: true });
      continue;
    }
    if (!noteValide(ligne, noteMax)) {
      continue;
    }
    notes.push({
      score: Number(ligne.saisie.trim().replace(",", ".")),
      maxScore: noteMax,
      coefficient,
    });
  }

  try {
    const resultat = computeSubjectAverage(notes);
    if (resultat.value === null) {
      return { valeur: null, appreciation: "Non évalué" };
    }
    return { valeur: resultat.value, appreciation: appreciate(resultat.value).label };
  } catch (error) {
    if (error instanceof GradingError) {
      return { valeur: null, appreciation: "Non évalué" };
    }
    throw error;
  }
}
