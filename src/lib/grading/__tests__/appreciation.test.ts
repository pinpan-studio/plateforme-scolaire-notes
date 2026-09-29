import { describe, expect, it } from 'vitest';
import {
  APPRECIATION_SCALE,
  appreciate,
  listAppreciationBands,
  type AppreciationCode,
} from '../appreciation';
import { expectGradingError } from './helpers';

const expectedCode = (published: number): AppreciationCode => {
  const band = APPRECIATION_SCALE.find((item) => published >= item.min);
  if (!band) {
    throw new Error(`Aucune mention pour ${published}`);
  }
  return band.code;
};

describe('APPRECIATION_SCALE', () => {
  it('est la constante unique, gelée, du plus haut seuil au plus bas', () => {
    expect(APPRECIATION_SCALE.map((band) => [band.code, band.label, band.min])).toEqual([
      ['tres_bien', 'Très bien', 16],
      ['bien', 'Bien', 14],
      ['assez_bien', 'Assez bien', 12],
      ['passable', 'Passable', 10],
      ['insuffisant', 'Insuffisant', 8],
      ['tres_insuffisant', 'Très insuffisant', 0],
    ]);
    expect(Object.isFrozen(APPRECIATION_SCALE)).toBe(true);
    expect(APPRECIATION_SCALE.every((band) => Object.isFrozen(band))).toBe(true);
  });

  it('dérive les bornes sans redéfinir les seuils', () => {
    expect(listAppreciationBands()).toEqual([
      { code: 'tres_bien', label: 'Très bien', min: 16, max: 20, maxInclusive: true },
      { code: 'bien', label: 'Bien', min: 14, max: 16, maxInclusive: false },
      { code: 'assez_bien', label: 'Assez bien', min: 12, max: 14, maxInclusive: false },
      { code: 'passable', label: 'Passable', min: 10, max: 12, maxInclusive: false },
      { code: 'insuffisant', label: 'Insuffisant', min: 8, max: 10, maxInclusive: false },
      { code: 'tres_insuffisant', label: 'Très insuffisant', min: 0, max: 8, maxInclusive: false },
    ]);
  });
});

describe('appreciate', () => {
  it.each([
    [0, 'tres_insuffisant', 'Très insuffisant'],
    [7.99, 'tres_insuffisant', 'Très insuffisant'],
    [7.995, 'insuffisant', 'Insuffisant'],
    [8, 'insuffisant', 'Insuffisant'],
    [9.99, 'insuffisant', 'Insuffisant'],
    [10, 'passable', 'Passable'],
    [11.99, 'passable', 'Passable'],
    [12, 'assez_bien', 'Assez bien'],
    [13.99, 'assez_bien', 'Assez bien'],
    [14, 'bien', 'Bien'],
    [15.99, 'bien', 'Bien'],
    [15.995, 'tres_bien', 'Très bien'],
    [16, 'tres_bien', 'Très bien'],
    [19.99, 'tres_bien', 'Très bien'],
    [20, 'tres_bien', 'Très bien'],
    [20.004, 'tres_bien', 'Très bien'],
  ])('donne la mention de %s', (average, code, label) => {
    const band = appreciate(average);
    expect(band.code).toBe(code);
    expect(band.label).toBe(label);
  });

  it('suit la constante sur chaque centième de 0 à 20', () => {
    for (let cents = 0; cents <= 2000; cents += 1) {
      const value = cents / 100;
      expect(appreciate(value).code).toBe(expectedCode(value));
    }
  });

  it('refuse ce qui s\'affiche hors barème', () => {
    expectGradingError('VALUE_OUT_OF_SCALE', () => appreciate(20.005));
    expectGradingError('VALUE_OUT_OF_SCALE', () => appreciate(-0.005));
    expectGradingError('VALUE_OUT_OF_SCALE', () => appreciate(21));
    expectGradingError('NON_FINITE', () => appreciate(Number.NaN));
  });
});
