import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface WalkEntry {
  path: string;
  name: string;
  isDirectory: boolean;
}

export interface WalkOptions {
  maxDepth: number;
  /** Return false to skip descending into a directory. */
  shouldDescend?: (entry: WalkEntry) => boolean;
  /** Hard cap on visited entries to bound worst-case I/O. */
  maxEntries?: number;
  onWarn?: (message: string) => void;
}

/**
 * Breadth-first, depth-limited directory walk. Never follows symlinked
 * directories and swallows per-directory errors into `onWarn` so one unreadable
 * folder cannot abort a whole scan.
 */
export async function walk(root: string, options: WalkOptions): Promise<WalkEntry[]> {
  const { maxDepth, shouldDescend, maxEntries = 20_000, onWarn } = options;
  const results: WalkEntry[] = [];
  const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];

  while (queue.length > 0 && results.length < maxEntries) {
    const current = queue.shift();
    if (!current) break;
    let dirents;
    try {
      dirents = await fs.readdir(current.dir, { withFileTypes: true });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'EACCES' && code !== 'EPERM') {
        onWarn?.(`Failed to read ${current.dir}`);
      }
      continue;
    }

    for (const dirent of dirents) {
      if (results.length >= maxEntries) break;
      if (dirent.name.startsWith('.')) continue;
      const full = path.join(current.dir, dirent.name);
      const isDirectory = dirent.isDirectory();
      const entry: WalkEntry = { path: full, name: dirent.name, isDirectory };
      results.push(entry);
      if (
        isDirectory &&
        current.depth < maxDepth &&
        (shouldDescend ? shouldDescend(entry) : true)
      ) {
        queue.push({ dir: full, depth: current.depth + 1 });
      }
    }
  }

  return results;
}

/** Checks that a path exists and is a directory (returns false instead of throwing). */
export async function isDirectory(candidate: string): Promise<boolean> {
  try {
    const stat = await fs.stat(candidate);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/** Lists files inside a directory matching a predicate; empty array on error. */
export async function listFiles(
  dir: string,
  predicate: (name: string) => boolean,
): Promise<string[]> {
  try {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    return dirents
      .filter((dirent) => !dirent.isDirectory() && predicate(dirent.name))
      .map((dirent) => path.join(dir, dirent.name));
  } catch {
    return [];
  }
}
