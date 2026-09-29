import { assertNonEmptyId } from './assert';
import { GradingError } from './errors';
import { publishOnScale, toCents } from './rounding';

/** Sens de l'écart entre deux moyennes publiées. */
export type Trend = 'up' | 'down' | 'stable' | 'incomplete';

export type TermSnapshot = {
  id: string;
  label?: string;
  /** Moyenne générale du trimestre. `null` si elle n'a pas pu être calculée. */
  average: number | null;
};

export type PublishedTerm = {
  id: string;
  label?: string;
  average: number | null;
};

export type TermDelta = {
  fromId: string;
  toId: string;
  fromAverage: number | null;
  toAverage: number | null;
  /** Écart des moyennes publiées, au centième. `null` si un trimestre n'a pas de moyenne. */
  delta: number | null;
  trend: Trend;
};

export type TermExtreme = {
  id: string;
  average: number;
};

export type TermComparison = {
  /** Trimestres dans l'ordre chronologique fourni, moyennes publiées. */
  terms: PublishedTerm[];
  /** Écart de chaque trimestre vers le suivant. */
  consecutive: TermDelta[];
  /** Écart du premier au dernier. `null` s'il y a moins de deux trimestres. */
  fromFirstToLast: TermDelta | null;
  /** Plus haute moyenne. En cas d'égalité, le trimestre le plus ancien. */
  highest: TermExtreme | null;
  /** Plus basse moyenne. En cas d'égalité, le trimestre le plus ancien. */
  lowest: TermExtreme | null;
};

/**
 * Compare des trimestres dans l'ordre du tableau (T1, T2, T3…).
 * L'écart est calculé en centièmes entiers pour rester exact.
 * Hausse si delta > 0, baisse si delta < 0, stable si delta = 0.
 */
export function compareTerms(terms: readonly TermSnapshot[]): TermComparison {
  const seen = new Set<string>();
  const published = terms.map((term) => {
    assertNonEmptyId(term.id, "L'identifiant de trimestre");
    if (seen.has(term.id)) {
      throw new GradingError('DUPLICATE_ID', `Le trimestre « ${term.id} » est en double.`);
    }
    seen.add(term.id);

    return {
      id: term.id,
      label: term.label,
      average:
        term.average === null
          ? null
          : publishOnScale(term.average, `La moyenne de « ${term.id} »`),
    };
  });

  const consecutive: TermDelta[] = [];
  for (let index = 1; index < published.length; index += 1) {
    consecutive.push(deltaBetween(published[index - 1], published[index]));
  }

  const withAverage = published.filter((term) => term.average !== null);
  const highest = extreme(withAverage, 'highest');
  const lowest = extreme(withAverage, 'lowest');

  return {
    terms: published,
    consecutive,
    fromFirstToLast:
      published.length >= 2 ? deltaBetween(published[0], published[published.length - 1]) : null,
    highest,
    lowest,
  };
}

function deltaBetween(from: PublishedTerm, to: PublishedTerm): TermDelta {
  if (from.average === null || to.average === null) {
    return {
      fromId: from.id,
      toId: to.id,
      fromAverage: from.average,
      toAverage: to.average,
      delta: null,
      trend: 'incomplete',
    };
  }

  const delta = (toCents(to.average) - toCents(from.average)) / 100;
  return {
    fromId: from.id,
    toId: to.id,
    fromAverage: from.average,
    toAverage: to.average,
    delta,
    trend: delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable',
  };
}

function extreme(terms: readonly PublishedTerm[], kind: 'highest' | 'lowest'): TermExtreme | null {
  if (terms.length === 0) {
    return null;
  }

  let selected = terms[0];
  for (const term of terms.slice(1)) {
    const better =
      kind === 'highest'
        ? (term.average as number) > (selected.average as number)
        : (term.average as number) < (selected.average as number);
    if (better) {
      selected = term;
    }
  }

  return { id: selected.id, average: selected.average as number };
}
