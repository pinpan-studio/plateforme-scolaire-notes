import { describe, expect, it } from 'vitest';
import { appreciate } from '../appreciation';
import { computePeriodReport } from '../period';
import { expectGradingError } from './helpers';

describe('computePeriodReport', () => {
  it('enchaîne moyennes de matière arrondies et moyenne générale', () => {
    const report = computePeriodReport([
      {
        id: 'maths',
        coefficient: 4,
        grades: [{ score: 15, maxScore: 20, coefficient: 1 }],
      },
      {
        id: 'francais',
        coefficient: 2,
        grades: [{ score: 12, maxScore: 20, coefficient: 1 }],
      },
    ]);

    expect(report.subjects.map((subject) => subject.average.value)).toEqual([15, 12]);
    expect(report.overall.value).toBe(14);
    expect(report.overall.raw).toBe(14);
    expect(appreciate(report.overall.value as number).label).toBe('Bien');
  });

  it('ignore une matière vide sans tirer la générale vers zéro', () => {
    const report = computePeriodReport([
      {
        id: 'maths',
        coefficient: 4,
        grades: [{ score: 15, maxScore: 20, coefficient: 1 }],
      },
      {
        id: 'francais',
        coefficient: 2,
        grades: [{ score: 12, maxScore: 20, coefficient: 1 }],
      },
      { id: 'eps', coefficient: 3, grades: [] },
    ]);

    expect(report.subjects[2].average.value).toBeNull();
    expect(report.overall.value).toBe(14);
    expect(report.overall.counted).toBe(2);
    expect(report.overall.excluded).toBe(1);
    expect(report.overall.coefficientSum).toBe(6);
  });

  it('ne garde que les matières qui ont une note quand les autres sont absentes', () => {
    const report = computePeriodReport([
      {
        id: 'maths',
        coefficient: 4,
        grades: [{ score: 10, maxScore: 20, coefficient: 1 }],
      },
      {
        id: 'francais',
        coefficient: 2,
        grades: [{ score: 0, maxScore: 20, coefficient: 4, absent: true }],
      },
    ]);

    expect(report.subjects[1].average.value).toBeNull();
    expect(report.overall.value).toBe(10);
  });

  it('arrondit la matière avant de l\'entrer dans la générale', () => {
    const report = computePeriodReport([
      {
        id: 'maths',
        coefficient: 1,
        grades: [
          { score: 10, maxScore: 20, coefficient: 1 },
          { score: 10, maxScore: 20, coefficient: 1 },
          { score: 11, maxScore: 20, coefficient: 1 },
        ],
      },
      {
        id: 'francais',
        coefficient: 1,
        grades: [{ score: 10, maxScore: 20, coefficient: 1 }],
      },
    ]);

    expect(report.subjects[0].average.value).toBe(10.33);
    expect(report.overall.raw).toBeCloseTo((10.33 + 10) / 2, 10);
    expect(report.overall.value).toBe(10.17);
  });

  it('retourne un bulletin vide', () => {
    const report = computePeriodReport([]);
    expect(report.subjects).toEqual([]);
    expect(report.overall.value).toBeNull();
  });

  it('refuse un coefficient de matière nul, un id vide ou un doublon', () => {
    expectGradingError('COEFFICIENT_NOT_POSITIVE', () =>
      computePeriodReport([{ id: 'maths', coefficient: 0, grades: [] }]),
    );
    expectGradingError('EMPTY_ID', () =>
      computePeriodReport([{ id: '   ', coefficient: 1, grades: [] }]),
    );
    expectGradingError('DUPLICATE_ID', () =>
      computePeriodReport([
        { id: 'maths', coefficient: 1, grades: [] },
        { id: 'maths', coefficient: 2, grades: [] },
      ]),
    );
  });

  it('refuse une note d\'évaluation invalide dans une matière', () => {
    expectGradingError('SCORE_ABOVE_MAX', () =>
      computePeriodReport([
        {
          id: 'maths',
          coefficient: 2,
          grades: [{ score: 30, maxScore: 20, coefficient: 1 }],
        },
      ]),
    );
  });
});
