import { create } from 'zustand';

import type { CommandResult, PaletteView } from '@shared/types/command';
import type { SearchGroup, SearchResultItem } from '@shared/types/search';

export interface PaletteState {
  view: PaletteView;
  query: string;
  groups: SearchGroup[];
  /** Flattened, keyboard-navigable view of `groups`. */
  flat: SearchResultItem[];
  selectedIndex: number;
  loading: boolean;
  error: string | null;
  /** Result of the last executed command, shown as a panel. */
  result: CommandResult | null;
  /** Transient status text (e.g. "Copied to clipboard"). */
  toast: string | null;

  setView: (view: PaletteView) => void;
  setQuery: (query: string) => void;
  setGroups: (groups: SearchGroup[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setResult: (result: CommandResult | null) => void;
  setToast: (toast: string | null) => void;
  moveSelection: (delta: number) => void;
  setSelectedIndex: (index: number) => void;
  resetForOpen: () => void;
}

export const usePaletteStore = create<PaletteState>((set, get) => ({
  view: 'search',
  query: '',
  groups: [],
  flat: [],
  selectedIndex: 0,
  loading: false,
  error: null,
  result: null,
  toast: null,

  setView: (view) => set({ view, result: null, error: null, selectedIndex: 0 }),
  setQuery: (query) => set({ query }),
  setGroups: (groups) =>
    set({
      groups,
      flat: groups.flatMap((group) => group.items),
      selectedIndex: 0,
      result: null,
    }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setResult: (result) =>
    set({ result, selectedIndex: result ? get().selectedIndex : get().selectedIndex }),
  setToast: (toast) => set({ toast }),
  moveSelection: (delta) => {
    const { flat, selectedIndex } = get();
    if (flat.length === 0) return;
    const next = (selectedIndex + delta + flat.length) % flat.length;
    set({ selectedIndex: next });
  },
  setSelectedIndex: (index) => set({ selectedIndex: index }),
  resetForOpen: () =>
    set({
      view: 'search',
      query: '',
      result: null,
      error: null,
      selectedIndex: 0,
      toast: null,
    }),
}));

export function selectedItem(state: PaletteState): SearchResultItem | undefined {
  return state.flat[state.selectedIndex];
}
