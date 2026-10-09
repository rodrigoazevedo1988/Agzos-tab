import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { AgzosApiError } from '@shared/errors';

import type { HistoryEntry } from '@shared/types/history';

export function HistoryView(): JSX.Element {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEntries(await window.agzos.history.list());
      setError(null);
    } catch (cause) {
      setError(cause instanceof AgzosApiError ? cause.message : 'Could not load history');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clear = async (): Promise<void> => {
    // Routed through the command executor so the native confirmation applies.
    const result = await window.agzos.commands.execute('history.clear', {}, false);
    if (result.success) await load();
  };

  const remove = async (id: string): Promise<void> => {
    await window.agzos.history.remove(id);
    await load();
  };

  if (error) return <p className="px-4 py-6 text-[12.5px] text-red-300">{error}</p>;

  return (
    <div className="flex max-h-[420px] flex-col">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-[11px] text-graphite-400">
          {entries.length === 0 ? 'No history' : `${entries.length} item(s)`}
        </span>
        <button
          type="button"
          onClick={() => void clear()}
          disabled={entries.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-red-500/40 px-2.5 py-1 text-[11.5px] text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Clear history
        </button>
      </div>
      <ul className="agzos-scroll space-y-1 overflow-y-auto px-3 pb-3">
        {entries.map((entry) => (
          <li
            key={`${entry.id}-${entry.executedAt}`}
            className="flex items-center gap-2 rounded-lg border border-graphite-700 bg-graphite-900/60 px-3 py-1.5"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] text-graphite-100">{entry.title}</span>
              <span className="block text-[10.5px] text-graphite-400">
                {new Date(entry.executedAt).toLocaleString()}
              </span>
            </span>
            <button
              type="button"
              aria-label={`Remove ${entry.title}`}
              onClick={() => void remove(entry.id)}
              className="rounded-md border border-graphite-600 px-2 py-0.5 text-[11px] text-graphite-300 hover:bg-graphite-700/60"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
