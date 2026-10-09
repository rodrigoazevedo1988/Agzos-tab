import { z } from 'zod';

import { defineCommand, failure, listContent, success, textContent } from '../define';

import type { RegisteredCommand } from '@shared/types/command';
import type { CommandServices } from '../context';

const toggleSchema = z.object({
  id: z.string().min(1).max(128),
  kind: z.enum(['command', 'application']),
  title: z.string().min(1).max(120),
});

export function createDataCommands(services: CommandServices): RegisteredCommand[] {
  return [
    defineCommand(
      {
        id: 'history.recent',
        name: 'Recent Items',
        description: 'Show recently executed commands and applications',
        category: 'navigation',
        keywords: ['history', 'recent', 'recentes', 'historico'],
        icon: 'History',
        enabled: true,
        source: 'builtin',
        riskLevel: 'safe',
      },
      async () => {
        const entries = await services.history.list();
        if (entries.length === 0) return success('History is empty', { content: listContent([]) });
        return success(`Last ${entries.length} items`, {
          content: listContent(entries.map((entry) => entry.title)),
          navigateTo: 'history',
        });
      },
    ),

    defineCommand(
      {
        id: 'history.clear',
        name: 'Clear History',
        description: 'Delete all recorded recent items',
        category: 'settings',
        keywords: ['clear', 'history', 'limpar', 'historico'],
        icon: 'Trash2',
        enabled: true,
        source: 'builtin',
        riskLevel: 'destructive',
        requiresConfirmation: true,
      },
      async () => {
        await services.history.clear();
        return success('History cleared');
      },
    ),

    defineCommand(
      {
        id: 'favorites.list',
        name: 'List Favorites',
        description: 'Show pinned commands and applications',
        category: 'navigation',
        keywords: ['favorites', 'pinned', 'favoritos'],
        icon: 'Star',
        enabled: true,
        source: 'builtin',
        riskLevel: 'safe',
      },
      async () => {
        const favorites = await services.favorites.list();
        if (favorites.length === 0) {
          return success('No favorites yet', { content: listContent([]), navigateTo: 'favorites' });
        }
        return success(`${favorites.length} favorite(s)`, {
          content: listContent(favorites.map((entry) => entry.title)),
          navigateTo: 'favorites',
        });
      },
    ),

    defineCommand(
      {
        id: 'favorites.toggle',
        name: 'Toggle Favorite',
        description: 'Pin or unpin a command or application',
        category: 'navigation',
        keywords: ['favorite', 'pin', 'unpin', 'favoritar'],
        icon: 'Star',
        enabled: true,
        source: 'builtin',
        riskLevel: 'safe',
      },
      async ({ args }) => {
        const parsed = toggleSchema.safeParse(args);
        if (!parsed.success) {
          return failure('INVALID_ARGUMENT', 'id, kind and title arguments are required');
        }
        const favorites = await services.favorites.toggle(parsed.data);
        const isFavorite = favorites.some((entry) => entry.id === parsed.data.id);
        return success(isFavorite ? 'Added to favorites' : 'Removed from favorites', {
          content: textContent(parsed.data.title),
        });
      },
    ),
  ];
}
