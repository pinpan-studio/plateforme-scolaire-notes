import { describe, expect, it } from 'vitest';
import { APPRECIATION_SCALE } from '../appreciation';
import { computeStatistics } from '../statistics';
import { expectGradingError } from './helpers';

describe('computeStatistics', () => {
  it('calcule l\'exemple du README', () => {
    const stats = computeStatistics([8, 10, 12, 16, 18]);
    expect(stats).toMatchObject({
      count: 5,
      average: 12.8,
      rawAverage: 12.8,
      min: 8,
      max: 18,
      median: 12,
      rawMedian: 12,
      passCount: 4,
      passRate: 0.8,
      passRatePercent: 80,
    });
    expect(stats?.distribution.map((band) => [band.code, band.count])).toEqual([
      ['tres_bien', 2],
      ['bien', 0],
      ['assez_bien', 1],
      ['passable', 1],
      ['insuffisant', 1],
      ['tres_insuffisant', 0],
    ]);
  });

  it('prend la moyenne des deux valeurs centrales si l\'effectif est pair', () => {
    const stats = computeStatistics([10, 12, 14, 16]);
    expect(stats?.rawMedian).toBe(13);
    expect(stats?.median).toBe(13);
    expect(stats?.average).toBe(13);
  });

  it('arrondit la médiane paire au centième', () => {
    const stats = computeStatistics([10.01, 10.02]);
    expect(stats?.rawMedian).toBeCloseTo(10.015, 8);
    expect(stats?.median).toBe(10.02);
    expect(stats?.min).toBe(10.01);
    expect(stats?.max).toBe(10.02);
  });

  it('compte 10,00 comme une réussite et 9,99 comme un échec', () => {
    const passing = computeStatistics([10, 9.995, 20]);
    expect(passing?.passCount).toBe(3);
    expect(passing?.passRate).toBe(1);
    expect(passing?.distribution.find((band) => band.code === 'passable')?.count).toBe(2);

    const failing = computeStatistics([9.99, 9.994, 0]);
    expect(failing?.passCount).toBe(0);
    expect(failing?.passRate).toBe(0);
    expect(failing?.passRatePercent).toBe(0);
    expect(failing?.distribution.find((band) => band.code === 'insuffisant')?.count).toBe(2);
    expect(failing?.distribution.find((band) => band.code === 'tres_insuffisant')?.count).toBe(1);
  });

  it('publie chaque valeur avant la moyenne', () => {
    const stats = computeStatistics([9.995, 10.004]);
    expect(stats?.average).toBe(10);
    expect(stats?.min).toBe(10);
    expect(stats?.max).toBe(10);
    expect(stats?.passRate).toBe(1);
  });

  it('gère une seule valeur', () => {
    const stats = computeStatistics([15.555]);
    expect(stats).toMatchObject({
      count: 1,
      average: 15.56,
      min: 15.56,
      max: 15.56,
      median: 15.56,
      passCount: 1,
      passRate: 1,
      passRatePercent: 100,
    });
  });

  it('retourne null sans donnée et ne modifie pas l\'entrée', () => {
    expect(computeStatistics([])).toBeNull();
    const values = [12, 8, 16];
    computeStatistics(values);
    expect(values).toEqual([12, 8, 16]);
  });

  it('aligne la distribution sur le barème, avec des parts qui somment à 1', () => {
    const stats = computeStatistics([0, 8, 10, 12, 14, 16, 20]);
    expect(stats?.distribution.map((band) => band.code)).toEqual(
      APPRECIATION_SCALE.map((band) => band.code),
    );
    expect(stats?.distribution.reduce((sum, band) => sum + band.count, 0)).toBe(7);
    expect(stats?.distribution.reduce((sum, band) => sum + band.ratio, 0)).toBeCloseTo(1, 10);
    expect(stats?.passRatePercent).toBe(71.43);
    expect(stats?.passCount).toBe(5);
  });

  it('refuse une valeur non finie ou hors barème après arrondi', () => {
    expectGradingError('NON_FINITE', () => computeStatistics([12, Number.NaN]));
    expectGradingError('VALUE_OUT_OF_SCALE', () => computeStatistics([20.005]));
    expectGradingError('VALUE_OUT_OF_SCALE', () => computeStatistics([-1]));
    expect(computeStatistics([20.004])?.max).toBe(20);
  });
});
