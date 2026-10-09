import { useCallback, useEffect, useRef } from 'react';

import { AgzosApiError } from '@shared/errors';
import { SEARCH_DEBOUNCE_MS } from '@shared/constants';
import { selectedItem, usePaletteStore } from '@renderer/stores/palette-store';

import type { CommandResult } from '@shared/types/command';
import type { SearchResultItem } from '@shared/types/search';

function toMessage(error: unknown): string {
  if (error instanceof AgzosApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}

/**
 * Central renderer controller. All privileged work goes through `window.agzos`
 * (the validated preload bridge) — the renderer never touches Node or the OS.
 */
export function useCommandPalette(): {
  run: (item?: SearchResultItem) => Promise<void>;
  toggleFavorite: (item?: SearchResultItem) => Promise<void>;
  refresh: () => Promise<void>;
  clearSearch: () => void;
} {
  const query = usePaletteStore((state) => state.query);
  const view = usePaletteStore((state) => state.view);
  // Monotonic id used to drop responses from superseded queries.
  const requestId = useRef(0);

  const search = useCallback(async (value: string, forView: string) => {
    const id = ++requestId.current;
    const store = usePaletteStore.getState();
    store.setLoading(true);
    try {
      const response = await window.agzos.commands.search(value);
      if (id !== requestId.current || forView !== 'search') return;
      store.setGroups(response.groups);
      store.setError(null);
    } catch (error) {
      if (id === requestId.current) store.setError(toMessage(error));
    } finally {
      if (id === requestId.current) store.setLoading(false);
    }
  }, []);

  // Debounced search; obsolete requests are cancelled by the request id.
  useEffect(() => {
    if (view !== 'search') return;
    const timer = setTimeout(() => {
      void search(query, view);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, view, search]);

  const applyResult = useCallback(async (result: CommandResult) => {
    const store = usePaletteStore.getState();
    store.setResult(result);
    if (result.message) store.setToast(result.message);
    if (!result.success) {
      store.setError(result.error?.message ?? 'The command failed');
      return;
    }
    if (result.navigateTo) {
      store.setView(result.navigateTo);
      return;
    }
    if (result.closePalette) {
      await window.agzos.window.closePalette();
    }
  }, []);

  const run = useCallback(
    async (item?: SearchResultItem) => {
      const target = item ?? selectedItem(usePaletteStore.getState());
      if (!target) return;
      const store = usePaletteStore.getState();
      store.setError(null);
      try {
        const result =
          target.kind === 'application'
            ? await window.agzos.applications.launch(target.id)
            : await window.agzos.commands.execute(target.id, {}, false);
        await applyResult(result);
        // Refresh so favorites/recent ordering stays accurate.
        if (usePaletteStore.getState().view === 'search') {
          void search(usePaletteStore.getState().query, 'search');
        }
      } catch (error) {
        store.setError(toMessage(error));
      }
    },
    [applyResult, search],
  );

  const toggleFavorite = useCallback(
    async (item?: SearchResultItem) => {
      const target = item ?? selectedItem(usePaletteStore.getState());
      if (!target) return;
      try {
        await window.agzos.favorites.toggle(target.id, target.kind, target.title);
        void search(usePaletteStore.getState().query, 'search');
      } catch (error) {
        usePaletteStore.getState().setError(toMessage(error));
      }
    },
    [search],
  );

  const clearSearch = useCallback(() => {
    usePaletteStore.getState().setQuery('');
  }, []);

  const refresh = useCallback(() => search(usePaletteStore.getState().query, view), [search, view]);

  /* ------------------------- global key handling ------------------------- */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const store = usePaletteStore.getState();
      const target = event.target as HTMLElement | null;
      const isFormField =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA');
      const isNumericField = isFormField && (target as HTMLInputElement).type === 'number';

      if (event.key === 'Escape') {
        event.preventDefault();
        if (store.view !== 'search') {
          store.setView('search');
        } else if (store.result) {
          store.setResult(null);
        } else {
          void window.agzos.window.closePalette();
        }
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        store.setQuery('');
        return;
      }

      if (store.view !== 'search') return;

      if (event.key === 'ArrowDown' || (event.ctrlKey && event.key.toLowerCase() === 'n')) {
        if (isNumericField) return;
        event.preventDefault();
        store.moveSelection(1);
        return;
      }
      if (event.key === 'ArrowUp' || (event.ctrlKey && event.key.toLowerCase() === 'p')) {
        if (isNumericField) return;
        event.preventDefault();
        store.moveSelection(-1);
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void run();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        void toggleFavorite();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [run, toggleFavorite]);

  /* ---------------------------- height reporting -------------------------- */
  useEffect(() => {
    const element = document.getElementById('root');
    if (!element) return;
    const report = (): void => {
      const height = Math.max(element.scrollHeight, document.body.scrollHeight);
      void window.agzos.window.setHeight(Math.min(height, 560));
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /* ------------------------ reset when the palette opens ------------------ */
  useEffect(() => {
    return window.agzos.window.onVisibilityChanged((visible) => {
      if (visible) usePaletteStore.getState().resetForOpen();
    });
  }, []);

  return { run, toggleFavorite, refresh, clearSearch };
}
