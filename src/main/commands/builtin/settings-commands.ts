import { promises as fs } from 'node:fs';

import { defineCommand, failure, keyValueContent, success } from '../define';

import type { RegisteredCommand } from '@shared/types/command';
import type { CommandServices } from '../context';

export function createSettingsCommands(services: CommandServices): RegisteredCommand[] {
  return [
    defineCommand(
      {
        id: 'settings.open',
        name: 'Agzos Tab Settings',
        description: 'Open the settings view',
        category: 'settings',
        keywords: ['settings', 'preferences', 'config', 'configuracoes'],
        icon: 'Settings',
        enabled: true,
        source: 'builtin',
        riskLevel: 'safe',
      },
      async () => success('Settings opened', { navigateTo: 'settings' }),
    ),

    defineCommand(
      {
        id: 'settings.export',
        name: 'Export Settings',
        description: 'Save the current settings to a JSON file',
        category: 'settings',
        keywords: ['export', 'backup', 'json', 'exportar'],
        icon: 'Upload',
        enabled: true,
        source: 'builtin',
        riskLevel: 'caution',
      },
      async () => {
        const target = await services.ports.dialog.saveFile({
          title: 'Export Agzos Tab settings',
          defaultPath: 'agzos-tab-settings.json',
          filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (!target) return success('Export cancelled');

        const json = await services.settings.export();
        try {
          await fs.writeFile(target, json, 'utf8');
        } catch {
          return failure('UNAVAILABLE', 'Could not write the settings file');
        }
        return success('Settings exported');
      },
    ),

    defineCommand(
      {
        id: 'settings.import',
        name: 'Import Settings',
        description: 'Load settings from a JSON file (validated before applying)',
        category: 'settings',
        keywords: ['import', 'restore', 'json', 'importar'],
        icon: 'Download',
        enabled: true,
        source: 'builtin',
        riskLevel: 'caution',
      },
      async () => {
        const source = await services.ports.dialog.openFile({
          filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (!source) return success('Import cancelled');

        const confirmed = await services.ports.dialog.confirm({
          title: 'Import settings',
          message: 'Replace your current settings with the imported file?',
          detail: 'Your current configuration is kept if the file is invalid.',
        });
        if (!confirmed) return success('Import cancelled');

        let contents: string;
        try {
          contents = await fs.readFile(source, 'utf8');
        } catch {
          return failure('UNAVAILABLE', 'Could not read the selected file');
        }

        try {
          const outcome = await services.settings.import(contents);
          return success(
            outcome.warnings.length > 0
              ? `Settings imported with ${outcome.warnings.length} warning(s)`
              : 'Settings imported',
            {
              content: keyValueContent(
                outcome.warnings.map((warning) => ({ key: 'warning', value: warning })),
              ),
            },
          );
        } catch (error) {
          return failure(
            'INVALID_ARGUMENT',
            error instanceof Error ? error.message : 'The file could not be imported',
          );
        }
      },
    ),

    defineCommand(
      {
        id: 'app.version',
        name: 'Application Version',
        description: 'Show the Agzos Tab version and runtime details',
        category: 'developer',
        keywords: ['version', 'about', 'build', 'versao'],
        icon: 'Info',
        enabled: true,
        source: 'builtin',
        riskLevel: 'safe',
      },
      async () => {
        const info = services.appInfo();
        return success(`${info.name} ${info.version}`, {
          content: keyValueContent([
            { key: 'Version', value: info.version },
            { key: 'Platform', value: `${info.platform} (${info.arch})` },
            { key: 'Electron', value: info.electronVersion },
            { key: 'Node', value: info.nodeVersion },
            { key: 'Packaged', value: String(info.isPackaged) },
          ]),
        });
      },
    ),

    defineCommand(
      {
        id: 'help.shortcuts',
        name: 'Keyboard Shortcuts',
        description: 'Show the navigation shortcuts for the palette',
        category: 'navigation',
        keywords: ['help', 'shortcuts', 'keys', 'ajuda', 'atalhos'],
        icon: 'Keyboard',
        enabled: true,
        source: 'builtin',
        riskLevel: 'safe',
      },
      async () =>
        success('Keyboard shortcuts', {
          navigateTo: 'help',
          content: keyValueContent([
            { key: '↑ / ↓', value: 'Navigate results' },
            { key: 'Enter', value: 'Run the selected result' },
            { key: 'Escape', value: 'Close the palette / go back' },
            { key: 'Ctrl/Cmd+K', value: 'Clear the search field' },
            { key: 'Ctrl/Cmd+Shift+Space', value: 'Toggle the launcher (global)' },
          ]),
        }),
    ),
  ];
}
