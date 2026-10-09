import { randomUUID } from 'node:crypto';

import { defineCommand, success, textContent } from '../../commands/define';

import type { CommandModule, ModuleRegistrationContext } from '../module-registry';

/**
 * Example of the module contract: a trusted, compiled-in unit that contributes
 * commands without any change to the core. It requests only the capability it
 * needs (`commands:register`).
 */
export function createDeveloperModule(): CommandModule {
  return {
    manifest: {
      id: 'core.developer',
      name: 'Developer Utilities',
      version: '1.0.0',
      description: 'Handy identifiers and timestamps for development workflows.',
      category: 'developer',
      capabilities: ['commands:register'],
    },

    register({ commands, declareCommand }: ModuleRegistrationContext): void {
      declareCommand('dev.generate-uuid');
      commands.register(
        defineCommand(
          {
            id: 'dev.generate-uuid',
            name: 'Generate UUID',
            description: 'Create a random version-4 UUID and copy it to the clipboard',
            category: 'developer',
            keywords: ['uuid', 'guid', 'identifier', 'random'],
            icon: 'Hash',
            enabled: true,
            source: 'module',
            riskLevel: 'safe',
          },
          async () => {
            const id = randomUUID();
            return success('UUID generated', { content: textContent(id) });
          },
        ),
      );

      declareCommand('dev.copy-timestamp');
      commands.register(
        defineCommand(
          {
            id: 'dev.copy-timestamp',
            name: 'Copy ISO Timestamp',
            description: 'Copy the current time as an ISO-8601 string',
            category: 'developer',
            keywords: ['timestamp', 'iso', 'utc', 'time'],
            icon: 'Clock',
            enabled: true,
            source: 'module',
            riskLevel: 'safe',
          },
          async () => {
            const stamp = new Date().toISOString();
            return success('Timestamp ready', { content: textContent(stamp) });
          },
        ),
      );
    },
  };
}
