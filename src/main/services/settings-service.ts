import { EventEmitter } from 'node:events';
import path from 'node:path';

import {
  defaultSettings,
  migrateSettings,
  settingsSchema,
  type Settings,
  type SettingsPatch,
} from '@shared/settings-schema';

import { createLogger } from '../logger';
import { JsonStore } from '../storage/json-store';

const log = createLogger('settings');

/** Keys that must never be written to or read from the settings document. */
const FORBIDDEN_SECRET_KEYS = ['apiKey', 'api_key', 'token', 'password', 'secret', 'credential'];

export interface SettingsImportOutcome {
  settings: Settings;
  warnings: string[];
}

export interface SettingsServiceEvents {
  changed: [Settings];
}

export class SettingsService extends EventEmitter {
  private readonly store: JsonStore<Settings>;
  private settings: Settings = defaultSettings();

  constructor(userDataDir: string) {
    super();
    this.store = new JsonStore<Settings>({
      filePath: path.join(userDataDir, 'settings.json'),
      defaults: defaultSettings,
      deserialize: (raw) => {
        const { settings, migrated } = migrateSettings(raw);
        if (migrated) log.info('Settings migrated to the current schema version');
        return settings;
      },
    });
  }

  async init(): Promise<Settings> {
    this.settings = await this.store.read();
    return this.settings;
  }

  get(): Settings {
    return this.settings;
  }

  async update(patch: SettingsPatch): Promise<Settings> {
    const candidate = settingsSchema.safeParse({
      ...this.settings,
      ...mergeShallowValidated(this.settings, patch),
      schemaVersion: this.settings.schemaVersion,
    });

    if (!candidate.success) {
      // Reject invalid patches outright instead of persisting a corrupt document.
      throw new Error(`Invalid settings patch: ${candidate.error.issues[0]?.message ?? 'unknown'}`);
    }

    this.settings = candidate.data;
    await this.store.write(this.settings);
    this.emit('changed', this.settings);
    return this.settings;
  }

  async reset(): Promise<Settings> {
    this.settings = defaultSettings();
    await this.store.write(this.settings);
    this.emit('changed', this.settings);
    return this.settings;
  }

  /** Serialises the current settings as pretty JSON, free of any secret field. */
  async export(): Promise<string> {
    return `${JSON.stringify(sanitizeForExport(this.settings), null, 2)}\n`;
  }

  /**
   * Validates and imports a settings document. The previous configuration is
   * left untouched when the payload is invalid.
   */
  async import(serialized: string): Promise<SettingsImportOutcome> {
    if (typeof serialized !== 'string' || serialized.length > 256 * 1024) {
      throw new Error('Settings payload is empty or too large');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized) as unknown;
    } catch {
      throw new Error('Settings payload is not valid JSON');
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Settings payload must be a JSON object');
    }

    const { settings, migrated } = migrateSettings(parsed);
    const parsedSettings = settingsSchema.parse(settings);
    const warnings = collectUnknownKeyWarnings(parsed, parsedSettings);
    if (migrated) warnings.push('Imported settings were migrated to the current schema version.');

    this.settings = parsedSettings;
    await this.store.write(this.settings);
    this.emit('changed', this.settings);
    return { settings: this.settings, warnings };
  }
}

/** Deep-merges a patch but keeps the merge result untyped for schema validation. */
function mergeShallowValidated(base: Settings, patch: SettingsPatch): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [section, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const current = out[section];
      out[section] = {
        ...(current && typeof current === 'object' ? (current as object) : {}),
        ...value,
      };
    } else {
      out[section] = value;
    }
  }
  return out;
}

/** Removes any defensive secret-like top-level keys from an exported document. */
function sanitizeForExport(settings: Settings): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(settings)) as Record<string, unknown>;
  const strip = (node: Record<string, unknown>): void => {
    for (const key of Object.keys(node)) {
      if (FORBIDDEN_SECRET_KEYS.includes(key.toLowerCase())) {
        delete node[key];
        continue;
      }
      const value = node[key];
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        strip(value as Record<string, unknown>);
      }
    }
  };
  strip(clone);
  return clone;
}

function collectUnknownKeyWarnings(raw: unknown, known: Settings): string[] {
  const warnings: string[] = [];
  const rawKeys = Object.keys(raw as Record<string, unknown>);
  const knownKeys = new Set(Object.keys(known));
  for (const key of rawKeys) {
    if (!knownKeys.has(key)) warnings.push(`Unknown settings section "${key}" was ignored.`);
  }
  return warnings;
}
