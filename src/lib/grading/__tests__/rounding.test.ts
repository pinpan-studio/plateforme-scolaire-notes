import { describe, expect, it } from 'vitest';
import { GRADE_DECIMALS, GRADE_SCALE, PASS_MARK, ROUNDING_MODE } from '../constants';
import { publishOnScale, roundToCent, toCents, toScale20 } from '../rounding';
import { expectGradingError } from './helpers';

describe('constantes d\'arrondi', () => {
  it('expose une seule règle, au centième', () => {
    expect(GRADE_DECIMALS).toBe(2);
    expect(ROUNDING_MODE).toBe('half-away-from-zero');
    expect(GRADE_SCALE).toBe(20);
    expect(PASS_MARK).toBe(10);
  });
});

describe('roundToCent', () => {
  it.each([
    [0, 0],
    [-0, 0],
    [14, 14],
    [14.004, 14],
    [14.005, 14.01],
    [14.125, 14.13],
    [14.665, 14.67],
    [1.005, 1.01],
    [1.015, 1.02],
    [2.675, 2.68],
    [10.015, 10.02],
    [12.5045, 12.5],
    [12.505, 12.51],
    [19.995, 20],
    [-1.005, -1.01],
    [-1.004, -1],
    [-14.005, -14.01],
  ])('arrondit %s en %s', (input, expected) => {
    expect(roundToCent(input)).toBe(expected);
    expect(Object.is(roundToCent(input), -0)).toBe(false);
  });

  it('corrige le piège binaire que Math.round rate', () => {
    expect(Math.round(1.005 * 100) / 100).toBe(1);
    expect(roundToCent(1.005)).toBe(1.01);
    expect(Math.round(9.995 * 100) / 100).toBe(9.99);
    expect(roundToCent(9.995)).toBe(10);
  });

  it('est idempotent', () => {
    for (const value of [0, 1.005, 2.675, 10.333333, 14.005, 19.995, -1.005]) {
      const once = roundToCent(value);
      expect(roundToCent(once)).toBe(once);
    }
  });

  it('retrouve chaque centième de 0 à 20', () => {
    for (let cents = 0; cents <= 2000; cents += 1) {
      expect(toCents(cents / 100)).toBe(cents);
    }
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'refuse %s',
    (value) => {
      expectGradingError('NON_FINITE', () => roundToCent(value));
    },
  );
});

describe('publishOnScale', () => {
  it('publie 20,004 comme 20 et refuse 20,005', () => {
    expect(publishOnScale(20.004)).toBe(20);
    expect(publishOnScale(-0.004)).toBe(0);
    expectGradingError('VALUE_OUT_OF_SCALE', () => publishOnScale(20.005));
    expectGradingError('VALUE_OUT_OF_SCALE', () => publishOnScale(-0.005));
    expectGradingError('NON_FINITE', () => publishOnScale(Number.NaN));
  });
});

describe('toScale20', () => {
  it.each([
    [15, 20, 15],
    [15, 30, 10],
    [8, 10, 16],
    [0, 20, 0],
    [20, 20, 20],
    [1, 1, 20],
    [100, 100, 20],
    [7, 15, (7 / 15) * 20],
  ])('ramène %s/%s sur 20', (score, maxScore, expected) => {
    expect(toScale20(score, maxScore)).toBeCloseTo(expected, 10);
  });

  it('accepte une note égale au barème et un zéro présent', () => {
    expect(toScale20(40, 40)).toBe(20);
    expect(toScale20(0, 10)).toBe(0);
  });

  it('refuse une note au-dessus du barème, négative, ou un barème nul', () => {
    expectGradingError('SCORE_ABOVE_MAX', () => toScale20(21, 20));
    expectGradingError('SCORE_ABOVE_MAX', () => toScale20(10.001, 10));
    expectGradingError('SCORE_NEGATIVE', () => toScale20(-0.01, 20));
    expectGradingError('MAX_SCORE_NOT_POSITIVE', () => toScale20(10, 0));
    expectGradingError('MAX_SCORE_NOT_POSITIVE', () => toScale20(10, -5));
    expectGradingError('NON_FINITE', () => toScale20(Number.NaN, 20));
    expectGradingError('NON_FINITE', () => toScale20(10, Number.POSITIVE_INFINITY));
    expectGradingError('NON_FINITE', () => toScale20(Number.NEGATIVE_INFINITY, 20));
  });
});
