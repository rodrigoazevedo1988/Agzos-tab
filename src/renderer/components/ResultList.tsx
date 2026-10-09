import { AlertTriangle, Star } from 'lucide-react';

import { usePaletteStore } from '@renderer/stores/palette-store';
import { resolveIcon } from '@renderer/utils/icons';

import type { SearchGroup, SearchResultItem } from '@shared/types/search';

interface ResultListProps {
  groups: SearchGroup[];
  flat: SearchResultItem[];
  onRun: (item: SearchResultItem) => void;
  onHover: (index: number) => void;
}

export function ResultList({ groups, flat, onRun, onHover }: ResultListProps): JSX.Element {
  const selectedIndex = usePaletteStore((state) => state.selectedIndex);

  if (flat.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-[13px] text-graphite-400">
        No results. Try a different search term.
      </div>
    );
  }

  let cursor = -1;
  return (
    <ul
      id="agzos-results"
      role="listbox"
      aria-label="Results"
      className="agzos-scroll max-h-[420px] overflow-y-auto py-2"
    >
      {groups.map((group) => (
        <li key={group.category} role="presentation">
          <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-graphite-400">
            {group.label}
          </div>
          <ul role="presentation">
            {group.items.map((item) => {
              cursor += 1;
              const index = cursor;
              const selected = index === selectedIndex;
              const Icon = resolveIcon(item.icon);
              return (
                <li key={item.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseMove={() => onHover(index)}
                    onClick={() => onRun(item)}
                    className={[
                      'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                      selected
                        ? 'bg-brand-500/15 ring-1 ring-inset ring-brand-500/40'
                        : 'hover:bg-graphite-800/60',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                        selected
                          ? 'bg-brand-500/25 text-brand-300'
                          : 'bg-graphite-700 text-graphite-300',
                      ].join(' ')}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13.5px] font-medium text-graphite-50">
                          {item.title}
                        </span>
                        {item.riskLevel === 'destructive' && (
                          <span
                            title="Requires confirmation"
                            className="flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
                          >
                            <AlertTriangle className="h-3 w-3" aria-hidden />
                            Confirm
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-graphite-400">
                        {item.subtitle}
                      </span>
                    </span>
                    {item.shortcut && (
                      <kbd className="rounded border border-graphite-600 bg-graphite-800 px-1.5 py-0.5 font-mono text-[10px] text-graphite-300">
                        {item.shortcut}
                      </kbd>
                    )}
                    {item.isFavorite && (
                      <Star
                        className="h-3.5 w-3.5 shrink-0 fill-brand-400 text-brand-400"
                        aria-label="Favorite"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
