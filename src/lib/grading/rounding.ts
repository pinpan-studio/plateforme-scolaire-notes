import { GRADE_DECIMALS, GRADE_SCALE, ROUNDING_MODE } from './constants';
import { GradingError } from './errors';
import { coerceOnScale } from './assert';

const FACTOR = 10 ** GRADE_DECIMALS;

/**
 * Arrondi unique du module.
 *
 * Au centième le plus proche, le 5 s'éloigne de zéro
 * (`ROUNDING_MODE` = `half-away-from-zero`).
 *
 * Exemples : 14,004 → 14,00 ; 14,005 → 14,01 ; 1,005 → 1,01 ; −1,005 → −1,01.
 *
 * L'implémentation ne fait pas `Math.round(x * 100) / 100` tel quel :
 * en binaire, `1.005 * 100` vaut `100.49999999999999` et tomberait à 1,00.
 * On stabilise d'abord le produit sur 8 décimales, puis on applique
 * l'arrondi half-away-from-zero sur la partie entière des centièmes.
 */
export function roundToCent(value: number): number {
  if (!Number.isFinite(value)) {
    throw new GradingError('NON_FINITE', 'La valeur à arrondir doit être un nombre fini.');
  }

  const negative = value < 0;
  const scaled = Number((Math.abs(value) * FACTOR).toFixed(8));
  const cents = Math.floor(scaled + 0.5);
  const rounded = (negative ? -cents : cents) / FACTOR;

  return rounded === 0 ? 0 : rounded;
}

/** Valeur déjà publiée, exprimée en centièmes entiers. */
export function toCents(value: number): number {
  return Math.round(roundToCent(value) * FACTOR);
}

/**
 * Arrondit puis refuse le résultat s'il sort de [0, 20].
 * C'est la valeur affichée qui fait foi : 20,004 devient 20,00,
 * 20,005 devient 20,01 et est refusé.
 */
export function publishOnScale(value: number, label = 'La valeur'): number {
  const rounded = roundToCent(value);
  if (rounded < 0 || rounded > GRADE_SCALE) {
    throw new GradingError(
      'VALUE_OUT_OF_SCALE',
      `${label} doit être comprise entre 0 et ${GRADE_SCALE} après arrondi (reçu : ${rounded}).`,
    );
  }
  return rounded;
}

/**
 * Normalise une note brute sur 20 sans l'arrondir.
 * `score === maxScore` donne 20. `score > maxScore` est refusé.
 * Un 0 présent reste 0 : l'absence se traite ailleurs et n'arrive pas ici.
 */
export function toScale20(score: number, maxScore: number): number {
  if (!Number.isFinite(score)) {
    throw new GradingError('NON_FINITE', 'La note doit être un nombre fini.');
  }
  if (!Number.isFinite(maxScore)) {
    throw new GradingError('NON_FINITE', 'La note maximale doit être un nombre fini.');
  }

  if (!(maxScore > 0)) {
    throw new GradingError(
      'MAX_SCORE_NOT_POSITIVE',
      `La note maximale doit être strictement positive (reçu : ${maxScore}).`,
    );
  }
  if (score < 0) {
    throw new GradingError('SCORE_NEGATIVE', `La note ne peut pas être négative (reçu : ${score}).`);
  }
  if (score > maxScore) {
    throw new GradingError(
      'SCORE_ABOVE_MAX',
      `La note ${score} dépasse le barème ${maxScore}.`,
    );
  }

  return coerceOnScale((score / maxScore) * GRADE_SCALE, 'La note normalisée');
}

export { ROUNDING_MODE };
