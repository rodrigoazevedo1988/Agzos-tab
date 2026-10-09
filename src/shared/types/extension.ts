import type { CommandCategory } from './command';

/**
 * Capabilities a module may request. The main process only grants behaviour for
 * known capabilities; modules run in-process and are trusted code, so this list
 * documents intent and drives the permission UI rather than sandboxing.
 */
export type ModuleCapability =
  | 'commands:register'
  | 'applications:read'
  | 'history:read'
  | 'history:write'
  | 'favorites:read'
  | 'favorites:write'
  | 'settings:read'
  | 'settings:write'
  | 'clipboard:read'
  | 'clipboard:write'
  | 'shell:open-path'
  | 'shell:open-external'
  | 'notifications'
  | 'ai:invoke';

/** Serializable module metadata. Handlers never live here. */
export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  /** Primary category of the commands the module contributes. */
  category: CommandCategory;
  /** Semver range of the host required by this module. */
  engine?: string;
  capabilities: ModuleCapability[];
  /** Arbitrary JSON metadata; must not contain code. */
  metadata?: Record<string, unknown>;
}

export interface ModuleSummary {
  manifest: ModuleManifest;
  enabled: boolean;
  commandIds: string[];
}
