import path from 'node:path';

import { JsonStore } from '../storage/json-store';

import type { FavoriteEntry } from '@shared/types/history';

interface FavoritesDocument {
  entries: FavoriteEntry[];
}

export interface FavoriteToggleInput {
  id: string;
  kind: 'command' | 'application';
  title: string;
}

/** Ordered list of pinned commands/applications. */
export class FavoritesService {
  private readonly store: JsonStore<FavoritesDocument>;

  constructor(userDataDir: string) {
    this.store = new JsonStore<FavoritesDocument>({
      filePath: path.join(userDataDir, 'favorites.json'),
      defaults: () => ({ entries: [] }),
      deserialize: (raw) => {
        const entries = Array.isArray((raw as FavoritesDocument | null)?.entries)
          ? (raw as FavoritesDocument).entries.filter(isValidEntry)
          : [];
        entries.sort((a, b) => a.order - b.order);
        return { entries };
      },
    });
  }

  async list(): Promise<FavoriteEntry[]> {
    const { entries } = await this.store.read();
    return [...entries].sort((a, b) => a.order - b.order);
  }

  async ids(): Promise<string[]> {
    return (await this.list()).map((entry) => entry.id);
  }

  /** Adds or removes an entry. Returns the resulting ordered list. */
  async toggle(input: FavoriteToggleInput): Promise<FavoriteEntry[]> {
    const document = await this.store.update((current) => {
      const exists = current.entries.some((entry) => entry.id === input.id);
      if (exists) {
        const remaining = current.entries.filter((entry) => entry.id !== input.id);
        return { entries: reindex(remaining) };
      }
      const entry: FavoriteEntry = {
        id: input.id,
        kind: input.kind,
        title: input.title,
        order: current.entries.length,
        addedAt: new Date().toISOString(),
      };
      return { entries: reindex([...current.entries, entry]) };
    });
    return [...document.entries];
  }

  /** Applies an explicit ordering; unknown ids are ignored, missing ids appended. */
  async reorder(ids: string[]): Promise<FavoriteEntry[]> {
    const document = await this.store.update((current) => {
      const byId = new Map(current.entries.map((entry) => [entry.id, entry] as const));
      const ordered: FavoriteEntry[] = [];
      for (const id of ids) {
        const entry = byId.get(id);
        if (entry) {
          ordered.push(entry);
          byId.delete(id);
        }
      }
      for (const entry of byId.values()) ordered.push(entry);
      return { entries: reindex(ordered) };
    });
    return [...document.entries];
  }
}

function reindex(entries: FavoriteEntry[]): FavoriteEntry[] {
  return entries.map((entry, index) => ({ ...entry, order: index }));
}

function isValidEntry(value: unknown): value is FavoriteEntry {
  if (value === null || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    (entry.kind === 'command' || entry.kind === 'application') &&
    typeof entry.title === 'string' &&
    typeof entry.order === 'number' &&
    typeof entry.addedAt === 'string'
  );
}
