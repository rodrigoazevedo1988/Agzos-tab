import type { CommandCategory } from '@shared/types/command';
import type { SearchGroup, SearchResponse, SearchResultItem } from '@shared/types/search';
import type { ApplicationsCatalog } from '../../applications/catalog';
import type { CommandRegistry } from '../../commands/registry';
import type { FavoritesService } from '../favorites-service';
import type { HistoryService } from '../history-service';
import type { SettingsService } from '../settings-service';

const CATEGORY_LABELS: Record<CommandCategory | 'applications', string> = {
  application: 'Applications',
  navigation: 'Navigation',
  system: 'System',
  tools: 'Tools',
  developer: 'Developer',
  integration: 'Integrations',
  ai: 'AI',
  settings: 'Settings',
  applications: 'Applications',
};

const CATEGORY_ORDER: Array<CommandCategory | 'applications'> = [
  'application',
  'applications',
  'navigation',
  'tools',
  'system',
  'developer',
  'integration',
  'settings',
  'ai',
];

/**
 * Merges command and application results into a single, grouped, ranked list.
 * Favorites and recently used items receive additive boosts rather than filters,
 * so relevant results from other categories are never dropped.
 */
export class SearchService {
  constructor(
    private readonly registry: CommandRegistry,
    private readonly applications: ApplicationsCatalog,
    private readonly favorites: FavoritesService,
    private readonly history: HistoryService,
    private readonly settings: SettingsService,
  ) {}

  async search(query: string, requestedLimit?: number): Promise<SearchResponse> {
    const startedAt = performance.now();
    const settings = this.settings.get();
    const limit = clampLimit(
      requestedLimit ?? settings.search.maxResults,
      settings.search.maxResults,
    );

    const favoriteIds = new Set(await this.favorites.ids());
    const recency = settings.search.prioritizeRecent
      ? await this.history.recencyRanking()
      : new Map<string, number>();

    const items: SearchResultItem[] = [];

    for (const hit of this.registry.search(query, limit * 2)) {
      const { metadata } = hit;
      items.push({
        id: metadata.id,
        kind: 'command',
        title: metadata.name,
        subtitle: metadata.description,
        category: metadata.category,
        icon: metadata.icon,
        score: this.boost(hit.score, metadata.id, favoriteIds, recency, settings),
        source: metadata.source,
        riskLevel: metadata.riskLevel,
        requiresConfirmation: metadata.requiresConfirmation ?? metadata.riskLevel === 'destructive',
        ...(metadata.shortcut ? { shortcut: metadata.shortcut } : {}),
        isFavorite: favoriteIds.has(metadata.id),
      });
    }

    if (settings.search.includeApplications && query.trim().length > 0) {
      const apps = await this.applications.search(query, limit);
      for (const app of apps) {
        items.push({
          id: app.id,
          kind: 'application',
          title: app.name,
          subtitle: app.source,
          category: 'applications',
          icon: 'AppWindow',
          score: this.boost(640, app.id, favoriteIds, recency, settings),
          source: app.source,
          path: app.path,
          isFavorite: favoriteIds.has(app.id),
        });
      }
    }

    items.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    const limited = items.slice(0, limit);

    return {
      query,
      groups: groupItems(limited),
      total: items.length,
      tookMs: Math.max(0, Math.round(performance.now() - startedAt)),
    };
  }

  private boost(
    base: number,
    id: string,
    favoriteIds: Set<string>,
    recency: Map<string, number>,
    settings: { search: { prioritizeFavorites: boolean; prioritizeRecent: boolean } },
  ): number {
    let score = base;
    if (settings.search.prioritizeFavorites && favoriteIds.has(id)) score += 400;
    if (settings.search.prioritizeRecent) {
      const rank = recency.get(id);
      if (rank !== undefined) score += Math.max(0, 150 - rank * 5);
    }
    return score;
  }
}

function clampLimit(requested: number, configuredMax: number): number {
  const upper = Math.max(1, configuredMax);
  if (!Number.isFinite(requested) || requested <= 0) return upper;
  return Math.min(Math.floor(requested), upper);
}

/** Groups items by category, ordering groups by their best-scoring item. */
export function groupItems(items: SearchResultItem[]): SearchGroup[] {
  const byCategory = new Map<string, SearchResultItem[]>();
  for (const item of items) {
    const bucket = byCategory.get(item.category) ?? [];
    bucket.push(item);
    byCategory.set(item.category, bucket);
  }

  const groups: SearchGroup[] = [];
  for (const [category, groupItemList] of byCategory) {
    groups.push({
      category,
      label: CATEGORY_LABELS[category as CommandCategory | 'applications'] ?? category,
      items: groupItemList,
    });
  }

  groups.sort((a, b) => {
    const topA = a.items[0]?.score ?? 0;
    const topB = b.items[0]?.score ?? 0;
    if (topB !== topA) return topB - topA;
    const orderA = CATEGORY_ORDER.indexOf(a.category as CommandCategory);
    const orderB = CATEGORY_ORDER.indexOf(b.category as CommandCategory);
    return (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB);
  });

  return groups;
}
