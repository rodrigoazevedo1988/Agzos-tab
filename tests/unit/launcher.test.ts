import { describe, expect, it } from 'vitest';

import { isPathTarget, launchApplication, parseExecCommand } from '@main/applications/launcher';

import { createFakePorts } from '../helpers/fake-ports';

import type { ApplicationEntry } from '@shared/types/application';

function entry(launchTarget: string): ApplicationEntry {
  return {
    id: 'app-id',
    name: 'Example',
    path: '/usr/share/applications/example.desktop',
    launchTarget,
    source: 'linux-desktop-system',
    platform: 'linux',
    keywords: ['example'],
  };
}

describe('parseExecCommand', () => {
  it('splits a command and its arguments', () => {
    expect(parseExecCommand('code --new-window')).toEqual({
      command: 'code',
      args: ['--new-window'],
    });
  });

  it('honours quoted arguments', () => {
    expect(parseExecCommand('app "a b" c')).toEqual({ command: 'app', args: ['a b', 'c'] });
  });

  it('handles a command without arguments', () => {
    expect(parseExecCommand('notes')).toEqual({ command: 'notes', args: [] });
  });
});

describe('isPathTarget', () => {
  it('distinguishes absolute paths from bare commands', () => {
    expect(isPathTarget('/Applications/Thing.app')).toBe(true);
    expect(isPathTarget('notes')).toBe(false);
  });
});

describe('launchApplication', () => {
  it('opens absolute targets through the shell port', async () => {
    const ports = createFakePorts();
    const outcome = await launchApplication(entry('/Applications/Thing.app'), ports);
    expect(outcome.ok).toBe(true);
    expect(ports.openedPaths).toContain('/Applications/Thing.app');
  });

  it('spawns bare commands without a shell', async () => {
    const ports = createFakePorts();
    const outcome = await launchApplication(entry('notes --new'), ports);
    expect(outcome.ok).toBe(true);
    expect(ports.spawned).toEqual([{ command: 'notes', args: ['--new'] }]);
  });

  it('reports a missing executable', async () => {
    const ports = createFakePorts();
    ports.process.isAvailable = async () => false;
    const outcome = await launchApplication(entry('ghost'), ports);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain('not found on PATH');
  });

  it('reports an empty command', async () => {
    const ports = createFakePorts();
    const outcome = await launchApplication(entry('   '), ports);
    expect(outcome.ok).toBe(false);
  });
});
