import { describe, expect, it } from 'vitest';
import { appreciate } from '../appreciation';
import {
  GRADE_SCALE,
  PASS_MARK,
  computePeriodReport,
  computeStatistics,
  rankCompetition,
  roundToCent,
} from '../index';

describe('bulletin', () => {
  const students = [
    {
      id: 'alice',
      subjects: [
        {
          id: 'maths',
          coefficient: 4,
          grades: [
            { score: 15, maxScore: 20, coefficient: 1 },
            { score: 0, maxScore: 20, coefficient: 3, absent: true },
            { score: 8, maxScore: 10, coefficient: 2 },
          ],
        },
        {
          id: 'francais',
          coefficient: 2,
          grades: [{ score: 12, maxScore: 20, coefficient: 1 }],
        },
      ],
    },
    {
      id: 'bob',
      subjects: [
        {
          id: 'maths',
          coefficient: 4,
          grades: [{ score: 10, maxScore: 20, coefficient: 1 }],
        },
        {
          id: 'francais',
          coefficient: 2,
          grades: [{ score: 4, maxScore: 20, coefficient: 1, absent: true }],
        },
      ],
    },
    {
      id: 'chloe',
      subjects: [
        {
          id: 'maths',
          coefficient: 4,
          grades: [{ score: 18, maxScore: 20, coefficient: 1 }],
        },
        {
          id: 'francais',
          coefficient: 2,
          grades: [{ score: 16, maxScore: 20, coefficient: 1 }],
        },
      ],
    },
    {
      id: 'djamel',
      subjects: [
        {
          id: 'maths',
          coefficient: 4,
          grades: [{ score: 18, maxScore: 20, coefficient: 1 }],
        },
        {
          id: 'francais',
          coefficient: 2,
          grades: [{ score: 16, maxScore: 20, coefficient: 1 }],
        },
      ],
    },
  ];

  it('produit moyennes, mentions, rangs et statistiques de classe', () => {
    const reports = students.map((student) => ({
      id: student.id,
      report: computePeriodReport(student.subjects),
    }));

    expect(reports[0].report.subjects[0].average.value).toBe(15.67);
    expect(reports[0].report.overall.value).toBe(14.45);
    expect(appreciate(reports[0].report.overall.value as number).label).toBe('Bien');

    expect(reports[1].report.overall.value).toBe(10);
    expect(appreciate(10).code).toBe('passable');

    expect(reports[2].report.overall.value).toBe(roundToCent((18 * 4 + 16 * 2) / 6));
    expect(reports[2].report.overall.value).toBe(17.33);
    expect(appreciate(17.33).label).toBe('Très bien');

    const ranked = rankCompetition(reports, (student) => student.report.overall.value);
    expect(ranked.map((entry) => [entry.item.id, entry.rank])).toEqual([
      ['chloe', 1],
      ['djamel', 1],
      ['alice', 3],
      ['bob', 4],
    ]);

    const stats = computeStatistics(
      reports.map((student) => student.report.overall.value as number),
    );
    expect(stats?.count).toBe(4);
    expect(stats?.min).toBe(10);
    expect(stats?.max).toBe(17.33);
    expect(stats?.passCount).toBe(4);
    expect(stats?.passRate).toBe(1);
    expect(stats?.distribution.every((band) => band.max <= GRADE_SCALE)).toBe(true);
    expect(stats?.average).toBeGreaterThanOrEqual(PASS_MARK);
  });
});
