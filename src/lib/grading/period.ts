import { assertNonEmptyId, assertPositiveCoefficient } from './assert';
import { GradingError } from './errors';
import { computeOverallAverage } from './overall-average';
import { computeSubjectAverage } from './subject-average';
import type { PeriodReport, SubjectInput } from './types';

/**
 * Bulletin d'une période : moyennes de matières, puis moyenne générale
 * calculée à partir de ces moyennes déjà arrondies.
 * Une matière sans note comptable est exclue de la générale.
 */
export function computePeriodReport(subjects: readonly SubjectInput[]): PeriodReport {
  const seen = new Set<string>();

  const reports = subjects.map((subject) => {
    assertNonEmptyId(subject.id, "L'identifiant de matière");
    if (seen.has(subject.id)) {
      throw new GradingError('DUPLICATE_ID', `La matière « ${subject.id} » est en double.`);
    }
    seen.add(subject.id);
    assertPositiveCoefficient(subject.coefficient, `Le coefficient de « ${subject.id} »`);

    return {
      id: subject.id,
      coefficient: subject.coefficient,
      average: computeSubjectAverage(subject.grades),
    };
  });

  const overall = computeOverallAverage(
    reports.map((subject) => ({
      coefficient: subject.coefficient,
      average: subject.average.value,
    })),
  );

  return { subjects: reports, overall };
}
