import { commandRequiresConfirmation, type CommandResult } from '@shared/types/command';

import { createLogger } from '../logger';

import type { DialogPort } from '../app/ports';
import type { HistoryService } from '../services/history-service';
import type { CommandRegistry } from './registry';

const log = createLogger('executor');

export interface ExecuteRequest {
  commandId: string;
  args: Record<string, unknown>;
  /** True when the user has already accepted the confirmation prompt. */
  confirmed: boolean;
  source: 'palette' | 'ipc';
}

/**
 * Single choke-point for running a command. Enforces existence, enabled state
 * and confirmation policy, records successful executions and guarantees the
 * caller always receives a structured result instead of a thrown error.
 */
export class CommandExecutor {
  constructor(
    private readonly registry: CommandRegistry,
    private readonly history: HistoryService,
    private readonly dialog: DialogPort,
  ) {}

  async execute(request: ExecuteRequest): Promise<CommandResult> {
    const registered = this.registry.get(request.commandId);
    if (!registered) {
      return failure('NOT_FOUND', `No command registered with id "${request.commandId}"`);
    }
    const { metadata, handler } = registered;
    if (!metadata.enabled) {
      return failure('PERMISSION_DENIED', `Command "${metadata.id}" is disabled`);
    }

    if (commandRequiresConfirmation(metadata) && !request.confirmed) {
      const accepted = await this.dialog.confirm({
        title: metadata.name,
        message: `Run "${metadata.name}"?`,
        detail: metadata.description,
      });
      if (!accepted) {
        return {
          success: false,
          message: 'Cancelled',
          error: { code: 'CONFIRMATION_REQUIRED', message: 'The action was not confirmed' },
        };
      }
    }

    try {
      const result = await handler({ source: request.source, args: request.args });
      if (result.success) {
        await this.history.record({
          id: metadata.id,
          kind: 'command',
          title: metadata.name,
        });
      }
      return result;
    } catch (error) {
      // Never leak stack traces or raw error objects to the renderer.
      log.error(`Command "${metadata.id}" failed`, { reason: (error as Error).name });
      return failure('INTERNAL', 'The command failed to run');
    }
  }
}

function failure(code: string, message: string): CommandResult {
  return { success: false, error: { code, message } };
}
