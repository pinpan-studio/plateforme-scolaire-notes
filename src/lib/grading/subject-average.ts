import { assertPositiveCoefficient } from './assert';
import { toScale20 } from './rounding';
import type { AverageResult, GradeInput } from './types';
import { computeWeightedAverage } from './weighted-average';

/**
 * Moyenne d'une matière, pondérée par les coefficients d'évaluation.
 *
 * Chaque note présente est ramenée sur 20 : `(score / maxScore) × 20`.
 * Les absences (`absent === true`) sont exclues, jamais comptées 0.
 * L'arrondi au centième n'est appliqué qu'une fois, sur le résultat.
 * Tableau vide ou que des absences → `value: null`.
 */
export function computeSubjectAverage(grades: readonly GradeInput[]): AverageResult {
  const entries = grades.map((grade) => {
    if (grade.absent === true) {
      return { coefficient: grade.coefficient, value: null };
    }

    assertPositiveCoefficient(grade.coefficient, "Le coefficient d'évaluation");
    return {
      coefficient: grade.coefficient,
      value: toScale20(grade.score, grade.maxScore),
    };
  });

  return computeWeightedAverage(entries);
}
