import { GRADE_SCALE } from './constants';
import { publishOnScale } from './rounding';

/**
 * Barème unique des appréciations, du plus haut seuil au plus bas.
 * La mention retenue est la première dont le seuil inclusif est atteint
 * par la moyenne arrondie au centième.
 *
 * Très bien dès 16/20. Très insuffisant strictement sous 8
 * (8,00 est donc « Insuffisant »). Les seuils intermédiaires suivent
 * le barème classique des bulletins : 14, 12 et 10.
 */
export const APPRECIATION_SCALE = [
  { code: 'tres_bien', label: 'Très bien', min: 16 },
  { code: 'bien', label: 'Bien', min: 14 },
  { code: 'assez_bien', label: 'Assez bien', min: 12 },
  { code: 'passable', label: 'Passable', min: 10 },
  { code: 'insuffisant', label: 'Insuffisant', min: 8 },
  { code: 'tres_insuffisant', label: 'Très insuffisant', min: 0 },
] as const;

for (const band of APPRECIATION_SCALE) {
  Object.freeze(band);
}
Object.freeze(APPRECIATION_SCALE);

export type AppreciationCode = (typeof APPRECIATION_SCALE)[number]['code'];

export type AppreciationBand = {
  code: AppreciationCode;
  label: string;
  /** Borne basse inclusive. */
  min: number;
  /** Borne haute : inclusive seulement pour la mention la plus haute. */
  max: number;
  maxInclusive: boolean;
};

/** Bornes dérivées de `APPRECIATION_SCALE`. Aucun seuil n'est redéfini ici. */
export function listAppreciationBands(): readonly AppreciationBand[] {
  return APPRECIATION_SCALE.map((band, index) => ({
    code: band.code,
    label: band.label,
    min: band.min,
    max: index === 0 ? GRADE_SCALE : APPRECIATION_SCALE[index - 1].min,
    maxInclusive: index === 0,
  }));
}

/**
 * Mention d'une moyenne sur 20.
 * La valeur est d'abord arrondie au centième : 15,995 s'affiche 16,00
 * et obtient « Très bien ».
 */
export function appreciate(average: number): AppreciationBand {
  const rounded = publishOnScale(average, 'La moyenne');
  const bands = listAppreciationBands();
  const match = bands.find((band) => rounded >= band.min);
  if (!match) {
    throw new Error('Barème d\'appréciation incomplet : aucune tranche ne couvre 0.');
  }
  return match;
}
