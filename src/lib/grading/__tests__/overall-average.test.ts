import { describe, expect, it } from 'vitest';
import { computeOverallAverage } from '../overall-average';
import { expectGradingError } from './helpers';

describe('computeOverallAverage', () => {
  it('calcule (15×4 + 12×2) / (4+2) = 14,00', () => {
    const result = computeOverallAverage([
      { coefficient: 4, average: 15 },
      { coefficient: 2, average: 12 },
    ]);
    expect(result.value).toBe(14);
    expect(result.raw).toBe(14);
    expect(result.counted).toBe(2);
    expect(result.excluded).toBe(0);
    expect(result.coefficientSum).toBe(6);
  });

  it('pondère les moyennes déjà ramenées au centième', () => {
    const result = computeOverallAverage([
      { coefficient: 1, average: 15.005 },
      { coefficient: 1, average: 10.004 },
    ]);
    expect(result.raw).toBeCloseTo(12.505, 8);
    expect(result.value).toBe(12.51);
  });

  it('donne un résultat différent d\'une pondération des valeurs brutes', () => {
    const roundedFirst = computeOverallAverage([
      { coefficient: 1, average: 15.005 },
      { coefficient: 1, average: 10.004 },
    ]);
    const rawMean = (15.005 + 10.004) / 2;
    expect(roundedFirst.value).toBe(12.51);
    expect(rawMean).toBeCloseTo(12.5045, 8);
    expect(roundedFirst.value).not.toBe(12.5);
  });

  it('exclut une matière sans moyenne au lieu de la compter zéro', () => {
    const result = computeOverallAverage([
      { coefficient: 4, average: null },
      { coefficient: 2, average: 12 },
    ]);
    expect(result.value).toBe(12);
    expect(result.counted).toBe(1);
    expect(result.excluded).toBe(1);
    expect(result.coefficientSum).toBe(2);
  });

  it('retourne null si aucune matière n\'a de moyenne', () => {
    expect(computeOverallAverage([])).toMatchObject({
      value: null,
      raw: null,
      counted: 0,
      excluded: 0,
      coefficientSum: 0,
    });
    expect(
      computeOverallAverage([
        { coefficient: 4, average: null },
        { coefficient: 1, average: null },
      ]),
    ).toMatchObject({ value: null, counted: 0, excluded: 2, coefficientSum: 0 });
  });

  it('accepte une seule matière', () => {
    const result = computeOverallAverage([{ coefficient: 3, average: 13.333 }]);
    expect(result.value).toBe(13.33);
    expect(result.coefficientSum).toBe(3);
  });

  it('refuse un coefficient de matière nul, négatif ou non fini, même sans moyenne', () => {
    expectGradingError('COEFFICIENT_NOT_POSITIVE', () =>
      computeOverallAverage([{ coefficient: 0, average: 15 }]),
    );
    expectGradingError('COEFFICIENT_NOT_POSITIVE', () =>
      computeOverallAverage([{ coefficient: -2, average: null }]),
    );
    expectGradingError('NON_FINITE', () =>
      computeOverallAverage([{ coefficient: Number.NaN, average: 10 }]),
    );
  });

  it('refuse une moyenne publiée hors barème', () => {
    expectGradingError('VALUE_OUT_OF_SCALE', () =>
      computeOverallAverage([{ coefficient: 1, average: 20.005 }]),
    );
    expectGradingError('VALUE_OUT_OF_SCALE', () =>
      computeOverallAverage([{ coefficient: 1, average: -1 }]),
    );
    expect(computeOverallAverage([{ coefficient: 1, average: 20.004 }]).value).toBe(20);
  });
});
