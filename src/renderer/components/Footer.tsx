import type { PaletteView } from '@shared/types/command';
import type { SearchResultItem } from '@shared/types/search';

interface FooterProps {
  view: PaletteView;
  selected?: SearchResultItem;
  isFavorite?: boolean;
}

export function Footer({ view, selected, isFavorite }: FooterProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-graphite-700 px-4 py-2 text-[11px] text-graphite-400">
      <div className="flex items-center gap-3">
        <Hint keys="↑ ↓" label="Navigate" />
        <Hint keys="⏎" label="Run" />
        <Hint keys="esc" label={view === 'search' ? 'Close' : 'Back'} />
        {view === 'search' && selected && (
          <Hint keys="⌘/Ctrl+D" label={isFavorite ? 'Unpin' : 'Pin'} />
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-graphite-500">Agzos Tab</span>
        {view === 'search' && <Hint keys="⌘/Ctrl+K" label="Clear" />}
      </div>
    </div>
  );
}

function Hint({ keys, label }: { keys: string; label: string }): JSX.Element {
  return (
    <span className="flex items-center gap-1">
      <kbd className="rounded border border-graphite-600 bg-graphite-800 px-1.5 py-0.5 font-mono text-[10px] text-graphite-200">
        {keys}
      </kbd>
      <span>{label}</span>
    </span>
  );
}
