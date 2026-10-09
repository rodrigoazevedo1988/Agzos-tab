import { moduleManifestSchema } from './manifest-schema';

import type { ModuleCapability, ModuleManifest, ModuleSummary } from '@shared/types/extension';
import type { CommandRegistry } from '../commands/registry';

export interface ModuleRegistrationContext {
  commands: CommandRegistry;
  hasCapability(capability: ModuleCapability): boolean;
  /** Marks a command id as owned by this module (for enable/disable rollback). */
  declareCommand(commandId: string): void;
}

/**
 * A module is trusted, in-process code that contributes commands. Its manifest
 * is validated before registration and its commands are tracked so the module
 * can be enabled/disabled as a unit.
 */
export interface CommandModule {
  readonly manifest: ModuleManifest;
  register(context: ModuleRegistrationContext): void;
  dispose?(): void;
}

export interface ModuleRegistryOptions {
  commands: CommandRegistry;
  isEnabled(moduleId: string): boolean;
}

/**
 * MVP extension surface: no external plugin loading, no dynamic `import()` of
 * untrusted code. Modules are compiled in and registered programmatically.
 */
export class ModuleRegistry {
  private readonly modules = new Map<string, { module: CommandModule; commandIds: string[] }>();
  private readonly commands: CommandRegistry;
  private readonly isEnabled: (moduleId: string) => boolean;

  constructor(options: ModuleRegistryOptions) {
    this.commands = options.commands;
    this.isEnabled = options.isEnabled;
  }

  registerModule(module: CommandModule): ModuleSummary {
    const parsed = moduleManifestSchema.safeParse(module.manifest);
    if (!parsed.success) {
      throw new Error(
        `Invalid module manifest for "${module.manifest?.id ?? 'unknown'}": ${parsed.error.issues[0]?.message ?? 'schema error'}`,
      );
    }
    const manifest = parsed.data as ModuleManifest;
    if (this.modules.has(manifest.id)) {
      throw new Error(`Module "${manifest.id}" is already registered`);
    }

    const commandIds: string[] = [];
    const enabled = this.isEnabled(manifest.id);
    const capabilities = new Set(manifest.capabilities);

    module.register({
      commands: this.commands,
      hasCapability: (capability) => capabilities.has(capability),
      // `declareCommand` records ownership so the module can later be toggled as
      // a unit. Toggling happens *after* registration: at declare time the
      // command does not exist yet, so flipping it here would be overwritten by
      // the module's own `commands.register(...)` call.
      declareCommand: (commandId) => {
        commandIds.push(commandId);
      },
    });

    if (!enabled) {
      for (const commandId of commandIds) {
        this.commands.setEnabled(commandId, false);
      }
    }

    this.modules.set(manifest.id, { module, commandIds });
    return { manifest, enabled, commandIds };
  }

  list(): ModuleSummary[] {
    return Array.from(this.modules.values()).map(({ module, commandIds }) => ({
      manifest: module.manifest,
      enabled: this.isEnabled(module.manifest.id),
      commandIds,
    }));
  }

  /** Enables or disables all commands contributed by a module. */
  setEnabled(moduleId: string, enabled: boolean): boolean {
    const entry = this.modules.get(moduleId);
    if (!entry) return false;
    for (const commandId of entry.commandIds) {
      this.commands.setEnabled(commandId, enabled);
    }
    return true;
  }

  disposeAll(): void {
    for (const { module } of this.modules.values()) {
      module.dispose?.();
    }
    this.modules.clear();
  }
}
