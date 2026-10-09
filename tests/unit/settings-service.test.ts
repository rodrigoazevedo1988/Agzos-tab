import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { defaultSettings } from '@shared/settings-schema';
import { SettingsService } from '@main/services/settings-service';

import { makeTempDir } from '../helpers/temp-dir';

describe('SettingsService', () => {
  it('loads defaults for a fresh profile', async () => {
    const dir = await makeTempDir();
    const service = new SettingsService(dir);
    await expect(service.init()).resolves.toEqual(defaultSettings());
  });

  it('applies and persists a partial update', async () => {
    const dir = await makeTempDir();
    const service = new SettingsService(dir);
    await service.init();
    const updated = await service.update({ appearance: { theme: 'light' } });
    expect(updated.appearance.theme).toBe('light');
    expect(updated.appearance.accent).toBe('blue');

    const reopened = new SettingsService(dir);
    await reopened.init();
    expect(reopened.get().appearance.theme).toBe('light');
  });

  it('rejects an invalid patch without persisting it', async () => {
    const dir = await makeTempDir();
    const service = new SettingsService(dir);
    await service.init();
    await expect(service.update({ history: { maxEntries: 99_999 } })).rejects.toThrow();
    expect(service.get().history.maxEntries).toBe(defaultSettings().history.maxEntries);
  });

  it('emits a changed event on update', async () => {
    const dir = await makeTempDir();
    const service = new SettingsService(dir);
    await service.init();
    let emitted = 0;
    service.on('changed', () => {
      emitted += 1;
    });
    await service.update({ privacy: { telemetry: false } });
    expect(emitted).toBe(1);
  });

  it('resets to defaults', async () => {
    const dir = await makeTempDir();
    const service = new SettingsService(dir);
    await service.init();
    await service.update({ appearance: { theme: 'light' } });
    await expect(service.reset()).resolves.toEqual(defaultSettings());
  });

  it('exports valid JSON and strips secret-like keys', async () => {
    const dir = await makeTempDir();
    const service = new SettingsService(dir);
    await service.init();
    const exported = await service.export();
    const parsed = JSON.parse(exported) as Record<string, unknown>;
    expect(parsed.schemaVersion).toBe(defaultSettings().schemaVersion);

    // A hand-edited file with a secret must never round-trip into the export.
    await writeFile(
      path.join(dir, 'settings.json'),
      JSON.stringify({ ...defaultSettings(), apiKey: 'sk-secret' }),
      'utf8',
    );
    const tampered = new SettingsService(dir);
    await tampered.init();
    expect(await tampered.export()).not.toContain('sk-secret');
  });

  it('imports a valid document and reports unknown sections', async () => {
    const dir = await makeTempDir();
    const service = new SettingsService(dir);
    await service.init();
    const payload = JSON.stringify({
      ...defaultSettings(),
      appearance: { theme: 'light', accent: 'emerald' },
      mystery: true,
    });
    const outcome = await service.import(payload);
    expect(outcome.settings.appearance.theme).toBe('light');
    expect(outcome.warnings.join(' ')).toContain('mystery');
  });

  it('keeps the previous configuration when an import is invalid', async () => {
    const dir = await makeTempDir();
    const service = new SettingsService(dir);
    await service.init();
    await service.update({ appearance: { theme: 'light' } });

    await expect(service.import('{ not json')).rejects.toThrow(/valid JSON/);
    expect(service.get().appearance.theme).toBe('light');

    await expect(service.import('[]')).rejects.toThrow(/JSON object/);
    expect(service.get().appearance.theme).toBe('light');
  });

  it('recovers from a corrupted settings file', async () => {
    const dir = await makeTempDir();
    await writeFile(path.join(dir, 'settings.json'), 'garbage', 'utf8');
    const service = new SettingsService(dir);
    await expect(service.init()).resolves.toEqual(defaultSettings());
    const raw = await readFile(path.join(dir, 'settings.json'), 'utf8').catch(() => '');
    expect(raw).toBe('garbage');
  });
});
