export interface HistoryEntry {
  /** Command id or application id that was executed. */
  id: string;
  kind: 'command' | 'application';
  title: string;
  executedAt: string;
}

export interface FavoriteEntry {
  id: string;
  kind: 'command' | 'application';
  title: string;
  /** Manual ordering; lower values sort first. */
  order: number;
  addedAt: string;
}
