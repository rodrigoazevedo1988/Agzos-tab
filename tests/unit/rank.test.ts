import { describe, expect, it } from 'vitest';

import { rankCandidates, scoreCandidates } from '@main/services/search/rank';

const items = [{ name: 'Calculator' }, { name: 'Calendar' }, { name: 'Camera' }];

describe('rankCandidates', () => {
  it('returns the best match first', () => {
    const ranked = rankCandidates('calc', items, (item) => [{ value: item.name, weight: 1 }], 5);
    expect(ranked[0]?.name).toBe('Calculator');
  });

  it('respects the limit', () => {
    const ranked = rankCandidates('ca', items, (item) => [{ value: item.name, weight: 1 }], 2);
    expect(ranked).toHaveLength(2);
  });

  it('keeps a stable order for equal scores', () => {
    const tied = [{ name: 'Same' }, { name: 'Same' }];
    const ranked = rankCandidates('same', tied, (item) => [{ value: item.name, weight: 1 }], 5);
    expect(ranked).toHaveLength(2);
    expect(ranked.map((item) => item.name)).toEqual(['Same', 'Same']);
  });

  it('drops non-matching candidates', () => {
    const ranked = rankCandidates('zzz', items, (item) => [{ value: item.name, weight: 1 }], 5);
    expect(ranked).toHaveLength(0);
  });
});

describe('scoreCandidates', () => {
  it('exposes raw scores', () => {
    const scored = scoreCandidates('calc', items, (item) => [{ value: item.name, weight: 1 }]);
    expect(scored.length).toBeGreaterThan(0);
    expect(scored[0]?.score).toBeGreaterThan(0);
  });
});
