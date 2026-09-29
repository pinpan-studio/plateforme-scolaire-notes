export { GRADE_DECIMALS, GRADE_SCALE, PASS_MARK, ROUNDING_MODE } from './constants';
export { GRADING_ERROR_CODES, GradingError, type GradingErrorCode } from './errors';
export { publishOnScale, roundToCent, toCents, toScale20 } from './rounding';
export type {
  AverageResult,
  GradeInput,
  PeriodReport,
  SubjectInput,
  SubjectReport,
  WeightedValue,
} from './types';
export { computeWeightedAverage, type WeightedAverageOptions } from './weighted-average';
export { computeSubjectAverage } from './subject-average';
export { computeOverallAverage, type SubjectAverageInput } from './overall-average';
export { computePeriodReport } from './period';
export { rankCompetition, type RankedItem } from './ranking';
export {
  APPRECIATION_SCALE,
  appreciate,
  listAppreciationBands,
  type AppreciationBand,
  type AppreciationCode,
} from './appreciation';
export { computeStatistics, type DistributionBucket, type GradeStatistics } from './statistics';
export {
  compareTerms,
  type PublishedTerm,
  type TermComparison,
  type TermDelta,
  type TermExtreme,
  type TermSnapshot,
  type Trend,
} from './terms';
