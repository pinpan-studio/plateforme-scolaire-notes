import { assertPositiveCoefficient, coerceOnScale } from './assert';
import { publishOnScale, roundToCent } from './rounding';
import type { AverageResult, WeightedValue } from './types';

export type WeightedAverageOptions = {
  /**
   * Arrondit chaque valeur au centième avant de pondérer.
   * Réservé à la moyenne générale, qui part des moyennes de matière publiées.
   * La moyenne de matière laisse ce drapeau à `false` : les notes normalisées
   * gardent leur précision jusqu'à l'arrondi final.
   */
  roundInputs?: boolean;
};

/**
 * Moyenne pondérée : Σ(valeur × coefficient) / Σ(coefficient), puis arrondi unique.
 * Les valeurs `null` sont ignorées et ne pèsent ni au numérateur ni au dénominateur.
 */
export function computeWeightedAverage(
  entries: readonly WeightedValue[],
  options?: WeightedAverageOptions,
): AverageResult {
  const roundInputs = options?.roundInputs ?? false;
  let weightedSum = 0;
  let coefficientSum = 0;
  let counted = 0;
  let excluded = 0;

  for (const entry of entries) {
    if (entry.value === null) {
      excluded += 1;
      continue;
    }

    assertPositiveCoefficient(entry.coefficient);
    const onScale = roundInputs ? publishOnScale(entry.value) : coerceOnScale(entry.value);
    weightedSum += onScale * entry.coefficient;
    coefficientSum += entry.coefficient;
    counted += 1;
  }

  if (counted === 0) {
    return {
      value: null,
      raw: null,
      counted: 0,
      excluded,
      coefficientSum: 0,
    };
  }

  const raw = weightedSum / coefficientSum;
  return {
    value: roundToCent(raw),
    raw,
    counted,
    excluded,
    coefficientSum,
  };
}
