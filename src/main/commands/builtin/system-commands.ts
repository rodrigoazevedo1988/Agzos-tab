import { promises as fs } from 'node:fs';

import { z } from 'zod';

import { isAllowedExternalUrl } from '../../security/validators';
import {
  defineCommand,
  failure,
  keyValueContent,
  readStringArg,
  success,
  textContent,
} from '../define';

import type { RegisteredCommand } from '@shared/types/command';
import type { CommandServices } from '../context';

const calculatorCandidates: Record<string, string[]> = {
  darwin: ['/System/Applications/Calculator.app', '/Applications/Calculator.app'],
  win32: ['C:\\Windows\\System32\\calc.exe'],
  linux: ['gnome-calculator', 'kcalc', 'mate-calc', 'qalculate-gnome', 'xcalc'],
};

const openUrlSchema = z.object({ url: z.string().min(1).max(2048) });
const copyTextSchema = z.object({ text: z.string().min(1).max(10_000) });

/** Builtin commands backed by the OS. */
export function createSystemCommands(services: CommandServices): RegisteredCommand[] {
  return [
    defineCommand(
      {
        id: 'system.open-calculator',
        name: 'Open Calculator',
        description: 'Launch the system calculator application',
        category: 'system',
        keywords: ['calc', 'math', 'numbers', 'calculadora'],
        icon: 'Calculator',
        enabled: true,
        source: 'system',
        riskLevel: 'safe',
      },
      async ({ args }) => {
        const candidates = calculatorCandidates[services.appInfo().platform] ?? [];
        for (const candidate of candidates) {
          if (candidate.startsWith('/') || candidate.includes('\\')) {
            if (await pathExists(candidate)) {
              const error = await services.ports.shell.openPath(candidate);
              if (error === '') return success('Calculator opened');
            }
          } else if (await services.ports.process.isAvailable(candidate)) {
            const result = await services.ports.process.spawnDetached(candidate, []);
            if (result.ok) return success('Calculator opened');
          }
        }
        void args;
        return failure('UNAVAILABLE', 'No calculator application was found on this system');
      },
    ),

    defineCommand(
      {
        id: 'system.open-browser',
        name: 'Open Default Browser',
        description: 'Open the system default browser at a neutral page',
        category: 'system',
        keywords: ['browser', 'web', 'internet', 'navegador'],
        icon: 'Globe',
        enabled: true,
        source: 'system',
        riskLevel: 'safe',
      },
      async ({ args }) => {
        const requested = readStringArg(args, 'url') ?? 'https://duckduckgo.com/';
        if (!isAllowedExternalUrl(requested)) {
          return failure('INVALID_ARGUMENT', 'Only http and https URLs can be opened');
        }
        try {
          await services.ports.shell.openExternal(requested);
          return success('Browser opened');
        } catch {
          return failure('UNAVAILABLE', 'Could not open the default browser');
        }
      },
    ),

    defineCommand(
      {
        id: 'system.open-url',
        name: 'Open URL',
        description: 'Open an http or https URL in the default browser (validated)',
        category: 'system',
        keywords: ['url', 'link', 'open', 'website'],
        icon: 'Link',
        enabled: true,
        source: 'system',
        riskLevel: 'caution',
      },
      async ({ args }) => {
        const parsed = openUrlSchema.safeParse(args);
        if (!parsed.success)
          return failure('INVALID_ARGUMENT', 'A non-empty url argument is required');
        if (!isAllowedExternalUrl(parsed.data.url)) {
          return failure('INVALID_ARGUMENT', 'Only http and https URLs are allowed');
        }
        try {
          await services.ports.shell.openExternal(parsed.data.url);
          return success('URL opened');
        } catch {
          return failure('UNAVAILABLE', 'Could not open the URL');
        }
      },
    ),

    defineCommand(
      {
        id: 'system.open-directory',
        name: 'Open Directory…',
        description: 'Pick a folder and open it in the file manager',
        category: 'system',
        keywords: ['folder', 'directory', 'open', 'pasta'],
        icon: 'FolderOpen',
        enabled: true,
        source: 'system',
        riskLevel: 'safe',
      },
      async () => {
        const directory = await services.ports.dialog.openDirectory();
        if (!directory) return success('No directory selected');
        const error = await services.ports.shell.openPath(directory);
        return error === ''
          ? success('Directory opened')
          : failure('UNAVAILABLE', `Could not open the directory: ${error}`);
      },
    ),

    defineCommand(
      {
        id: 'system.open-files',
        name: 'Open File(s)…',
        description: 'Pick one or more files and open them with their default application',
        category: 'system',
        keywords: ['file', 'open', 'document', 'arquivo'],
        icon: 'FileText',
        enabled: true,
        source: 'system',
        riskLevel: 'safe',
      },
      async () => {
        const files = await services.ports.dialog.openFiles();
        if (files.length === 0) return success('No files selected');
        const failures: string[] = [];
        for (const file of files) {
          const error = await services.ports.shell.openPath(file);
          if (error !== '') failures.push(file);
        }
        if (failures.length === 0) return success(`${files.length} file(s) opened`);
        return failure(
          'UNAVAILABLE',
          `Could not open ${failures.length} of ${files.length} file(s)`,
        );
      },
    ),

    defineCommand(
      {
        id: 'system.date-time',
        name: 'Date and Time',
        description: 'Show the current local date and time',
        category: 'system',
        keywords: ['date', 'time', 'clock', 'hora', 'data'],
        icon: 'Clock',
        enabled: true,
        source: 'system',
        riskLevel: 'safe',
      },
      async () => {
        const now = new Date();
        return success('Current local date and time', {
          content: keyValueContent([
            { key: 'Date', value: now.toLocaleDateString() },
            { key: 'Time', value: now.toLocaleTimeString() },
            { key: 'ISO 8601', value: now.toISOString() },
          ]),
        });
      },
    ),

    defineCommand(
      {
        id: 'system.copy-text',
        name: 'Copy Text to Clipboard',
        description: 'Copy the provided text to the system clipboard',
        category: 'tools',
        keywords: ['clipboard', 'copy', 'copiar'],
        icon: 'ClipboardCopy',
        enabled: true,
        source: 'system',
        riskLevel: 'safe',
      },
      async ({ args }) => {
        const parsed = copyTextSchema.safeParse(args);
        if (!parsed.success)
          return failure('INVALID_ARGUMENT', 'A non-empty text argument is required');
        await services.ports.clipboard.writeText(parsed.data.text);
        return success('Copied to clipboard', { content: textContent(parsed.data.text) });
      },
    ),

    defineCommand(
      {
        id: 'system.capabilities',
        name: 'Platform Capabilities',
        description: 'Show which OS integrations are available on this machine',
        category: 'system',
        keywords: ['capabilities', 'platform', 'diagnostics', 'recursos'],
        icon: 'Activity',
        enabled: true,
        source: 'system',
        riskLevel: 'safe',
      },
      async () => {
        const capabilities = services.capabilities();
        return success('Platform capabilities', {
          content: keyValueContent(
            Object.entries(capabilities).map(([key, value]) => ({
              key,
              value: String(value),
            })),
          ),
        });
      },
    ),
  ];
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}
