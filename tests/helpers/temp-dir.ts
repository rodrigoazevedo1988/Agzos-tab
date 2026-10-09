import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach } from 'vitest';

const created: string[] = [];

/** Creates a unique temporary directory and registers it for cleanup. */
export async function makeTempDir(prefix = 'agzos-test-'): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  created.push(dir);
  return dir;
}

/** Writes a file, creating parent directories as needed. */
export async function writeFixture(
  root: string,
  relativePath: string,
  contents: string,
): Promise<string> {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents, 'utf8');
  return target;
}

/** Creates a directory (and parents) under `root`. */
export async function makeFixtureDir(root: string, relativePath: string): Promise<string> {
  const target = path.join(root, relativePath);
  await mkdir(target, { recursive: true });
  return target;
}

afterEach(async () => {
  const dirs = created.splice(0, created.length);
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }).catch(() => {})));
});
