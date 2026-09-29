import { describe, expect, it } from 'vitest';
import { roundToCent } from '../rounding';
import { computeSubjectAverage } from '../subject-average';
import type { GradeInput } from '../types';
import { expectGradingError } from './helpers';

const grade = (
  score: number,
  coefficient = 1,
  maxScore = 20,
  absent?: boolean,
): GradeInput => ({
  score,
  maxScore,
  coefficient,
  ...(absent === undefined ? {} : { absent }),
});

describe('computeSubjectAverage', () => {
  it('pondère des notes déjà sur 20', () => {
    const result = computeSubjectAverage([grade(18, 2), grade(10, 1)]);
    expect(result.raw).toBeCloseTo(46 / 3, 10);
    expect(result.value).toBe(15.33);
    expect(result.counted).toBe(2);
    expect(result.excluded).toBe(0);
    expect(result.coefficientSum).toBe(3);
  });

  it('ramène chaque note via son barème avant de pondérer', () => {
    const result = computeSubjectAverage([
      grade(8, 2, 10),
      grade(15, 1, 20),
    ]);
    expect(result.raw).toBeCloseTo(47 / 3, 10);
    expect(result.value).toBe(15.67);
  });

  it('reprend l\'exemple du README : absence et oral sur 10', () => {
    const result = computeSubjectAverage([
      grade(12, 1, 20),
      grade(0, 3, 20, true),
      grade(8, 2, 10),
    ]);
    expect(result.raw).toBeCloseTo(44 / 3, 10);
    expect(result.value).toBe(14.67);
    expect(result.counted).toBe(2);
    expect(result.excluded).toBe(1);
    expect(result.coefficientSum).toBe(3);
  });

  it('n\'arrondit qu\'une fois, à la fin', () => {
    const result = computeSubjectAverage([grade(10), grade(10), grade(11)]);
    expect(result.raw).toBeCloseTo(31 / 3, 10);
    expect(result.value).toBe(10.33);
    expect(result.value).toBe(roundToCent(result.raw as number));
  });

  it('accepte des coefficients fractionnaires', () => {
    const result = computeSubjectAverage([grade(18, 0.5), grade(10, 1.5)]);
    expect(result.raw).toBeCloseTo(12, 10);
    expect(result.value).toBe(12);
    expect(result.coefficientSum).toBe(2);
  });

  it('compte un zéro présent et ignore une absence, même notée zéro', () => {
    const presentZero = computeSubjectAverage([grade(0), grade(20)]);
    expect(presentZero.value).toBe(10);
    expect(presentZero.counted).toBe(2);

    const absentZero = computeSubjectAverage([grade(0, 5, 20, true), grade(20)]);
    expect(absentZero.value).toBe(20);
    expect(absentZero.counted).toBe(1);
    expect(absentZero.excluded).toBe(1);
    expect(absentZero.coefficientSum).toBe(1);
  });

  it('ne traite comme absence que le booléen true', () => {
    const result = computeSubjectAverage([
      { score: 0, maxScore: 20, coefficient: 1, absent: 1 as unknown as boolean },
    ]);
    expect(result.value).toBe(0);
    expect(result.counted).toBe(1);
  });

  it('retourne null sans note et sans compter les absences comme zéro', () => {
    expect(computeSubjectAverage([])).toEqual({
      value: null,
      raw: null,
      counted: 0,
      excluded: 0,
      coefficientSum: 0,
    });

    const absences = computeSubjectAverage([
      grade(99, 0, 10, true),
      grade(Number.NaN, -1, 0, true),
    ]);
    expect(absences.value).toBeNull();
    expect(absences.raw).toBeNull();
    expect(absences.counted).toBe(0);
    expect(absences.excluded).toBe(2);
    expect(absences.coefficientSum).toBe(0);
  });

  it('ne modifie pas le tableau d\'entrée', () => {
    const grades = [grade(12, 1), grade(0, 1, 20, true)];
    const snapshot = JSON.parse(JSON.stringify(grades)) as GradeInput[];
    computeSubjectAverage(grades);
    expect(grades).toEqual(snapshot);
  });

  it.each([0, -1, -0])('refuse le coefficient %s', (coefficient) => {
    expectGradingError('COEFFICIENT_NOT_POSITIVE', () =>
      computeSubjectAverage([grade(12, coefficient), grade(15, 2)]),
    );
  });

  it('refuse un coefficient non fini', () => {
    expectGradingError('NON_FINITE', () => computeSubjectAverage([grade(12, Number.NaN)]));
    expectGradingError('NON_FINITE', () =>
      computeSubjectAverage([grade(12, Number.POSITIVE_INFINITY)]),
    );
  });

  it('refuse une note hors barème même si une autre note est valable', () => {
    expectGradingError('SCORE_ABOVE_MAX', () =>
      computeSubjectAverage([grade(10), grade(21)]),
    );
    expectGradingError('SCORE_NEGATIVE', () => computeSubjectAverage([grade(-1)]));
    expectGradingError('MAX_SCORE_NOT_POSITIVE', () => computeSubjectAverage([grade(5, 1, 0)]));
    expectGradingError('NON_FINITE', () =>
      computeSubjectAverage([grade(Number.NaN)]),
    );
  });
});
