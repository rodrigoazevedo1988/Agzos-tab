import { describe, expect, it } from 'vitest';

import { HistoryService } from '@main/services/history-service';

import { makeTempDir } from '../helpers/temp-dir';

function makeService(dir: string, maxEntries = 3): HistoryService {
  return new HistoryService(dir, () => ({ enabled: true, maxEntries }));
}

describe('HistoryService', () => {
  it('records most recent first', async () => {
    const dir = await makeTempDir();
    const service = makeService(dir);
    await service.record({ id: 'a', kind: 'command', title: 'A' });
    await service.record({ id: 'b', kind: 'command', title: 'B' });
    expect((await service.list()).map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('de-duplicates entries by moving them to the front', async () => {
    const dir = await makeTempDir();
    const service = makeService(dir);
    await service.record({ id: 'a', kind: 'command', title: 'A' });
    await service.record({ id: 'b', kind: 'command', title: 'B' });
    await service.record({ id: 'a', kind: 'command', title: 'A' });
    const entries = await service.list();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.id).toBe('a');
  });

  it('trims to the configured limit', async () => {
    const dir = await makeTempDir();
    const service = makeService(dir, 2);
    await service.record({ id: 'a', kind: 'command', title: 'A' });
    await service.record({ id: 'b', kind: 'command', title: 'B' });
    await service.record({ id: 'c', kind: 'command', title: 'C' });
    expect((await service.list()).map((entry) => entry.id)).toEqual(['c', 'b']);
  });

  it('does not record anything when disabled', async () => {
    const dir = await makeTempDir();
    const service = new HistoryService(dir, () => ({ enabled: false, maxEntries: 10 }));
    await service.record({ id: 'a', kind: 'command', title: 'A' });
    expect(await service.list()).toEqual([]);
  });

  it('removes individual entries and clears everything', async () => {
    const dir = await makeTempDir();
    const service = makeService(dir);
    await service.record({ id: 'a', kind: 'command', title: 'A' });
    await service.record({ id: 'b', kind: 'command', title: 'B' });
    await service.remove('a');
    expect((await service.list()).map((entry) => entry.id)).toEqual(['b']);
    await service.clear();
    expect(await service.list()).toEqual([]);
  });

  it('persists across instances', async () => {
    const dir = await makeTempDir();
    await makeService(dir).record({ id: 'a', kind: 'application', title: 'App' });
    expect((await makeService(dir).list())[0]?.id).toBe('a');
  });

  it('computes a recency ranking', async () => {
    const dir = await makeTempDir();
    const service = makeService(dir);
    await service.record({ id: 'a', kind: 'command', title: 'A' });
    await service.record({ id: 'b', kind: 'command', title: 'B' });
    const ranking = await service.recencyRanking();
    expect(ranking.get('b')).toBe(0);
    expect(ranking.get('a')).toBe(1);
  });

  it('only persists non-sensitive fields', async () => {
    const dir = await makeTempDir();
    const service = makeService(dir);
    await service.record({ id: 'a', kind: 'command', title: 'A' });
    const [entry] = await service.list();
    expect(Object.keys(entry ?? {}).sort()).toEqual(['executedAt', 'id', 'kind', 'title']);
  });
});
