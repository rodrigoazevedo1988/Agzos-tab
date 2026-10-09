import { useCallback, useEffect, useState } from 'react';

import { AgzosApiError } from '@shared/errors';

import type { Settings, SettingsPatch } from '@shared/settings-schema';

export interface SettingsController {
  settings: Settings | null;
  error: string | null;
  busy: boolean;
  update: (patch: SettingsPatch) => Promise<void>;
  reset: () => Promise<void>;
  reload: () => Promise<void>;
}

export function useSettings(): SettingsController {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setSettings(await window.agzos.settings.get());
      setError(null);
    } catch (cause) {
      setError(cause instanceof AgzosApiError ? cause.message : 'Could not load settings');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const update = useCallback(async (patch: SettingsPatch) => {
    setBusy(true);
    try {
      setSettings(await window.agzos.settings.update(patch));
      setError(null);
    } catch (cause) {
      setError(cause instanceof AgzosApiError ? cause.message : 'Could not save settings');
    } finally {
      setBusy(false);
    }
  }, []);

  const reset = useCallback(async () => {
    setBusy(true);
    try {
      setSettings(await window.agzos.settings.reset());
    } finally {
      setBusy(false);
    }
  }, []);

  return { settings, error, busy, update, reset, reload };
}
