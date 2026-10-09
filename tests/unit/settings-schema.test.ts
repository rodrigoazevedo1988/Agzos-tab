import { describe, expect, it } from 'vitest';

import { SETTINGS_SCHEMA_VERSION } from '@shared/constants';
import {
  defaultSettings,
  mergeSettings,
  migrateSettings,
  settingsSchema,
} from '@shared/settings-schema';

describe('defaultSettings', () => {
  it('validates against the schema', () => {
    expect(settingsSchema.safeParse(defaultSettings()).success).toBe(true);
  });

  it('starts at the current schema version with privacy-safe defaults', () => {
    const settings = defaultSettings();
    expect(settings.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
    expect(settings.privacy.telemetry).toBe(false);
    expect(settings.ai.enabled).toBe(false);
    expect(settings.ai.provider).toBe('none');
  });
});

describe('settingsSchema', () => {
  it('rejects out-of-range history limits', () => {
    const invalid = { ...defaultSettings(), history: { enabled: true, maxEntries: 10_000 } };
    expect(settingsSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects unknown enum values', () => {
    const invalid = { ...defaultSettings(), appearance: { theme: 'neon', accent: 'blue' } };
    expect(settingsSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('mergeSettings', () => {
  it('deep-merges without dropping sibling keys', () => {
    const base = defaultSettings();
    const merged = mergeSettings(base, { appearance: { theme: 'light' } });
    expect(merged.appearance.theme).toBe('light');
    expect(merged.appearance.accent).toBe(base.appearance.accent);
  });

  it('does not erase sections when a value is undefined', () => {
    const base = defaultSettings();
    const merged = mergeSettings(base, { history: { enabled: undefined } });
    expect(merged.history).toEqual(base.history);
  });
});

describe('migrateSettings', () => {
  it('passes through a valid current-version document', () => {
    const current = defaultSettings();
    const result = migrateSettings(current);
    expect(result.migrated).toBe(false);
    expect(result.settings).toEqual(current);
  });

  it('migrates an older document and fills defaults', () => {
    const older = { schemaVersion: 0, appearance: { theme: 'light', accent: 'violet' } };
    const result = migrateSettings(older);
    expect(result.migrated).toBe(true);
    expect(result.settings.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
    expect(result.settings.appearance.theme).toBe('light');
    expect(result.settings.search).toEqual(defaultSettings().search);
  });

  it('falls back to defaults for a corrupt document', () => {
    expect(migrateSettings(null).settings).toEqual(defaultSettings());
    expect(migrateSettings('nope').settings).toEqual(defaultSettings());
    expect(
      migrateSettings({ schemaVersion: SETTINGS_SCHEMA_VERSION, appearance: 'bad' }).settings,
    ).toEqual(defaultSettings());
  });
});
