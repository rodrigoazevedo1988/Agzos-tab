import type { ApplicationSource, RawApplicationRecord } from '@shared/types/application';
import type { Platform } from '@shared/types/platform';

/** Everything an adapter needs to scan the host filesystem. */
export interface DiscoveryContext {
  platform: Platform;
  homeDir: string;
  env: Record<string, string | undefined>;
  /**
   * Explicit roots to scan. When empty the adapter falls back to its platform
   * defaults, which also makes the adapters testable against temp directories.
   */
  roots: string[];
  warn: (message: string) => void;
  /** Recursion depth limit; guards against pathological directory trees. */
  maxDepth?: number;
}

export interface ApplicationAdapter {
  readonly id: string;
  readonly source: ApplicationSource;
  supports(platform: Platform): boolean;
  /** Roots scanned when `context.roots` is empty. */
  defaultRoots(context: DiscoveryContext): string[];
  discover(context: DiscoveryContext): Promise<RawApplicationRecord[]>;
}
