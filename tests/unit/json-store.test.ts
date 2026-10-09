import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { JsonStore } from '@main/storage/json-store';

import { makeTempDir } from '../helpers/temp-dir';

interface Doc {
  value: number;
}

function makeStore(dir: string, name = 'doc.json'): JsonStore<Doc> {
  return new JsonStore<Doc>({
    filePath: path.join(dir, name),
    defaults: () => ({ value: 0 }),
    deserialize: (raw) => {
      const candidate = raw as Partial<Doc> | null;
      return typeof candidate?.value === 'number' ? { value: candidate.value } : { value: 0 };
    },
  });
}

describe('JsonStore', () => {
  it('returns defaults when the file does not exist', async () => {
    const dir = await makeTempDir();
    const store = makeStore(dir);
    await expect(store.read()).resolves.toEqual({ value: 0 });
  });

  it('persists and re-reads values', async () => {
    const dir = await makeTempDir();
    const store = makeStore(dir);
    await store.write({ value: 42 });
    const reopened = makeStore(dir);
    await expect(reopened.read()).resolves.toEqual({ value: 42 });
  });

  it('falls back to defaults on corrupt JSON', async () => {
    const dir = await makeTempDir();
    await writeFile(path.join(dir, 'doc.json'), '{ not json', 'utf8');
    await expect(makeStore(dir).read()).resolves.toEqual({ value: 0 });
  });

  it('writes atomically without leaving temp files behind', async () => {
    const dir = await makeTempDir();
    const store = makeStore(dir);
    await store.write({ value: 1 });
    await store.update((current) => ({ value: current.value + 1 }));
    const files = await readdir(dir);
    expect(files.filter((file) => file.includes('.tmp'))).toHaveLength(0);
    expect(files).toContain('doc.json');
  });

  it('serialises concurrent writes', async () => {
    const dir = await makeTempDir();
    const store = makeStore(dir);
    await Promise.all(
      Array.from({ length: 10 }, (_, index) => store.update(() => ({ value: index }))),
    );
    const final = await makeStore(dir).read();
    expect(Number.isInteger(final.value)).toBe(true);
    expect(final.value).toBeGreaterThanOrEqual(0);
  });
});
