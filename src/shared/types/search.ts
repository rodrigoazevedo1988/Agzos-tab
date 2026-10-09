import type { CommandRiskLevel } from './command';

export type SearchResultKind = 'command' | 'application';

export interface SearchResultItem {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle: string;
  /** Category id (command category or `applications`). */
  category: string;
  icon: string;
  score: number;
  source: string;
  /** Command-only fields. */
  riskLevel?: CommandRiskLevel;
  requiresConfirmation?: boolean;
  shortcut?: string;
  /** Application-only fields. */
  path?: string;
  isFavorite?: boolean;
}

export interface SearchGroup {
  category: string;
  label: string;
  items: SearchResultItem[];
}

export interface SearchResponse {
  query: string;
  groups: SearchGroup[];
  total: number;
  tookMs: number;
}
