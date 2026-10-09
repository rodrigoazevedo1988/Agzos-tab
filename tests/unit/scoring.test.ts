import { describe, expect, it } from 'vitest';

import {
  NO_MATCH,
  fuzzyScore,
  normalize,
  scoreCandidate,
  scoreFields,
} from '@main/services/search/scoring';

describe('normalize', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalize('Café')).toBe('cafe');
    expect(normalize('  CALCULADORA ')).toBe('calculadora');
  });
});

describe('scoreCandidate', () => {
  it('ranks exact matches above prefixes above substrings', () => {
    const exact = scoreCandidate('calc', 'calc');
    const prefix = scoreCandidate('calc', 'calculator');
    const substring = scoreCandidate('calc', 'the calculator app');
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(substring);
  });

  it('matches across word boundaries', () => {
    const score = scoreCandidate('copy', 'Copy Text to Clipboard');
    expect(score).toBeGreaterThan(0);
  });

  it('returns NO_MATCH when nothing matches and fuzzy is off', () => {
    expect(scoreCandidate('zzz', 'calculator', false)).toBe(NO_MATCH);
  });

  it('matches ordered subsequences when fuzzy is on', () => {
    expect(scoreCandidate('clc', 'calculator', true)).toBeGreaterThan(0);
  });

  it('is diacritic and case insensitive', () => {
    expect(scoreCandidate('CAFE', 'café')).toBeGreaterThan(0);
  });

  it('scores an empty query as neutral', () => {
    expect(scoreCandidate('', 'anything')).toBe(0);
  });
});

describe('fuzzyScore', () => {
  it('rewards contiguous matches over gapped ones', () => {
    const contiguous = fuzzyScore('abc', 'abcdef');
    const gapped = fuzzyScore('abc', 'axbxcx');
    expect(contiguous).toBeGreaterThan(gapped);
  });

  it('rejects out-of-order characters', () => {
    expect(fuzzyScore('ba', 'ab')).toBe(NO_MATCH);
  });
});

describe('scoreFields', () => {
  it('applies field weights', () => {
    const high = scoreFields('calc', [
      { value: 'calculator', weight: 1.5 },
      { value: 'calculator', weight: 0.5 },
    ]);
    const low = scoreFields('calc', [{ value: 'calculator', weight: 0.5 }]);
    expect(high).toBeGreaterThan(low);
  });

  it('returns NO_MATCH when no field matches', () => {
    expect(scoreFields('nope', [{ value: 'calc', weight: 1 }])).toBe(NO_MATCH);
  });
});
