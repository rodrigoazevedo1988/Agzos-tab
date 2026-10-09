import { useState } from 'react';

import { MAX_HISTORY_LIMIT } from '@shared/constants';

import { useSettings } from './useSettings';

import type { SettingsPatch } from '@shared/settings-schema';

export function SettingsView(): JSX.Element {
  const { settings, error, busy, update, reset, reload } = useSettings();
  const [shortcutMessage, setShortcutMessage] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  if (!settings) {
    return (
      <div className="px-4 py-8 text-center text-[13px] text-graphite-400">Loading settings…</div>
    );
  }

  const patch = (value: SettingsPatch): void => {
    void update(value);
  };

  const registerShortcut = async (accelerator: string): Promise<void> => {
    const result = await window.agzos.system.registerShortcut(accelerator);
    if (result.ok) {
      setShortcutMessage('Global shortcut updated');
      patch({ shortcuts: { global: accelerator } });
    } else if (result.reason === 'occupied') {
      setShortcutMessage('That combination is already in use by another application');
    } else {
      setShortcutMessage('That combination is not valid');
    }
  };

  const exportSettings = async (): Promise<void> => {
    const json = await window.agzos.settings.export();
    await window.agzos.commands.execute('system.copy-text', { text: json }, true);
    setImportMessage('Settings copied to the clipboard as JSON');
  };

  const importSettings = async (): Promise<void> => {
    const json = await window.agzos.commands.execute('settings.import', {}, true);
    setImportMessage(json.message ?? (json.success ? 'Settings imported' : 'Import cancelled'));
    await reload();
  };

  return (
    <div className="agzos-scroll max-h-[420px] space-y-5 overflow-y-auto px-4 py-4">
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[12px] text-red-300">{error}</p>
      )}

      <Section title="Appearance">
        <Select
          label="Theme"
          value={settings.appearance.theme}
          options={['dark', 'light', 'system']}
          disabled={busy}
          onChange={(value) => patch({ appearance: { theme: value as 'dark' } })}
        />
        <Select
          label="Accent"
          value={settings.appearance.accent}
          options={['blue', 'violet', 'emerald']}
          disabled={busy}
          onChange={(value) => patch({ appearance: { accent: value as 'blue' } })}
        />
      </Section>

      <Section title="Shortcut">
        <TextInput
          label="Global launcher hotkey"
          defaultValue={settings.shortcuts.global}
          disabled={busy}
          onCommit={(value) => void registerShortcut(value)}
        />
        {shortcutMessage && <p className="text-[11.5px] text-brand-300">{shortcutMessage}</p>}
      </Section>

      <Section title="Startup">
        <Toggle
          label="Launch at login"
          checked={settings.startup.launchAtLogin}
          onChange={(checked) => patch({ startup: { launchAtLogin: checked } })}
        />
        <Toggle
          label="Start minimized"
          checked={settings.startup.startMinimized}
          onChange={(checked) => patch({ startup: { startMinimized: checked } })}
        />
      </Section>

      <Section title="Search">
        <Toggle
          label="Include applications"
          checked={settings.search.includeApplications}
          onChange={(checked) => patch({ search: { includeApplications: checked } })}
        />
        <Toggle
          label="Fuzzy matching"
          checked={settings.search.fuzzy}
          onChange={(checked) => patch({ search: { fuzzy: checked } })}
        />
        <Toggle
          label="Prioritize favorites"
          checked={settings.search.prioritizeFavorites}
          onChange={(checked) => patch({ search: { prioritizeFavorites: checked } })}
        />
        <Toggle
          label="Prioritize recent"
          checked={settings.search.prioritizeRecent}
          onChange={(checked) => patch({ search: { prioritizeRecent: checked } })}
        />
        <NumberInput
          label="Max results"
          value={settings.search.maxResults}
          min={1}
          max={50}
          onCommit={(value) => patch({ search: { maxResults: value } })}
        />
      </Section>

      <Section title="History">
        <Toggle
          label="Record history"
          checked={settings.history.enabled}
          onChange={(checked) => patch({ history: { enabled: checked } })}
        />
        <NumberInput
          label="History size limit"
          value={settings.history.maxEntries}
          min={0}
          max={MAX_HISTORY_LIMIT}
          onCommit={(value) => patch({ history: { maxEntries: value } })}
        />
      </Section>

      <Section title="Privacy">
        <Toggle
          label="Persist history to disk"
          checked={settings.privacy.persistHistory}
          onChange={(checked) => patch({ privacy: { persistHistory: checked } })}
        />
        <p className="text-[11.5px] text-graphite-400">
          Telemetry is off. No data leaves this device. AI integrations are disabled until you
          configure a provider.
        </p>
      </Section>

      <Section title="Configuration file">
        <div className="flex flex-wrap gap-2">
          <ActionButton label="Export as JSON" onClick={() => void exportSettings()} />
          <ActionButton label="Import from JSON" onClick={() => void importSettings()} />
          <ActionButton label="Reset to defaults" onClick={() => void reset()} tone="danger" />
        </div>
        {importMessage && <p className="text-[11.5px] text-brand-300">{importMessage}</p>}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section className="space-y-2">
      <h2 className="text-[10.5px] font-semibold uppercase tracking-wider text-graphite-400">
        {title}
      </h2>
      <div className="space-y-2 rounded-xl border border-graphite-700 bg-graphite-900/60 p-3">
        {children}
      </div>
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-[12.5px] text-graphite-100">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-brand-500"
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <label className="flex items-center justify-between gap-3 text-[12.5px] text-graphite-100">
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-graphite-600 bg-graphite-800 px-2 py-1 text-[12px] text-graphite-100 outline-none focus:border-brand-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextInput({
  label,
  defaultValue,
  disabled,
  onCommit,
}: {
  label: string;
  defaultValue: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
}): JSX.Element {
  const [value, setValue] = useState(defaultValue);
  return (
    <label className="flex items-center justify-between gap-3 text-[12.5px] text-graphite-100">
      <span>{label}</span>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => value !== defaultValue && onCommit(value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onCommit(value);
        }}
        className="w-56 rounded-lg border border-graphite-600 bg-graphite-800 px-2 py-1 font-mono text-[11.5px] text-graphite-100 outline-none focus:border-brand-500"
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}): JSX.Element {
  return (
    <label className="flex items-center justify-between gap-3 text-[12.5px] text-graphite-100">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          if (Number.isFinite(parsed)) onCommit(Math.min(Math.max(parsed, min), max));
        }}
        className="w-20 rounded-lg border border-graphite-600 bg-graphite-800 px-2 py-1 text-right text-[12px] text-graphite-100 outline-none focus:border-brand-500"
      />
    </label>
  );
}

function ActionButton({
  label,
  onClick,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg border px-3 py-1.5 text-[12px] transition-colors',
        tone === 'danger'
          ? 'border-red-500/40 text-red-300 hover:bg-red-500/10'
          : 'border-graphite-600 text-graphite-100 hover:bg-graphite-700/60',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
