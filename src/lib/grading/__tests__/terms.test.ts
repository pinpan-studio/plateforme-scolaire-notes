import { describe, expect, it } from 'vitest';
import { compareTerms } from '../terms';
import { expectGradingError } from './helpers';

describe('compareTerms', () => {
  it('compare les trimestres de l\'exemple du README', () => {
    const comparison = compareTerms([
      { id: 'T1', label: 'Trimestre 1', average: 12.05 },
      { id: 'T2', label: 'Trimestre 2', average: 14.2 },
      { id: 'T3', label: 'Trimestre 3', average: 14.2 },
    ]);

    expect(comparison.terms.map((term) => term.average)).toEqual([12.05, 14.2, 14.2]);
    expect(comparison.consecutive).toEqual([
      {
        fromId: 'T1',
        toId: 'T2',
        fromAverage: 12.05,
        toAverage: 14.2,
        delta: 2.15,
        trend: 'up',
      },
      {
        fromId: 'T2',
        toId: 'T3',
        fromAverage: 14.2,
        toAverage: 14.2,
        delta: 0,
        trend: 'stable',
      },
    ]);
    expect(comparison.fromFirstToLast).toMatchObject({
      fromId: 'T1',
      toId: 'T3',
      delta: 2.15,
      trend: 'up',
    });
    expect(comparison.highest).toEqual({ id: 'T2', average: 14.2 });
    expect(comparison.lowest).toEqual({ id: 'T1', average: 12.05 });
  });

  it('signale une baisse', () => {
    const comparison = compareTerms([
      { id: 'T1', average: 14 },
      { id: 'T2', average: 11.5 },
    ]);
    expect(comparison.consecutive[0]).toMatchObject({ delta: -2.5, trend: 'down' });
    expect(comparison.fromFirstToLast?.trend).toBe('down');
  });

  it('laisse l\'écart indéterminé si une moyenne manque', () => {
    const comparison = compareTerms([
      { id: 'T1', average: 12 },
      { id: 'T2', average: null },
      { id: 'T3', average: 15 },
    ]);
    expect(comparison.consecutive.map((delta) => delta.trend)).toEqual([
      'incomplete',
      'incomplete',
    ]);
    expect(comparison.fromFirstToLast).toMatchObject({ delta: 3, trend: 'up' });
    expect(comparison.highest).toEqual({ id: 'T3', average: 15 });
    expect(comparison.lowest).toEqual({ id: 'T1', average: 12 });
  });

  it('n\'invente pas d\'écart sans deux trimestres', () => {
    expect(compareTerms([])).toEqual({
      terms: [],
      consecutive: [],
      fromFirstToLast: null,
      highest: null,
      lowest: null,
    });
    const single = compareTerms([{ id: 'T1', label: 'Trimestre 1', average: 13 }]);
    expect(single.consecutive).toEqual([]);
    expect(single.fromFirstToLast).toBeNull();
    expect(single.highest).toEqual({ id: 'T1', average: 13 });
    expect(single.lowest).toEqual({ id: 'T1', average: 13 });
    expect(single.terms[0].label).toBe('Trimestre 1');
  });

  it('retient le trimestre le plus ancien en cas d\'égalité', () => {
    const comparison = compareTerms([
      { id: 'T1', average: 10 },
      { id: 'T2', average: 14 },
      { id: 'T3', average: 10 },
    ]);
    expect(comparison.highest).toEqual({ id: 'T2', average: 14 });
    expect(comparison.lowest).toEqual({ id: 'T1', average: 10 });
  });

  it('publie les moyennes avant de les comparer', () => {
    const comparison = compareTerms([
      { id: 'T1', average: 12.004 },
      { id: 'T2', average: 12.005 },
    ]);
    expect(comparison.terms.map((term) => term.average)).toEqual([12, 12.01]);
    expect(comparison.consecutive[0]).toMatchObject({ delta: 0.01, trend: 'up' });
  });

  it('reste stable quand la soustraction binaire n\'est pas exacte', () => {
    const comparison = compareTerms([
      { id: 'T1', average: 12.05 },
      { id: 'T2', average: 14.2 },
    ]);
    expect(14.2 - 12.05).not.toBe(2.15);
    expect(comparison.consecutive[0].delta).toBe(2.15);
  });

  it('refuse un id vide, un doublon, ou une moyenne hors barème', () => {
    expectGradingError('EMPTY_ID', () => compareTerms([{ id: ' ', average: 10 }]));
    expectGradingError('DUPLICATE_ID', () =>
      compareTerms([
        { id: 'T1', average: 10 },
        { id: 'T1', average: 12 },
      ]),
    );
    expectGradingError('VALUE_OUT_OF_SCALE', () => compareTerms([{ id: 'T1', average: 20.5 }]));
    expectGradingError('NON_FINITE', () => compareTerms([{ id: 'T1', average: Number.NaN }]));
  });

  it('accepte un trimestre sans moyenne au milieu d\'une série vide de notes', () => {
    const comparison = compareTerms([
      { id: 'T1', average: null },
      { id: 'T2', average: null },
    ]);
    expect(comparison.consecutive[0].trend).toBe('incomplete');
    expect(comparison.consecutive[0].delta).toBeNull();
    expect(comparison.highest).toBeNull();
    expect(comparison.lowest).toBeNull();
  });
});
