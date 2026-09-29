import { expect } from 'vitest';
import { GradingError, type GradingErrorCode } from '../errors';

export function expectGradingError(code: GradingErrorCode, run: () => unknown): GradingError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(GradingError);
    expect(error).toBeInstanceOf(Error);
    const gradingError = error as GradingError;
    expect(gradingError.name).toBe('GradingError');
    expect(gradingError.code).toBe(code);
    expect(gradingError.message.length).toBeGreaterThan(0);
    return gradingError;
  }
  throw new Error(`Une GradingError ${code} était attendue.`);
}
