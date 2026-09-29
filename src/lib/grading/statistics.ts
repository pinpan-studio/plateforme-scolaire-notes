import { listAppreciationBands, type AppreciationBand } from './appreciation';
import { PASS_MARK } from './constants';
import { publishOnScale, roundToCent } from './rounding';

export type DistributionBucket = AppreciationBand & {
  count: number;
  /** Part exacte de l'effectif, entre 0 et 1. */
  ratio: number;
};

export type GradeStatistics = {
  count: number;
  /** Moyenne des valeurs publiées, arrondie au centième. */
  average: number;
  /** Moyenne exacte des valeurs déjà ramenées au centième. */
  rawAverage: number;
  min: number;
  max: number;
  /** Médiane publiée. Effectif pair : moyenne des deux valeurs centrales, puis arrondi. */
  median: number;
  rawMedian: number;
  passCount: number;
  /** Part exacte des valeurs publiées ≥ 10. */
  passRate: number;
  /** `passRate × 100`, arrondi au centième. */
  passRatePercent: number;
  /** Toutes les tranches du barème, même celles à 0, dans l'ordre de la constante. */
  distribution: DistributionBucket[];
};

/**
 * Statistiques d'une série déjà exprimée sur 20
 * (moyennes d'élèves, ou notes normalisées).
 *
 * Chaque valeur est publiée au centième avant la moyenne, la médiane,
 * le min, le max, la réussite et les tranches : les indicateurs
 * correspondent aux notes affichées. Série vide → `null`.
 */
export function computeStatistics(values: readonly number[]): GradeStatistics | null {
  if (values.length === 0) {
    return null;
  }

  const published = values.map((value) => publishOnScale(value, 'La valeur'));
  const sorted = [...published].sort((a, b) => a - b);
  const count = sorted.length;
  const rawAverage = sorted.reduce((sum, value) => sum + value, 0) / count;
  const rawMedian = medianOfSorted(sorted);
  const passCount = sorted.filter((value) => value >= PASS_MARK).length;
  const passRate = passCount / count;
  const bands = listAppreciationBands();

  return {
    count,
    average: roundToCent(rawAverage),
    rawAverage,
    min: sorted[0],
    max: sorted[count - 1],
    median: roundToCent(rawMedian),
    rawMedian,
    passCount,
    passRate,
    passRatePercent: roundToCent(passRate * 100),
    distribution: bands.map((band) => {
      const bandCount = published.filter((value) => inBand(value, band)).length;
      return {
        ...band,
        count: bandCount,
        ratio: bandCount / count,
      };
    }),
  };
}

function medianOfSorted(sorted: readonly number[]): number {
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function inBand(value: number, band: AppreciationBand): boolean {
  if (value < band.min) {
    return false;
  }
  if (band.maxInclusive) {
    return value <= band.max;
  }
  return value < band.max;
}
