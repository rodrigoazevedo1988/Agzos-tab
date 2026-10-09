import { describe, expect, it } from 'vitest';

import { defineCommand, failure, success } from '@main/commands/define';
import { CommandExecutor } from '@main/commands/executor';
import { CommandRegistry } from '@main/commands/registry';
import { HistoryService } from '@main/services/history-service';

import { createFakePorts } from '../helpers/fake-ports';
import { makeTempDir } from '../helpers/temp-dir';

import type { CommandMetadata, CommandResult } from '@shared/types/command';

function metadata(overrides: Partial<CommandMetadata> = {}): CommandMetadata {
  return {
    id: 'test.command',
    name: 'Test Command',
    description: 'A command used in tests',
    category: 'tools',
    keywords: [],
    icon: 'Circle',
    enabled: true,
    source: 'builtin',
    riskLevel: 'safe',
    ...overrides,
  };
}

async function makeExecutor(): Promise<{
  executor: CommandExecutor;
  registry: CommandRegistry;
  history: HistoryService;
  ports: ReturnType<typeof createFakePorts>;
}> {
  const dir = await makeTempDir();
  const registry = new CommandRegistry();
  const history = new HistoryService(dir, () => ({ enabled: true, maxEntries: 10 }));
  const ports = createFakePorts();
  const executor = new CommandExecutor(registry, history, ports.dialog);
  return { executor, registry, history, ports };
}

describe('CommandExecutor', () => {
  it('returns NOT_FOUND for an unknown command', async () => {
    const { executor } = await makeExecutor();
    const result = await executor.execute({
      commandId: 'ghost',
      args: {},
      confirmed: false,
      source: 'palette',
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('refuses to run a disabled command', async () => {
    const { executor, registry } = await makeExecutor();
    registry.register(defineCommand(metadata({ enabled: false }), async () => success()));
    const result = await executor.execute({
      commandId: 'test.command',
      args: {},
      confirmed: false,
      source: 'palette',
    });
    expect(result.error?.code).toBe('PERMISSION_DENIED');
  });

  it('records successful executions in the history', async () => {
    const { executor, registry, history } = await makeExecutor();
    registry.register(defineCommand(metadata(), async () => success('done')));
    await executor.execute({
      commandId: 'test.command',
      args: {},
      confirmed: false,
      source: 'palette',
    });
    expect((await history.list())[0]?.id).toBe('test.command');
  });

  it('does not record failed executions', async () => {
    const { executor, registry, history } = await makeExecutor();
    registry.register(defineCommand(metadata(), async () => failure('X', 'nope')));
    await executor.execute({
      commandId: 'test.command',
      args: {},
      confirmed: false,
      source: 'palette',
    });
    expect(await history.list()).toEqual([]);
  });

  it('asks for confirmation on destructive commands', async () => {
    const { executor, registry, ports } = await makeExecutor();
    registry.register(
      defineCommand(metadata({ riskLevel: 'destructive' }), async () => success('ran')),
    );
    const result = await executor.execute({
      commandId: 'test.command',
      args: {},
      confirmed: false,
      source: 'palette',
    });
    expect(ports.confirmCalls).toHaveLength(1);
    expect(result.success).toBe(true);
  });

  it('does not run a destructive command when the user cancels', async () => {
    const { executor, registry, ports } = await makeExecutor();
    let ran = false;
    registry.register(
      defineCommand(metadata({ riskLevel: 'destructive' }), async () => {
        ran = true;
        return success();
      }),
    );
    ports.confirmResult = false;
    const result = await executor.execute({
      commandId: 'test.command',
      args: {},
      confirmed: false,
      source: 'palette',
    });
    expect(ran).toBe(false);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('CONFIRMATION_REQUIRED');
  });

  it('skips confirmation when already confirmed', async () => {
    const { executor, registry, ports } = await makeExecutor();
    registry.register(defineCommand(metadata({ riskLevel: 'destructive' }), async () => success()));
    await executor.execute({
      commandId: 'test.command',
      args: {},
      confirmed: true,
      source: 'palette',
    });
    expect(ports.confirmCalls).toHaveLength(0);
  });

  it('converts a thrown handler error into a safe result', async () => {
    const { executor, registry } = await makeExecutor();
    registry.register(
      defineCommand(metadata(), async () => {
        throw new Error('secret internal detail');
      }),
    );
    const result: CommandResult = await executor.execute({
      commandId: 'test.command',
      args: {},
      confirmed: false,
      source: 'palette',
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INTERNAL');
    expect(result.error?.message).not.toContain('secret internal detail');
  });

  it('passes validated args through to the handler', async () => {
    const { executor, registry } = await makeExecutor();
    let received: Record<string, unknown> = {};
    registry.register(
      defineCommand(metadata(), async (context) => {
        received = context.args;
        return success();
      }),
    );
    await executor.execute({
      commandId: 'test.command',
      args: { text: 'hello' },
      confirmed: false,
      source: 'palette',
    });
    expect(received).toEqual({ text: 'hello' });
  });
});
