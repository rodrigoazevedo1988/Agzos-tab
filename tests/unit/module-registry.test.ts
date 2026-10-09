import { describe, expect, it } from 'vitest';

import { defineCommand, success } from '@main/commands/define';
import { CommandRegistry } from '@main/commands/registry';
import { ModuleRegistry, type CommandModule } from '@main/extensions/module-registry';
import { createDeveloperModule } from '@main/extensions/modules/developer-module';

import type { ModuleManifest } from '@shared/types/extension';

function manifest(overrides: Partial<ModuleManifest> = {}): ModuleManifest {
  return {
    id: 'test.module',
    name: 'Test Module',
    version: '1.0.0',
    description: 'Module used in tests',
    category: 'tools',
    capabilities: ['commands:register'],
    ...overrides,
  };
}

function makeModule(): CommandModule {
  return {
    manifest: manifest(),
    register({ commands, declareCommand }) {
      declareCommand('mod.command');
      commands.register(
        defineCommand(
          {
            id: 'mod.command',
            name: 'Module Command',
            description: 'From a module',
            category: 'tools',
            keywords: [],
            icon: 'Circle',
            enabled: true,
            source: 'module',
            riskLevel: 'safe',
          },
          async () => success(),
        ),
      );
    },
  };
}

describe('ModuleRegistry', () => {
  it('registers a valid module and its commands', () => {
    const commands = new CommandRegistry();
    const modules = new ModuleRegistry({ commands, isEnabled: () => true });
    const summary = modules.registerModule(makeModule());
    expect(summary.commandIds).toEqual(['mod.command']);
    expect(commands.has('mod.command')).toBe(true);
  });

  it('rejects a module whose manifest is invalid', () => {
    const commands = new CommandRegistry();
    const modules = new ModuleRegistry({ commands, isEnabled: () => true });
    expect(() =>
      modules.registerModule({ ...makeModule(), manifest: manifest({ id: 'Bad Id' }) }),
    ).toThrow(/Invalid module manifest/);
  });

  it('rejects duplicate module ids', () => {
    const commands = new CommandRegistry();
    const modules = new ModuleRegistry({ commands, isEnabled: () => true });
    modules.registerModule(makeModule());
    expect(() => modules.registerModule(makeModule())).toThrow(/already registered/);
  });

  it('disables the commands of a module that starts disabled', () => {
    const commands = new CommandRegistry();
    const modules = new ModuleRegistry({ commands, isEnabled: () => false });
    modules.registerModule(makeModule());
    expect(commands.get('mod.command')?.metadata.enabled).toBe(false);
  });

  it('toggles all commands of a module as a unit', () => {
    const commands = new CommandRegistry();
    const modules = new ModuleRegistry({ commands, isEnabled: () => true });
    modules.registerModule(makeModule());
    expect(modules.setEnabled('test.module', false)).toBe(true);
    expect(commands.get('mod.command')?.metadata.enabled).toBe(false);
    modules.setEnabled('test.module', true);
    expect(commands.get('mod.command')?.metadata.enabled).toBe(true);
  });

  it('reports unknown module ids', () => {
    const commands = new CommandRegistry();
    const modules = new ModuleRegistry({ commands, isEnabled: () => true });
    expect(modules.setEnabled('missing', false)).toBe(false);
  });

  it('registers the shipped developer module', () => {
    const commands = new CommandRegistry();
    const modules = new ModuleRegistry({ commands, isEnabled: () => true });
    const summary = modules.registerModule(createDeveloperModule());
    expect(summary.commandIds).toContain('dev.generate-uuid');
    expect(commands.has('dev.copy-timestamp')).toBe(true);
  });
});
