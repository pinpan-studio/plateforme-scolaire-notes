import { assertPositiveCoefficient } from './assert';
import type { AverageResult } from './types';
import { computeWeightedAverage } from './weighted-average';

export type SubjectAverageInput = {
  coefficient: number;
  /**
   * Moyenne de matière. Elle est ramenée au centième avant la pondération,
   * même si l'appelant a déjà arrondi. `null` : matière exclue, pas un 0.
   */
  average: number | null;
};

/**
 * Moyenne générale pondérée par les coefficients de matières.
 *
 * Formule : Σ(moyenneMatièreArrondie × coefMatière) / Σ(coefMatière),
 * puis arrondi au centième.
 * Exemple : (15×4 + 12×2) / (4+2) = 14,00.
 */
export function computeOverallAverage(subjects: readonly SubjectAverageInput[]): AverageResult {
  for (const subject of subjects) {
    assertPositiveCoefficient(subject.coefficient, 'Le coefficient de matière');
  }

  return computeWeightedAverage(
    subjects.map((subject) => ({
      coefficient: subject.coefficient,
      value: subject.average,
    })),
    { roundInputs: true },
  );
}
