import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

import { AgzosApiError } from '@shared/errors';
import {
  IPC,
  type IpcResponse,
  type IpcResponseMap,
  type NavigateEvent,
  type VisibilityEvent,
} from '@shared/ipc';

import type { AgzosApi } from '@shared/api';
import type { PaletteView } from '@shared/types/command';

/**
 * Invokes an allow-listed channel and unwraps the response envelope.
 *
 * The renderer can never choose a channel: each exposed method hard-codes its
 * channel constant, and only channels registered in the main process respond.
 */
async function invoke<C extends keyof IpcResponseMap>(
  channel: C,
  payload?: unknown,
): Promise<IpcResponseMap[C]> {
  const response = (await ipcRenderer.invoke(channel, payload)) as IpcResponse<IpcResponseMap[C]>;
  if (response === null || typeof response !== 'object' || !('ok' in response)) {
    throw new AgzosApiError('INTERNAL', 'Malformed IPC response');
  }
  if (response.ok) return response.data;
  throw new AgzosApiError(response.error.code, response.error.message);
}

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T): void => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const api: AgzosApi = {
  app: {
    getInfo: () => invoke(IPC.appGetInfo),
  },
  window: {
    hide: () => invoke(IPC.windowHide),
    show: () => invoke(IPC.windowShow),
    toggle: () => invoke(IPC.windowToggle),
    closePalette: () => invoke(IPC.windowClosePalette),
    setHeight: (height) => invoke(IPC.windowSetHeight, { height }),
    onVisibilityChanged: (listener) =>
      subscribe<VisibilityEvent>(IPC.eventVisibility, (payload) =>
        listener(Boolean(payload?.visible)),
      ),
    onNavigate: (listener) =>
      subscribe<NavigateEvent>(IPC.eventNavigate, (payload) =>
        listener(payload?.view as PaletteView),
      ),
  },
  commands: {
    search: (query, limit) => invoke(IPC.commandsSearch, { query, ...(limit ? { limit } : {}) }),
    execute: (commandId, args, confirmed) =>
      invoke(IPC.commandsExecute, {
        commandId,
        args: args ?? {},
        confirmed: confirmed === true,
      }),
    list: () => invoke(IPC.commandsList),
  },
  applications: {
    search: (query) => invoke(IPC.applicationsSearch, { query }),
    refresh: () => invoke(IPC.applicationsRefresh),
    launch: (applicationId) => invoke(IPC.applicationsLaunch, { applicationId }),
  },
  favorites: {
    list: () => invoke(IPC.favoritesList),
    toggle: (id, kind, title) => invoke(IPC.favoritesToggle, { id, kind, title }),
    reorder: (ids) => invoke(IPC.favoritesReorder, { ids }),
  },
  history: {
    list: () => invoke(IPC.historyList),
    clear: () => invoke(IPC.historyClear),
    remove: (id) => invoke(IPC.historyRemove, { id }),
  },
  settings: {
    get: () => invoke(IPC.settingsGet),
    update: (patch) => invoke(IPC.settingsUpdate, patch),
    reset: () => invoke(IPC.settingsReset),
    export: () => invoke(IPC.settingsExport),
    import: (json) => invoke(IPC.settingsImport, { json }),
  },
  system: {
    getCapabilities: () => invoke(IPC.systemCapabilities),
    registerShortcut: (accelerator) => invoke(IPC.shortcutRegister, { accelerator }),
  },
};

contextBridge.exposeInMainWorld('agzos', api);
