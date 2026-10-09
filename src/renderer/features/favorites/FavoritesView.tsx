import { ArrowDown, ArrowUp, Star, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { AgzosApiError } from '@shared/errors';

import type { FavoriteEntry } from '@shared/types/history';

export function FavoritesView(): JSX.Element {
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setFavorites(await window.agzos.favorites.list());
      setError(null);
    } catch (cause) {
      setError(cause instanceof AgzosApiError ? cause.message : 'Could not load favorites');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (entry: FavoriteEntry): Promise<void> => {
    setFavorites(await window.agzos.favorites.toggle(entry.id, entry.kind, entry.title));
  };

  const move = async (index: number, delta: number): Promise<void> => {
    const next = [...favorites];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    setFavorites(await window.agzos.favorites.reorder(next.map((entry) => entry.id)));
  };

  if (error) {
    return <p className="px-4 py-6 text-[12.5px] text-red-300">{error}</p>;
  }

  if (favorites.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-[13px] text-graphite-400">
        No favorites yet. Pin a result with ⌘/Ctrl+D.
      </div>
    );
  }

  return (
    <ul className="agzos-scroll max-h-[420px] space-y-1 overflow-y-auto px-3 py-3">
      {favorites.map((entry, index) => (
        <li
          key={entry.id}
          className="flex items-center gap-2 rounded-lg border border-graphite-700 bg-graphite-900/60 px-3 py-2"
        >
          <Star className="h-3.5 w-3.5 shrink-0 fill-brand-400 text-brand-400" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] text-graphite-100">{entry.title}</span>
            <span className="block text-[10.5px] uppercase tracking-wide text-graphite-400">
              {entry.kind}
            </span>
          </span>
          <IconButton label="Move up" onClick={() => void move(index, -1)}>
            <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          </IconButton>
          <IconButton label="Move down" onClick={() => void move(index, 1)}>
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          </IconButton>
          <IconButton label="Remove favorite" onClick={() => void remove(entry)}>
            <X className="h-3.5 w-3.5" aria-hidden />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded-md border border-graphite-600 p-1 text-graphite-300 transition-colors hover:bg-graphite-700/60 hover:text-graphite-100"
    >
      {children}
    </button>
  );
}
