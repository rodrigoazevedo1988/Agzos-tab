import type { Settings, SettingsPatch } from './settings-schema';
import type { ApplicationEntry } from './types/application';
import type { CommandMetadata, CommandResult, PaletteView } from './types/command';
import type { FavoriteEntry, HistoryEntry } from './types/history';
import type { SearchResponse } from './types/search';
import type { AppInfo, ShortcutRegistrationResult, SystemCapabilities } from './types/system';

/**
 * The typed surface exposed on `window.agzos` by the preload script.
 *
 * Methods unwrap the IPC envelope and reject with an `AgzosApiError` (see
 * `src/shared/errors.ts`) only for transport/permission failures. Domain
 * failures — e.g. a command that returns `success: false` — resolve normally.
 */
export interface AgzosApi {
  app: {
    getInfo(): Promise<AppInfo>;
  };
  window: {
    hide(): Promise<void>;
    show(): Promise<void>;
    toggle(): Promise<boolean>;
    closePalette(): Promise<void>;
    setHeight(height: number): Promise<void>;
    onVisibilityChanged(listener: (visible: boolean) => void): () => void;
    onNavigate(listener: (view: PaletteView) => void): () => void;
  };
  commands: {
    search(query: string, limit?: number): Promise<SearchResponse>;
    execute(
      commandId: string,
      args?: Record<string, unknown>,
      confirmed?: boolean,
    ): Promise<CommandResult>;
    list(): Promise<CommandMetadata[]>;
  };
  applications: {
    search(query: string): Promise<ApplicationEntry[]>;
    refresh(): Promise<{ count: number; warnings: string[]; scannedAt: string }>;
    launch(applicationId: string): Promise<CommandResult>;
  };
  favorites: {
    list(): Promise<FavoriteEntry[]>;
    toggle(id: string, kind: 'command' | 'application', title: string): Promise<FavoriteEntry[]>;
    reorder(ids: string[]): Promise<FavoriteEntry[]>;
  };
  history: {
    list(): Promise<HistoryEntry[]>;
    clear(): Promise<void>;
    remove(id: string): Promise<void>;
  };
  settings: {
    get(): Promise<Settings>;
    update(patch: SettingsPatch): Promise<Settings>;
    reset(): Promise<Settings>;
    export(): Promise<string>;
    import(json: string): Promise<{ settings: Settings; warnings: string[] }>;
  };
  system: {
    getCapabilities(): Promise<SystemCapabilities>;
    registerShortcut(accelerator: string): Promise<ShortcutRegistrationResult>;
  };
}
