import { GRADE_SCALE } from './constants';
import { GradingError } from './errors';

/** Écart toléré uniquement pour les résidus binaires autour de 0 et de 20. */
const SCALE_EPSILON = 1e-9;

export function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new GradingError('NON_FINITE', `${label} doit être un nombre fini.`);
  }
}

/**
 * Coefficient strictement positif.
 * Zéro et les valeurs négatives sont refusés : ils rendraient la moyenne
 * indéfinie ou en changeraient le sens.
 */
export function assertPositiveCoefficient(coefficient: number, label = 'Le coefficient'): void {
  assertFiniteNumber(coefficient, label);
  if (!(coefficient > 0)) {
    throw new GradingError(
      'COEFFICIENT_NOT_POSITIVE',
      `${label} doit être strictement positif (reçu : ${coefficient}).`,
    );
  }
}

export function assertNonEmptyId(id: string, label: string): void {
  if (id.trim() === '') {
    throw new GradingError('EMPTY_ID', `${label} ne peut pas être vide.`);
  }
}

/**
 * Ramène un résidu binaire du type 20.0000000002 sur l'intervalle [0, 20].
 * Une valeur vraiment hors barème est refusée.
 */
export function coerceOnScale(value: number, label = 'La valeur'): number {
  assertFiniteNumber(value, label);
  if (value < 0 || value > GRADE_SCALE + SCALE_EPSILON) {
    throw new GradingError(
      'VALUE_OUT_OF_SCALE',
      `${label} doit être comprise entre 0 et ${GRADE_SCALE} (reçu : ${value}).`,
    );
  }
  if (value > GRADE_SCALE) {
    return GRADE_SCALE;
  }
  return value;
}
