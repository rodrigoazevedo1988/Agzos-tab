import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { createLogger } from '../logger';

const log = createLogger('store');

export interface JsonStoreOptions<T> {
  filePath: string;
  defaults: () => T;
  /** Validates/migrates a raw parsed value. Must always return a usable value. */
  deserialize: (raw: unknown) => T;
}

/**
 * Small JSON document store with atomic writes.
 *
 * Writes go to a sibling temp file and are then `rename`d over the target, so a
 * crash mid-write can never leave a half-written, unparseable document.
 */
export class JsonStore<T> {
  private readonly filePath: string;
  private readonly defaults: () => T;
  private readonly deserialize: (raw: unknown) => T;
  private cache: T | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(options: JsonStoreOptions<T>) {
    this.filePath = options.filePath;
    this.defaults = options.defaults;
    this.deserialize = options.deserialize;
  }

  get path(): string {
    return this.filePath;
  }

  async read(): Promise<T> {
    if (this.cache !== null) return this.cache;
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      this.cache = this.deserialize(JSON.parse(raw) as unknown);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        log.warn(`Could not read ${path.basename(this.filePath)}; using defaults`, {
          reason: (error as Error).name,
        });
      }
      this.cache = this.defaults();
    }
    return this.cache;
  }

  /** Queues an atomic write; concurrent callers are serialised. */
  async write(value: T): Promise<void> {
    this.cache = value;
    const run = async (): Promise<void> => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.${randomBytes(6).toString('hex')}.tmp`;
      await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      await fs.rename(tmp, this.filePath);
    };
    this.writeChain = this.writeChain.then(run, run);
    return this.writeChain;
  }

  async update(mutate: (current: T) => T): Promise<T> {
    const current = await this.read();
    const next = mutate(current);
    await this.write(next);
    return next;
  }

  /** Drops the in-memory cache so the next read hits disk. */
  invalidate(): void {
    this.cache = null;
  }
}
