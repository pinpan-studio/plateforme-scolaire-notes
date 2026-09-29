/**
 * Constantes du barème sur 20.
 * Toute décision chiffrée du module (moyenne publiée, mention, réussite,
 * tranche, rang, écart de trimestre) passe par ces valeurs.
 */

/** Note maximale du bulletin, après normalisation. */
export const GRADE_SCALE = 20;

/** Seuil de réussite inclusif : 10/20 est une réussite. */
export const PASS_MARK = 10;

/** Nombre de décimales de l'arrondi unique. */
export const GRADE_DECIMALS = 2;

/**
 * Mode d'arrondi unique : au centième le plus proche,
 * le chiffre 5 s'éloigne de zéro (half away from zero).
 * Pour des notes positives, cela coïncide avec l'arrondi scolaire
 * « au centième supérieur en cas d'égalité ».
 */
export const ROUNDING_MODE = 'half-away-from-zero' as const;
