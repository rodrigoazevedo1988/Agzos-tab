import { z } from 'zod';

import { launchApplication } from '../../applications/launcher';
import { defineCommand, failure, listContent, readStringArg, success } from '../define';

import type { RegisteredCommand } from '@shared/types/command';
import type { CommandServices } from '../context';

const launchSchema = z.object({ applicationId: z.string().min(1).max(128) });

export function createApplicationCommands(services: CommandServices): RegisteredCommand[] {
  return [
    defineCommand(
      {
        id: 'applications.search',
        name: 'Search Applications',
        description: 'Find installed applications by name',
        category: 'application',
        keywords: ['apps', 'applications', 'programs', 'programas'],
        icon: 'AppWindow',
        enabled: true,
        source: 'system',
        riskLevel: 'safe',
      },
      async ({ args }) => {
        const query = readStringArg(args, 'query') ?? '';
        const results = query
          ? await services.applications.search(query, 10)
          : (await services.applications.list()).slice(0, 10);
        if (results.length === 0) {
          return success('No applications matched', { content: listContent([]) });
        }
        return success(`${results.length} application(s)`, {
          content: listContent(results.map((entry) => entry.name)),
        });
      },
    ),

    defineCommand(
      {
        id: 'applications.launch',
        name: 'Launch Application',
        description: 'Open an installed application from the catalog',
        category: 'application',
        keywords: ['launch', 'open', 'run', 'executar'],
        icon: 'Rocket',
        enabled: true,
        source: 'system',
        riskLevel: 'caution',
      },
      async ({ args }) => {
        const parsed = launchSchema.safeParse(args);
        if (!parsed.success)
          return failure('INVALID_ARGUMENT', 'An applicationId argument is required');

        const resolved = await services.applications.resolveLaunchTarget(parsed.data.applicationId);
        if ('error' in resolved) return failure('NOT_FOUND', resolved.error);

        const outcome = await launchApplication(resolved.entry, services.ports);
        if (!outcome.ok) {
          return failure('UNAVAILABLE', outcome.error ?? 'Could not open the application');
        }

        await services.history.record({
          id: resolved.entry.id,
          kind: 'application',
          title: resolved.entry.name,
        });
        return success(`${resolved.entry.name} opened`, { closePalette: true });
      },
    ),
  ];
}
