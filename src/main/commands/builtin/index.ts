import { createApplicationCommands } from './app-commands';
import { createDataCommands } from './data-commands';
import { createSettingsCommands } from './settings-commands';
import { createSystemCommands } from './system-commands';

import type { CommandServices } from '../context';
import type { RegisteredCommand } from '@shared/types/command';

/** Every command shipped with the MVP. */
export function createBuiltinCommands(services: CommandServices): RegisteredCommand[] {
  return [
    ...createSystemCommands(services),
    ...createApplicationCommands(services),
    ...createDataCommands(services),
    ...createSettingsCommands(services),
  ];
}
