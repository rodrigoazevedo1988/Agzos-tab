import path from 'node:path';

import type { ApplicationEntry } from '@shared/types/application';
import type { Ports } from '../app/ports';

export interface LaunchOutcome {
  ok: boolean;
  error?: string;
}

/**
 * Splits a Freedesktop `Exec` value into an executable plus arguments.
 * Supports double and single quotes; no shell expansion is ever performed.
 */
export function parseExecCommand(exec: string): { command: string; args: string[] } {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (const char of exec.trim()) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ' ') {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current.length > 0) tokens.push(current);

  const [command = '', ...args] = tokens;
  return { command, args };
}

/**
 * True when the launch target is a real filesystem path. On Linux a `.desktop`
 * `Exec` value is often a bare command name resolved through `PATH`, so it must
 * not be treated as a file path.
 */
export function isPathTarget(target: string): boolean {
  return path.isAbsolute(target);
}

/**
 * Launches an application entry.
 *
 * - Absolute targets (macOS `.app`, Windows `.lnk`/`.exe`) go through
 *   `shell.openPath`, which hands them to the OS shell.
 * - Bare commands (Linux `.desktop`) are spawned directly, without a shell,
 *   after the executable is resolved against `PATH`.
 */
export async function launchApplication(
  entry: ApplicationEntry,
  ports: Ports,
): Promise<LaunchOutcome> {
  if (isPathTarget(entry.launchTarget)) {
    const error = await ports.shell.openPath(entry.launchTarget);
    return error === '' ? { ok: true } : { ok: false, error };
  }

  const { command, args } = parseExecCommand(entry.launchTarget);
  if (command.length === 0) {
    return { ok: false, error: 'The desktop entry has no executable command' };
  }
  if (!(await ports.process.isAvailable(command))) {
    return { ok: false, error: `Executable "${command}" was not found on PATH` };
  }
  const result = await ports.process.spawnDetached(command, args);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
