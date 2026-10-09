import type { Settings } from './settings-schema';
import type { ApplicationEntry } from './types/application';
import type { CommandMetadata, CommandResult } from './types/command';
import type { FavoriteEntry, HistoryEntry } from './types/history';
import type { SearchResponse } from './types/search';
import type { AppInfo, ShortcutRegistrationResult, SystemCapabilities } from './types/system';

/**
 * The complete allow-list of IPC channels. The preload exposes exactly one
 * function per channel and the main process only registers handlers for these.
 * A renderer can never invoke an arbitrary channel.
 */
export const IPC = {
  appGetInfo: 'agzos:app:get-info',

  windowHide: 'agzos:window:hide',
  windowShow: 'agzos:window:show',
  windowToggle: 'agzos:window:toggle',
  windowClosePalette: 'agzos:window:close-palette',
  windowSetHeight: 'agzos:window:set-height',

  commandsSearch: 'agzos:commands:search',
  commandsExecute: 'agzos:commands:execute',
  commandsList: 'agzos:commands:list',

  applicationsSearch: 'agzos:applications:search',
  applicationsRefresh: 'agzos:applications:refresh',
  applicationsLaunch: 'agzos:applications:launch',

  favoritesList: 'agzos:favorites:list',
  favoritesToggle: 'agzos:favorites:toggle',
  favoritesReorder: 'agzos:favorites:reorder',

  historyList: 'agzos:history:list',
  historyClear: 'agzos:history:clear',
  historyRemove: 'agzos:history:remove',

  settingsGet: 'agzos:settings:get',
  settingsUpdate: 'agzos:settings:update',
  settingsReset: 'agzos:settings:reset',
  settingsExport: 'agzos:settings:export',
  settingsImport: 'agzos:settings:import',

  systemCapabilities: 'agzos:system:capabilities',
  shortcutRegister: 'agzos:system:register-shortcut',

  /** main → renderer push events. */
  eventVisibility: 'agzos:event:visibility',
  eventNavigate: 'agzos:event:navigate',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

/** Channels the renderer is allowed to invoke (everything except push events). */
export const INVOKABLE_CHANNELS: readonly IpcChannel[] = [
  IPC.appGetInfo,
  IPC.windowHide,
  IPC.windowShow,
  IPC.windowToggle,
  IPC.windowClosePalette,
  IPC.windowSetHeight,
  IPC.commandsSearch,
  IPC.commandsExecute,
  IPC.commandsList,
  IPC.applicationsSearch,
  IPC.applicationsRefresh,
  IPC.applicationsLaunch,
  IPC.favoritesList,
  IPC.favoritesToggle,
  IPC.favoritesReorder,
  IPC.historyList,
  IPC.historyClear,
  IPC.historyRemove,
  IPC.settingsGet,
  IPC.settingsUpdate,
  IPC.settingsReset,
  IPC.settingsExport,
  IPC.settingsImport,
  IPC.systemCapabilities,
  IPC.shortcutRegister,
];

export type IpcErrorCode =
  | 'INVALID_ARGUMENT'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'CONFIRMATION_REQUIRED'
  | 'UNAVAILABLE'
  | 'INTERNAL';

export interface IpcError {
  code: IpcErrorCode;
  message: string;
}

/** Predictable response envelope for every invoke channel. */
export type IpcResponse<T> = { ok: true; data: T } | { ok: false; error: IpcError };

/* ------------------------------------------------------------------ */
/* Payload contract per channel (request → response)                   */
/* ------------------------------------------------------------------ */

export interface SearchArgs {
  query: string;
  limit?: number;
}

export interface ExecuteArgs {
  commandId: string;
  args?: Record<string, unknown>;
  /** Set when the user already accepted a confirmation dialog. */
  confirmed?: boolean;
}

export interface ApplicationsRefreshResult {
  count: number;
  warnings: string[];
  scannedAt: string;
}

export interface SettingsImportResult {
  settings: Settings;
  warnings: string[];
}

export interface FavoriteToggleArgs {
  id: string;
  kind: 'command' | 'application';
  title: string;
}

export interface HistoryRemoveArgs {
  id: string;
}

export interface WindowSetHeightArgs {
  height: number;
}

export interface ShortcutRegisterArgs {
  accelerator: string;
}

/** Return-type map keyed by channel, used to strongly type the preload bridge. */
export interface IpcResponseMap {
  [IPC.appGetInfo]: AppInfo;
  [IPC.windowHide]: void;
  [IPC.windowShow]: void;
  [IPC.windowToggle]: boolean;
  [IPC.windowClosePalette]: void;
  [IPC.windowSetHeight]: void;
  [IPC.commandsSearch]: SearchResponse;
  [IPC.commandsExecute]: CommandResult;
  [IPC.commandsList]: CommandMetadata[];
  [IPC.applicationsSearch]: ApplicationEntry[];
  [IPC.applicationsRefresh]: ApplicationsRefreshResult;
  [IPC.applicationsLaunch]: CommandResult;
  [IPC.favoritesList]: FavoriteEntry[];
  [IPC.favoritesToggle]: FavoriteEntry[];
  [IPC.favoritesReorder]: FavoriteEntry[];
  [IPC.historyList]: HistoryEntry[];
  [IPC.historyClear]: void;
  [IPC.historyRemove]: void;
  [IPC.settingsGet]: Settings;
  [IPC.settingsUpdate]: Settings;
  [IPC.settingsReset]: Settings;
  [IPC.settingsExport]: string;
  [IPC.settingsImport]: SettingsImportResult;
  [IPC.systemCapabilities]: SystemCapabilities;
  [IPC.shortcutRegister]: ShortcutRegistrationResult;
}

/** Push event payload from main → renderer. */
export interface VisibilityEvent {
  visible: boolean;
}

/** Push event asking the renderer to switch to a specific view. */
export interface NavigateEvent {
  view: 'search' | 'settings' | 'favorites' | 'history' | 'help';
}

export type IpcResponseFor<C extends keyof IpcResponseMap> = IpcResponse<IpcResponseMap[C]>;
