import { promises as fs } from 'node:fs';
import path from 'node:path';

import { createLogger } from '../logger';
import { rankCandidates } from '../services/search/rank';
import { JsonStore } from '../storage/json-store';

import { isPathTarget, parseExecCommand } from './launcher';
import { normalizeRecords } from './normalize';
import { darwinAdapter } from './adapters/darwin';
import { linuxAdapter } from './adapters/linux';
import { win32Adapter } from './adapters/win32';

import type { ApplicationAdapter, DiscoveryContext } from './types';
import type { Platform } from '@shared/types/platform';
import type { ApplicationCatalog, ApplicationEntry } from '@shared/types/application';

const log = createLogger('applications');

export const ADAPTERS: readonly ApplicationAdapter[] = [darwinAdapter, win32Adapter, linuxAdapter];

export interface ApplicationsCatalogOptions {
  platform: Platform;
  homeDir: string;
  env: Record<string, string | undefined>;
  /** Directory for the persisted cache. Omit to disable persistence. */
  cacheDir?: string;
  adapters?: readonly ApplicationAdapter[];
  maxDepth?: number;
}

interface CachedCatalog {
  version: number;
  catalog: ApplicationCatalog;
}

const CACHE_VERSION = 1;

/**
 * Holds the discovered application list.
 *
 * Scanning is lazy — the first lookup triggers it, never app boot — and the
 * result is persisted so subsequent launches are instant. Because applications
 * come and go, every launch revalidates the target on disk before opening it.
 */
export class ApplicationsCatalog {
  private readonly options: ApplicationsCatalogOptions;
  private readonly adapters: readonly ApplicationAdapter[];
  private readonly cache: JsonStore<CachedCatalog> | null;
  private catalog: ApplicationCatalog | null = null;
  private scanPromise: Promise<ApplicationCatalog> | null = null;

  constructor(options: ApplicationsCatalogOptions) {
    this.options = options;
    this.adapters = (options.adapters ?? ADAPTERS).filter((adapter) =>
      adapter.supports(options.platform),
    );
    this.cache = options.cacheDir
      ? new JsonStore<CachedCatalog>({
          filePath: path.join(options.cacheDir, 'applications-cache.json'),
          defaults: () => ({ version: CACHE_VERSION, catalog: emptyCatalog(options.platform) }),
          deserialize: (raw) => {
            const candidate = raw as CachedCatalog | null;
            if (
              candidate &&
              candidate.version === CACHE_VERSION &&
              candidate.catalog &&
              Array.isArray(candidate.catalog.entries)
            ) {
              return candidate;
            }
            return { version: CACHE_VERSION, catalog: emptyCatalog(options.platform) };
          },
        })
      : null;
  }

  /** Loads the persisted cache (fast path) without triggering a scan. */
  async loadCache(): Promise<ApplicationCatalog | null> {
    if (this.adapters.length === 0 || !this.cache) return null;
    const cached = await this.cache.read();
    if (cached.catalog.entries.length === 0) return null;
    this.catalog = cached.catalog;
    return this.catalog;
  }

  /** Full rescan. Concurrent callers share a single in-flight scan. */
  async refresh(roots: string[] = []): Promise<ApplicationCatalog> {
    if (this.scanPromise) return this.scanPromise;

    this.scanPromise = (async () => {
      const warnings: string[] = [];
      const platform = this.options.platform;
      const context: DiscoveryContext = {
        platform,
        homeDir: this.options.homeDir,
        env: this.options.env,
        roots,
        warn: (message) => warnings.push(message),
        maxDepth: this.options.maxDepth ?? 5,
      };

      const records = (
        await Promise.all(this.adapters.map((adapter) => adapter.discover(context)))
      ).flat();

      const catalog: ApplicationCatalog = {
        platform,
        scannedAt: new Date().toISOString(),
        entries: normalizeRecords(records, platform),
        warnings,
      };

      this.catalog = catalog;
      log.info(`Discovered ${catalog.entries.length} applications`);
      if (this.cache) {
        await this.cache.write({ version: CACHE_VERSION, catalog }).catch(() => {
          log.warn('Could not persist the application cache');
        });
      }
      return catalog;
    })();

    try {
      return await this.scanPromise;
    } finally {
      this.scanPromise = null;
    }
  }

  /** Returns the current catalog, using the persisted cache when available. */
  async list(): Promise<ApplicationEntry[]> {
    if (this.catalog) return this.catalog.entries;
    const cached = await this.loadCache();
    if (cached) return cached.entries;
    if (this.adapters.length === 0) return [];
    return (await this.refresh()).entries;
  }

  async getById(id: string): Promise<ApplicationEntry | undefined> {
    return (await this.list()).find((entry) => entry.id === id);
  }

  /**
   * Revalidates an entry before it is launched.
   *
   * Absolute targets are re-checked on disk because cached catalogs go stale.
   * Bare commands (Linux `.desktop` `Exec` values) are validated structurally
   * here and resolved against `PATH` at launch time.
   */
  async resolveLaunchTarget(id: string): Promise<{ entry: ApplicationEntry } | { error: string }> {
    const entry = await this.getById(id);
    if (!entry) return { error: 'Application not found in the catalog' };

    if (isPathTarget(entry.launchTarget)) {
      try {
        await fs.access(entry.launchTarget);
      } catch {
        return { error: `Application is no longer available: ${entry.name}` };
      }
    } else if (parseExecCommand(entry.launchTarget).command.length === 0) {
      return { error: `Application "${entry.name}" has an invalid launch command` };
    }

    return { entry };
  }

  async search(query: string, limit: number): Promise<ApplicationEntry[]> {
    const entries = await this.list();
    return rankCandidates(
      query,
      entries,
      (entry) => [
        { value: entry.name, weight: 1.4 },
        { value: entry.keywords.join(' '), weight: 1 },
      ],
      limit,
    );
  }
}

function emptyCatalog(platform: Platform): ApplicationCatalog {
  return { platform, scannedAt: new Date(0).toISOString(), entries: [], warnings: [] };
}
