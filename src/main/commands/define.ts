import type {
  CommandHandler,
  CommandMetadata,
  CommandResult,
  CommandResultContent,
  RegisteredCommand,
} from '@shared/types/command';

/** Convenience builders so command modules stay declarative. */
export function defineCommand(
  metadata: CommandMetadata,
  handler: CommandHandler,
): RegisteredCommand {
  return { metadata, handler };
}

export function success(
  message?: string,
  extra?: Partial<Omit<CommandResult, 'success' | 'message'>>,
): CommandResult {
  return { success: true, ...(message ? { message } : {}), ...extra };
}

export function failure(code: string, message: string): CommandResult {
  return { success: false, error: { code, message } };
}

export function textContent(text: string): CommandResultContent {
  return { type: 'text', text };
}

export function keyValueContent(
  entries: Array<{ key: string; value: string }>,
): CommandResultContent {
  return { type: 'key-value', entries };
}

export function listContent(items: string[]): CommandResultContent {
  return { type: 'list', items };
}

/** Reads a string argument from the execution context. */
export function readStringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}
