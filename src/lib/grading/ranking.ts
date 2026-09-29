import { publishOnScale, toCents } from './rounding';

export type RankedItem<T> = {
  item: T;
  /** Position d'origine, pour départager les ex æquo de façon stable. */
  index: number;
  /** Score publié (centième). `null` si non classé. */
  score: number | null;
  /** Score fourni, avant arrondi. */
  rawScore: number | null;
  /**
   * Rang de compétition (1, 2, 2, 4). `null` si l'élément n'a pas de score :
   * il n'est pas classé et n'est pas traité comme un 0.
   */
  rank: number | null;
};

/**
 * Classement de compétition, du meilleur score au plus faible.
 * Deux scores qui s'affichent au même centième sont ex æquo et partagent
 * le meilleur rang ; le suivant est sauté. L'ordre d'entrée départage
 * l'affichage des ex æquo. Les scores `null` ferment la liste, sans rang.
 */
export function rankCompetition<T>(
  items: readonly T[],
  getScore: (item: T) => number | null,
): RankedItem<T>[] {
  const ranked: RankedItem<T>[] = items.map((item, index) => {
    const rawScore = getScore(item);
    if (rawScore === null) {
      return { item, index, score: null, rawScore: null, rank: null };
    }
    const score = publishOnScale(rawScore, 'Le score');
    return { item, index, score, rawScore, rank: null };
  });

  const scored = ranked
    .filter((entry) => entry.score !== null)
    .sort((a, b) => toCents(b.score as number) - toCents(a.score as number) || a.index - b.index);
  const unscored = ranked.filter((entry) => entry.score === null);

  let lastCents: number | null = null;
  for (let position = 0; position < scored.length; position += 1) {
    const cents = toCents(scored[position].score as number);
    if (lastCents === null || cents !== lastCents) {
      scored[position].rank = position + 1;
      lastCents = cents;
    } else {
      scored[position].rank = scored[position - 1].rank;
    }
  }

  return [...scored, ...unscored];
}
