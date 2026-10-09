import path from 'node:path';

import { JsonStore } from '../storage/json-store';

import type { HistoryEntry } from '@shared/types/history';

interface HistoryDocument {
  entries: HistoryEntry[];
}

export interface HistoryRecordInput {
  id: string;
  kind: 'command' | 'application';
  title: string;
}

/**
 * Stores the most recently executed items. Only id/kind/title are persisted —
 * never command arguments, file contents or clipboard data.
 */
export class HistoryService {
  private readonly store: JsonStore<HistoryDocument>;
  private readonly limits: () => { enabled: boolean; maxEntries: number };

  constructor(userDataDir: string, limits: () => { enabled: boolean; maxEntries: number }) {
    this.limits = limits;
    this.store = new JsonStore<HistoryDocument>({
      filePath: path.join(userDataDir, 'history.json'),
      defaults: () => ({ entries: [] }),
      deserialize: (raw) => ({
        entries: Array.isArray((raw as HistoryDocument | null)?.entries)
          ? (raw as HistoryDocument).entries.filter(isValidEntry)
          : [],
      }),
    });
  }

  async list(): Promise<HistoryEntry[]> {
    const { entries } = await this.store.read();
    return [...entries];
  }

  /** Moves the item to the front, de-duplicating and trimming to the limit. */
  async record(input: HistoryRecordInput): Promise<HistoryEntry[]> {
    const { enabled, maxEntries } = this.limits();
    if (!enabled || maxEntries <= 0) return this.list();

    const entry: HistoryEntry = {
      id: input.id,
      kind: input.kind,
      title: input.title,
      executedAt: new Date().toISOString(),
    };
    const document = await this.store.update((current) => {
      const rest = current.entries.filter((item) => item.id !== entry.id);
      return { entries: [entry, ...rest].slice(0, maxEntries) };
    });
    return [...document.entries];
  }

  async remove(id: string): Promise<void> {
    await this.store.update((current) => ({
      entries: current.entries.filter((item) => item.id !== id),
    }));
  }

  async clear(): Promise<void> {
    await this.store.write({ entries: [] });
  }

  /** Returns a lookup map of item id → recency rank (0 = most recent). */
  async recencyRanking(): Promise<Map<string, number>> {
    const { entries } = await this.store.read();
    const map = new Map<string, number>();
    entries.forEach((entry, index) => {
      if (!map.has(entry.id)) map.set(entry.id, index);
    });
    return map;
  }
}

function isValidEntry(value: unknown): value is HistoryEntry {
  if (value === null || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    (entry.kind === 'command' || entry.kind === 'application') &&
    typeof entry.title === 'string' &&
    typeof entry.executedAt === 'string'
  );
}
