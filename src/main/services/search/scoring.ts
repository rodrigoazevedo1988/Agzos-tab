/**
 * Text scoring used by the universal search.
 *
 * The functions here are pure and dependency-free so they can be unit tested
 * without Electron. Higher scores are better; `-1` means "no match".
 */

/** Lowercases and strips diacritics so "café" matches "cafe". */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export const NO_MATCH = -1;

const EXACT_BONUS = 1000;
const PREFIX_BONUS = 600;
const WORD_PREFIX_BONUS = 450;
const SUBSTRING_BONUS = 250;

/**
 * Scores a single `query` against one `candidate` string.
 *
 * Tiers, best first: exact match, prefix, word-boundary prefix, substring, then
 * an ordered subsequence ("fuzzy") match when `fuzzy` is enabled.
 */
export function scoreCandidate(query: string, candidate: string, fuzzy = true): number {
  const q = normalize(query);
  const c = normalize(candidate);
  if (q.length === 0) return 0;
  if (c.length === 0) return NO_MATCH;

  if (q === c) return EXACT_BONUS + coverageBonus(q, c);
  if (c.startsWith(q)) return PREFIX_BONUS + coverageBonus(q, c);

  const wordIndex = c.search(new RegExp(`(^|[^a-z0-9])${escapeRegExp(q)}`));
  if (wordIndex >= 0) return WORD_PREFIX_BONUS + coverageBonus(q, c);

  const substringIndex = c.indexOf(q);
  if (substringIndex >= 0) {
    return SUBSTRING_BONUS + coverageBonus(q, c) - Math.min(substringIndex, 50);
  }

  return fuzzy ? fuzzyScore(q, c) : NO_MATCH;
}

/** Ordered-subsequence match with penalties for gaps and late starts. */
export function fuzzyScore(query: string, candidate: string): number {
  const q = normalize(query);
  const c = normalize(candidate);
  if (q.length === 0) return 0;
  if (q.length > c.length) return NO_MATCH;

  let cursor = 0;
  let score = 0;
  let previousIndex = -1;
  let firstIndex = -1;

  for (const char of q) {
    const found = c.indexOf(char, cursor);
    if (found === -1) return NO_MATCH;
    if (firstIndex === -1) firstIndex = found;
    if (previousIndex !== -1) {
      const gap = found - previousIndex - 1;
      if (gap === 0) score += 12;
      else score -= gap * 3;
    }
    previousIndex = found;
    cursor = found + 1;
  }

  score -= firstIndex * 2;
  return Math.max(1, 100 + score + coverageBonus(q, c));
}

/** Bonus for how much of the candidate the query covers (0–40). */
function coverageBonus(query: string, candidate: string): number {
  if (candidate.length === 0) return 0;
  return Math.round((query.length / candidate.length) * 40);
}

/**
 * Best score across a set of searchable fields. `weights` scales each field so
 * a name match can outrank a keyword match.
 */
export function scoreFields(
  query: string,
  fields: Array<{ value: string; weight: number }>,
  fuzzy = true,
): number {
  let best = NO_MATCH;
  for (const field of fields) {
    if (!field.value) continue;
    const raw = scoreCandidate(query, field.value, fuzzy);
    if (raw === NO_MATCH) continue;
    best = Math.max(best, raw * field.weight);
  }
  return best;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
}
