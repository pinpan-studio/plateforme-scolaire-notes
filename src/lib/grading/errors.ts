export const GRADING_ERROR_CODES = [
  'NON_FINITE',
  'COEFFICIENT_NOT_POSITIVE',
  'MAX_SCORE_NOT_POSITIVE',
  'SCORE_NEGATIVE',
  'SCORE_ABOVE_MAX',
  'VALUE_OUT_OF_SCALE',
  'EMPTY_ID',
  'DUPLICATE_ID',
] as const;

export type GradingErrorCode = (typeof GRADING_ERROR_CODES)[number];

/** Erreur de calcul : donnée refusée, jamais transformée en 0 silencieux. */
export class GradingError extends Error {
  readonly code: GradingErrorCode;

  constructor(code: GradingErrorCode, message: string) {
    super(message);
    this.name = 'GradingError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
