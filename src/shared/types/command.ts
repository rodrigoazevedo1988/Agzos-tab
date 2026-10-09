/** Logical grouping used to organise commands in the palette. */
export type CommandCategory =
  | 'application'
  | 'navigation'
  | 'system'
  | 'tools'
  | 'developer'
  | 'integration'
  | 'ai'
  | 'settings';

/** Where a command comes from. Used for filtering and future permission policies. */
export type CommandSource = 'builtin' | 'system' | 'module' | 'extension' | 'ai';

/**
 * Risk classification. `destructive` commands must be confirmed by the user
 * before the main process executes them.
 */
export type CommandRiskLevel = 'safe' | 'caution' | 'destructive';

/** Serializable metadata describing a command. Handlers never live here. */
export interface CommandMetadata {
  id: string;
  name: string;
  description: string;
  category: CommandCategory;
  keywords: string[];
  /** Lucide icon name resolved by the renderer icon registry. */
  icon: string;
  /** Optional accelerator hint shown in the UI (not a real OS binding). */
  shortcut?: string;
  enabled: boolean;
  source: CommandSource;
  riskLevel: CommandRiskLevel;
  /** Explicit override; when omitted, `riskLevel === 'destructive'` implies true. */
  requiresConfirmation?: boolean;
}

/** Structured payload a command may return to be rendered in the palette. */
export type CommandResultContent =
  | { type: 'text'; text: string }
  | { type: 'key-value'; entries: Array<{ key: string; value: string }> }
  | { type: 'list'; items: string[] };

export interface CommandError {
  code: string;
  message: string;
}

/** Views the palette can switch to as an effect of a command. */
export type PaletteView = 'search' | 'settings' | 'favorites' | 'history' | 'help';

export interface CommandResult {
  success: boolean;
  message?: string;
  content?: CommandResultContent;
  error?: CommandError;
  /** When true, the palette closes after the command finishes. */
  closePalette?: boolean;
  /** Optional view the renderer should switch to. */
  navigateTo?: PaletteView;
}

/** Execution context handed to command handlers. */
export interface CommandExecutionContext {
  source: 'palette' | 'ipc';
  args: Record<string, unknown>;
}

export type CommandHandler = (context: CommandExecutionContext) => Promise<CommandResult>;

/** A command as registered at runtime: metadata plus its trusted handler. */
export interface RegisteredCommand {
  metadata: CommandMetadata;
  handler: CommandHandler;
}

export function commandRequiresConfirmation(metadata: CommandMetadata): boolean {
  return metadata.requiresConfirmation ?? metadata.riskLevel === 'destructive';
}
