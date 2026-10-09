import { z } from 'zod';

import {
  DEFAULT_GLOBAL_SHORTCUT,
  DEFAULT_SEARCH_LIMIT,
  MAX_HISTORY_LIMIT,
  MAX_SEARCH_LIMIT,
  MIN_HISTORY_LIMIT,
  SETTINGS_SCHEMA_VERSION,
} from './constants';

/**
 * Central settings contract. Persisted as JSON and validated on every read and
 * on import, so a corrupted or hand-edited file can never crash the app.
 */
export const settingsSchema = z.object({
  schemaVersion: z.number().int().nonnegative(),
  appearance: z.object({
    theme: z.enum(['dark', 'light', 'system']),
    accent: z.enum(['blue', 'violet', 'emerald']),
  }),
  shortcuts: z.object({
    global: z.string().min(1).max(64),
    clearSearch: z.string().min(1).max(64),
  }),
  startup: z.object({
    launchAtLogin: z.boolean(),
    startMinimized: z.boolean(),
  }),
  search: z.object({
    maxResults: z.number().int().min(1).max(MAX_SEARCH_LIMIT),
    includeApplications: z.boolean(),
    includeFileSearch: z.boolean(),
    fuzzy: z.boolean(),
    prioritizeFavorites: z.boolean(),
    prioritizeRecent: z.boolean(),
  }),
  history: z.object({
    enabled: z.boolean(),
    maxEntries: z.number().int().min(MIN_HISTORY_LIMIT).max(MAX_HISTORY_LIMIT),
  }),
  favorites: z.object({
    ids: z.array(z.string().min(1)).max(200),
  }),
  extensions: z.object({
    enabled: z.record(z.string(), z.boolean()),
  }),
  ai: z.object({
    enabled: z.boolean(),
    provider: z.enum(['none', 'openai-compatible', 'local']),
    model: z.string().max(120),
    // NOTE: never store credentials here. Secrets go to the OS keychain.
    sendClipboardContext: z.boolean(),
  }),
  privacy: z.object({
    telemetry: z.boolean(),
    persistHistory: z.boolean(),
  }),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingsPatch = DeepPartial<Settings>;

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<unknown>
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export function defaultSettings(): Settings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    appearance: { theme: 'dark', accent: 'blue' },
    shortcuts: {
      global: DEFAULT_GLOBAL_SHORTCUT,
      clearSearch: 'CommandOrControl+K',
    },
    startup: { launchAtLogin: false, startMinimized: false },
    search: {
      maxResults: DEFAULT_SEARCH_LIMIT,
      includeApplications: true,
      includeFileSearch: false,
      fuzzy: true,
      prioritizeFavorites: true,
      prioritizeRecent: true,
    },
    history: { enabled: true, maxEntries: 50 },
    favorites: { ids: [] },
    extensions: { enabled: {} },
    ai: { enabled: false, provider: 'none', model: '', sendClipboardContext: false },
    privacy: { telemetry: false, persistHistory: true },
  };
}

/**
 * Deep-merges a validated partial over a base, ignoring `undefined` values so a
 * patch can never erase a whole section unintentionally.
 */
export function mergeSettings(base: Settings, patch: SettingsPatch): Settings {
  const merge = (target: unknown, source: unknown): unknown => {
    if (source === null || typeof source !== 'object' || Array.isArray(source)) {
      return source === undefined ? target : source;
    }
    const result: Record<string, unknown> = {
      ...(typeof target === 'object' && target !== null ? (target as Record<string, unknown>) : {}),
    };
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      if (value === undefined) continue;
      result[key] = merge(result[key], value);
    }
    return result;
  };
  return merge(base, patch) as Settings;
}

export interface MigrationResult {
  settings: Settings;
  migrated: boolean;
}

/**
 * Migrates a raw persisted document up to the current schema version.
 * Unknown or older versions are reset to defaults for the missing sections
 * while preserving whatever still validates.
 */
export function migrateSettings(raw: unknown): MigrationResult {
  const defaults = defaultSettings();
  if (raw === null || typeof raw !== 'object') {
    return { settings: defaults, migrated: true };
  }
  const record = raw as Record<string, unknown>;
  const version = typeof record.schemaVersion === 'number' ? record.schemaVersion : 0;

  if (version === SETTINGS_SCHEMA_VERSION) {
    const parsed = settingsSchema.safeParse(record);
    return parsed.success
      ? { settings: parsed.data, migrated: false }
      : { settings: defaults, migrated: true };
  }

  // Forward-compatible migration path: newest-known fields win, everything
  // unknown falls back to defaults. Future breaking changes add cases here.
  const merged = mergeSettings(defaults, record as SettingsPatch);
  merged.schemaVersion = SETTINGS_SCHEMA_VERSION;
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success
    ? { settings: parsed.data, migrated: true }
    : { settings: defaults, migrated: true };
}
