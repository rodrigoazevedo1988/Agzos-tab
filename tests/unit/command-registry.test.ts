import { describe, expect, it } from 'vitest';

import { defineCommand, success } from '@main/commands/define';
import { CommandRegistry } from '@main/commands/registry';

import type { CommandMetadata, CommandResult } from '@shared/types/command';

function metadata(overrides: Partial<CommandMetadata> = {}): CommandMetadata {
  return {
    id: 'test.command',
    name: 'Test Command',
    description: 'A command used in tests',
    category: 'tools',
    keywords: ['test'],
    icon: 'Circle',
    enabled: true,
    source: 'builtin',
    riskLevel: 'safe',
    ...overrides,
  };
}

const handler = async (): Promise<CommandResult> => success('ok');

describe('CommandRegistry', () => {
  it('registers and retrieves commands', () => {
    const registry = new CommandRegistry();
    registry.register(defineCommand(metadata(), handler));
    expect(registry.has('test.command')).toBe(true);
    expect(registry.get('test.command')?.metadata.name).toBe('Test Command');
    expect(registry.size).toBe(1);
  });

  it('rejects duplicate ids', () => {
    const registry = new CommandRegistry();
    registry.register(defineCommand(metadata(), handler));
    expect(() => registry.register(defineCommand(metadata(), handler))).toThrow(
      /already registered/,
    );
  });

  it('toggles enabled state', () => {
    const registry = new CommandRegistry();
    registry.register(defineCommand(metadata(), handler));
    registry.setEnabled('test.command', false);
    expect(registry.get('test.command')?.metadata.enabled).toBe(false);
    expect(registry.resolveHandler('test.command')).toBeUndefined();
  });

  it('finds commands by name, description and keywords', () => {
    const registry = new CommandRegistry();
    registry.register(
      defineCommand(metadata({ id: 'a', name: 'Open Calculator', keywords: ['math'] }), handler),
    );
    registry.register(
      defineCommand(metadata({ id: 'b', name: 'Clear History', keywords: ['cleanup'] }), handler),
    );
    expect(registry.search('calculator', 5).map((hit) => hit.metadata.id)).toContain('a');
    expect(registry.search('math', 5).map((hit) => hit.metadata.id)).toContain('a');
    expect(registry.search('history', 5).map((hit) => hit.metadata.id)).toContain('b');
  });

  it('returns every enabled command for an empty query', () => {
    const registry = new CommandRegistry();
    registry.register(defineCommand(metadata({ id: 'a' }), handler));
    registry.register(defineCommand(metadata({ id: 'b' }), handler));
    registry.setEnabled('b', false);
    const hits = registry.search('', 10);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.metadata.id).toBe('a');
  });

  it('honours the search limit', () => {
    const registry = new CommandRegistry();
    for (let index = 0; index < 5; index += 1) {
      registry.register(defineCommand(metadata({ id: `cmd-${index}` }), handler));
    }
    expect(registry.search('cmd', 3)).toHaveLength(3);
  });

  it('groups commands by category', () => {
    const registry = new CommandRegistry();
    registry.register(defineCommand(metadata({ id: 'a', category: 'system' }), handler));
    registry.register(defineCommand(metadata({ id: 'b', category: 'tools' }), handler));
    const grouped = registry.listByCategory();
    expect(grouped.get('system')).toHaveLength(1);
    expect(grouped.get('tools')).toHaveLength(1);
  });
});
