import { ipcMain, type IpcMainInvokeEvent } from 'electron';

import { IPC, INVOKABLE_CHANNELS, type IpcChannel, type IpcResponse } from '@shared/ipc';
import { ipcFail, ipcOk, parseArgs } from '@shared/ipc-envelope';

import { createLogger } from '../logger';

import { ipcSchemas } from './schemas';

import type { z } from 'zod';
import type { AppInfo, SystemCapabilities } from '@shared/types/system';
import type { ApplicationsCatalog } from '../applications/catalog';
import type { Ports } from '../app/ports';
import type { GlobalShortcutManager } from '../app/shortcuts/global-shortcut';
import type { PaletteWindowManager } from '../app/windows/palette-window';
import type { CommandExecutor } from '../commands/executor';
import type { CommandRegistry } from '../commands/registry';
import type { IpcGuard } from '../security/ipc-guard';
import type { FavoritesService } from '../services/favorites-service';
import type { HistoryService } from '../services/history-service';
import type { SearchService } from '../services/search/search-service';
import type { SettingsService } from '../services/settings-service';

const log = createLogger('ipc');

export interface IpcContext {
  guard: IpcGuard;
  palette: PaletteWindowManager;
  registry: CommandRegistry;
  executor: CommandExecutor;
  search: SearchService;
  applications: ApplicationsCatalog;
  settings: SettingsService;
  history: HistoryService;
  favorites: FavoritesService;
  shortcuts: GlobalShortcutManager;
  ports: Ports;
  appInfo: () => AppInfo;
  capabilities: () => SystemCapabilities;
}

type HandlerPayload<S> = S extends z.ZodTypeAny ? z.infer<S> : undefined;

/**
 * Registers every IPC handler. Only channels in the allow-list are bound, the
 * sender origin is verified, arguments are schema-validated and all failures are
 * returned as envelopes — nothing is ever thrown across the bridge.
 */
export function registerIpcHandlers(context: IpcContext): void {
  const { guard, palette, registry, executor, search, applications, settings } = context;
  const { history, favorites, shortcuts, ports, appInfo, capabilities } = context;

  const defineHandler = <S extends z.ZodTypeAny | null, R>(
    channel: IpcChannel,
    schema: S,
    handler: (payload: HandlerPayload<S>) => Promise<R>,
  ): void => {
    if (!INVOKABLE_CHANNELS.includes(channel)) {
      throw new Error(`Refusing to register non-allow-listed channel "${channel}"`);
    }
    ipcMain.handle(
      channel,
      async (event: IpcMainInvokeEvent, rawPayload: unknown): Promise<IpcResponse<R>> => {
        if (!guard.isTrusted(event)) {
          log.warn(`Rejected IPC message from an untrusted sender on ${channel}`);
          return ipcFail('PERMISSION_DENIED', 'Untrusted IPC sender');
        }

        let payload = rawPayload as HandlerPayload<S>;
        if (schema) {
          const parsed = parseArgs(schema, rawPayload);
          if (!parsed.success) return { ok: false, error: parsed.error };
          payload = parsed.data as HandlerPayload<S>;
        }

        try {
          return ipcOk(await handler(payload));
        } catch (error) {
          // Domain errors carry a message intended for the user; anything else is
          // reduced to a generic internal error.
          const message = error instanceof Error ? error.message : 'Unexpected error';
          log.warn(`Handler ${channel} failed`, { reason: (error as Error).name });
          return ipcFail('INTERNAL', message);
        }
      },
    );
  };

  /* ---------------------------- app ---------------------------- */
  defineHandler(IPC.appGetInfo, null, async () => appInfo());

  /* --------------------------- window -------------------------- */
  defineHandler(IPC.windowHide, null, async () => {
    palette.hide();
  });
  defineHandler(IPC.windowShow, null, async () => {
    palette.show();
  });
  defineHandler(IPC.windowToggle, null, async () => palette.toggle());
  defineHandler(IPC.windowClosePalette, null, async () => {
    palette.hide();
  });
  defineHandler(IPC.windowSetHeight, ipcSchemas.windowSetHeight, async ({ height }) => {
    palette.setHeight(height);
  });

  /* -------------------------- commands ------------------------- */
  defineHandler(IPC.commandsSearch, ipcSchemas.commandsSearch, async ({ query, limit }) =>
    search.search(query, limit),
  );
  defineHandler(IPC.commandsList, null, async () => registry.list());
  defineHandler(
    IPC.commandsExecute,
    ipcSchemas.commandsExecute,
    async ({ commandId, args, confirmed }) =>
      // A confirmation dialog steals focus, so auto-hide is paused meanwhile.
      palette.withAutoHideSuppressed(() =>
        executor.execute({
          commandId,
          args: args ?? {},
          confirmed: confirmed === true,
          source: 'palette',
        }),
      ),
  );

  /* ------------------------ applications ----------------------- */
  defineHandler(IPC.applicationsSearch, ipcSchemas.applicationsSearch, async ({ query }) =>
    applications.search(query, 20),
  );
  defineHandler(IPC.applicationsRefresh, null, async () => {
    const catalog = await applications.refresh();
    return {
      count: catalog.entries.length,
      warnings: catalog.warnings,
      scannedAt: catalog.scannedAt,
    };
  });
  defineHandler(IPC.applicationsLaunch, ipcSchemas.applicationsLaunch, async ({ applicationId }) =>
    executor.execute({
      commandId: 'applications.launch',
      args: { applicationId },
      confirmed: true,
      source: 'ipc',
    }),
  );

  /* -------------------------- favorites ------------------------ */
  defineHandler(IPC.favoritesList, null, async () => favorites.list());
  defineHandler(IPC.favoritesToggle, ipcSchemas.favoritesToggle, async (payload) =>
    favorites.toggle(payload),
  );
  defineHandler(IPC.favoritesReorder, ipcSchemas.favoritesReorder, async ({ ids }) =>
    favorites.reorder(ids),
  );

  /* --------------------------- history ------------------------- */
  defineHandler(IPC.historyList, null, async () => history.list());
  defineHandler(IPC.historyClear, null, async () => {
    await history.clear();
  });
  defineHandler(IPC.historyRemove, ipcSchemas.historyRemove, async ({ id }) => {
    await history.remove(id);
  });

  /* -------------------------- settings ------------------------- */
  defineHandler(IPC.settingsGet, null, async () => settings.get());
  defineHandler(IPC.settingsUpdate, ipcSchemas.settingsUpdate, async (patch) =>
    settings.update(patch),
  );
  defineHandler(IPC.settingsReset, null, async () => settings.reset());
  defineHandler(IPC.settingsExport, null, async () => settings.export());
  defineHandler(IPC.settingsImport, ipcSchemas.settingsImport, async ({ json }) =>
    settings.import(json),
  );

  /* --------------------------- system -------------------------- */
  defineHandler(IPC.systemCapabilities, null, async () => capabilities());
  defineHandler(IPC.shortcutRegister, ipcSchemas.shortcutRegister, async ({ accelerator }) =>
    shortcuts.register(accelerator, () => palette.toggle()),
  );

  void ports;
  log.info(`Registered ${INVOKABLE_CHANNELS.length} IPC channels`);
}
