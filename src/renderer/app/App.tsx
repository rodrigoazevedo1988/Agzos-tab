import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Footer } from '@renderer/components/Footer';
import { ResultList } from '@renderer/components/ResultList';
import { ResultPanel } from '@renderer/components/ResultPanel';
import { SearchInput } from '@renderer/components/SearchInput';
import { useCommandPalette } from '@renderer/features/command-palette/useCommandPalette';
import { FavoritesView } from '@renderer/features/favorites/FavoritesView';
import { HelpView } from '@renderer/features/help/HelpView';
import { HistoryView } from '@renderer/features/history/HistoryView';
import { SettingsView } from '@renderer/features/settings/SettingsView';
import { selectedItem, usePaletteStore } from '@renderer/stores/palette-store';

import type { PaletteView } from '@shared/types/command';

const VIEW_TITLES: Record<Exclude<PaletteView, 'search'>, string> = {
  settings: 'Settings',
  favorites: 'Favorites',
  history: 'History',
  help: 'Keyboard shortcuts',
};

export function App(): JSX.Element {
  const view = usePaletteStore((state) => state.view);
  const query = usePaletteStore((state) => state.query);
  const groups = usePaletteStore((state) => state.groups);
  const flat = usePaletteStore((state) => state.flat);
  const loading = usePaletteStore((state) => state.loading);
  const error = usePaletteStore((state) => state.error);
  const result = usePaletteStore((state) => state.result);
  const toast = usePaletteStore((state) => state.toast);
  const setQuery = usePaletteStore((state) => state.setQuery);
  const setView = usePaletteStore((state) => state.setView);
  const setSelectedIndex = usePaletteStore((state) => state.setSelectedIndex);
  const current = usePaletteStore(selectedItem);

  const inputRef = useRef<HTMLInputElement>(null);
  const { run } = useCommandPalette();

  // Focus the search field whenever the palette is shown in search mode.
  useEffect(() => {
    if (view === 'search') inputRef.current?.focus();
  }, [view]);

  // The tray can ask the renderer to switch views.
  useEffect(() => {
    return window.agzos.window.onNavigate((next) => setView(next));
  }, [setView]);

  return (
    <div className="flex h-full w-full p-0">
      <div className="animate-palette-in flex w-full flex-col overflow-hidden rounded-2xl border border-graphite-700 bg-graphite-850/95 shadow-palette backdrop-blur-xl">
        {view === 'search' ? (
          <SearchInput value={query} onChange={setQuery} loading={loading} inputRef={inputRef} />
        ) : (
          <div className="flex items-center gap-2 border-b border-graphite-700 px-4 py-3">
            <button
              type="button"
              aria-label="Back to search"
              onClick={() => setView('search')}
              className="rounded-md border border-graphite-600 p-1 text-graphite-300 hover:bg-graphite-700/60"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            </button>
            <span className="text-[13px] font-medium text-graphite-100">
              {VIEW_TITLES[view as Exclude<PaletteView, 'search'>]}
            </span>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-[12px] text-red-300"
          >
            {error}
          </p>
        )}

        <div className="min-h-0 flex-1">
          {view === 'search' && (
            <>
              <ResultList
                groups={groups}
                flat={flat}
                onRun={(item) => void run(item)}
                onHover={setSelectedIndex}
              />
              {result && <ResultPanel result={result} />}
            </>
          )}
          {view === 'settings' && <SettingsView />}
          {view === 'favorites' && <FavoritesView />}
          {view === 'history' && <HistoryView />}
          {view === 'help' && <HelpView />}
        </div>

        {toast && !result && (
          <p className="border-t border-graphite-700 px-4 py-1.5 text-[11.5px] text-brand-300">
            {toast}
          </p>
        )}

        <Footer view={view} selected={current} isFavorite={current?.isFavorite ?? false} />
      </div>
    </div>
  );
}
