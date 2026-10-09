import { NO_MATCH, scoreFields } from './scoring';

export interface WeightedField {
  value: string;
  weight: number;
}

export interface ScoredItem<T> {
  item: T;
  score: number;
}

/** Scores every candidate, dropping those without a match. Order is preserved. */
export function scoreCandidates<T>(
  query: string,
  candidates: readonly T[],
  fields: (item: T) => WeightedField[],
  fuzzy = true,
): Array<ScoredItem<T>> {
  const scored: Array<ScoredItem<T>> = [];
  for (const item of candidates) {
    const score = scoreFields(query, fields(item), fuzzy);
    if (score === NO_MATCH) continue;
    scored.push({ item, score });
  }
  return scored;
}

/**
 * Ranks candidates and returns the best `limit`. Ties keep their original
 * relative order so results stay stable for equal scores.
 */
export function rankCandidates<T>(
  query: string,
  candidates: readonly T[],
  fields: (item: T) => WeightedField[],
  limit: number,
  fuzzy = true,
): T[] {
  return scoreCandidates(query, candidates, fields, fuzzy)
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => (b.score === a.score ? a.index - b.index : b.score - a.score))
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.item);
}
