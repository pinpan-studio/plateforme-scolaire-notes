import { describe, expect, it } from 'vitest';
import { rankCompetition } from '../ranking';
import { expectGradingError } from './helpers';

type Student = { id: string; score: number | null };

const rankOf = (scores: Array<number | null>) =>
  rankCompetition(scores, (score) => score).map((entry) => entry.rank);

describe('rankCompetition', () => {
  it('classe en compétition avec ex æquo : 1, 2, 2, 4', () => {
    expect(rankOf([18, 15, 15, 10])).toEqual([1, 2, 2, 4]);
  });

  it('saute le rang après un ex æquo triple', () => {
    expect(rankOf([10, 10, 10, 9])).toEqual([1, 1, 1, 4]);
  });

  it('donne le rang 1 à tout le monde en cas d\'égalité générale', () => {
    const ranked = rankCompetition(['a', 'b', 'c'], () => 12);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 1, 1]);
    expect(ranked.map((entry) => entry.item)).toEqual(['a', 'b', 'c']);
  });

  it('classe un seul élément, un tableau vide, ou que des scores absents', () => {
    expect(rankOf([15])).toEqual([1]);
    expect(rankCompetition([], () => 0)).toEqual([]);
    const unranked = rankCompetition([null, null], (score) => score);
    expect(unranked.map((entry) => entry.rank)).toEqual([null, null]);
    expect(unranked.map((entry) => entry.index)).toEqual([0, 1]);
  });

  it('conserve l\'ordre d\'entrée des ex æquo', () => {
    const students: Student[] = [
      { id: 'a', score: 15 },
      { id: 'b', score: 18 },
      { id: 'c', score: 15 },
      { id: 'd', score: 10 },
    ];
    const ranked = rankCompetition(students, (student) => student.score);
    expect(ranked.map((entry) => [entry.item.id, entry.rank])).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 2],
      ['d', 4],
    ]);
    expect(students.map((student) => student.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ne classe pas un score null et ne le traite pas comme zéro', () => {
    const ranked = rankCompetition(
      [
        { id: 'haut', score: 10 },
        { id: 'absent', score: null },
        { id: 'zero', score: 0 },
      ],
      (student) => student.score,
    );
    expect(ranked.map((entry) => [entry.item.id, entry.rank, entry.score])).toEqual([
      ['haut', 1, 10],
      ['zero', 2, 0],
      ['absent', null, null],
    ]);
  });

  it('regroupe les scores qui s\'affichent au même centième', () => {
    const ranked = rankCompetition(
      [
        { id: 'bas', score: 13.994 },
        { id: 'a', score: 14.004 },
        { id: 'b', score: 13.996 },
      ],
      (student) => student.score,
    );
    expect(ranked.map((entry) => [entry.item.id, entry.score, entry.rank])).toEqual([
      ['a', 14, 1],
      ['b', 14, 1],
      ['bas', 13.99, 3],
    ]);
  });

  it('place le meilleur score en premier', () => {
    const ranked = rankCompetition([5, 6, 5], (score) => score);
    expect(ranked.map((entry) => [entry.score, entry.rank])).toEqual([
      [6, 1],
      [5, 2],
      [5, 2],
    ]);
  });

  it('accepte les bornes 0 et 20', () => {
    const ranked = rankCompetition([20, 0], (score) => score);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2]);
    expect(ranked[0].score).toBe(20);
    expect(ranked[1].score).toBe(0);
  });

  it('refuse un score non fini ou hors barème', () => {
    expectGradingError('NON_FINITE', () => rankCompetition([Number.NaN], (score) => score));
    expectGradingError('VALUE_OUT_OF_SCALE', () => rankCompetition([21], (score) => score));
    expectGradingError('VALUE_OUT_OF_SCALE', () => rankCompetition([-0.01], (score) => score));
    expect(rankOf([20.004])).toEqual([1]);
  });
});
