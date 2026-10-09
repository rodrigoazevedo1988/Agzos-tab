/**
 * Application-wide constants shared by the main, preload and renderer layers.
 * Nothing here may depend on Electron or Node globals so it stays importable
 * from every context (including the sandboxed renderer).
 */

export const APP_NAME = 'Agzos Tab';
export const APP_ID = 'dev.agzos.tab';
export const APP_VERSION = '0.1.0';

/** Schema version of the persisted settings document. Bump on breaking changes. */
export const SETTINGS_SCHEMA_VERSION = 1;

/**
 * Cross-platform accelerator for the global launcher hotkey.
 * `CommandOrControl` resolves to Cmd on macOS and Ctrl elsewhere.
 */
export const DEFAULT_GLOBAL_SHORTCUT = 'CommandOrControl+Shift+Space';

/** Upper bound accepted for the history size, enforced in the settings schema. */
export const MAX_HISTORY_LIMIT = 500;
export const MIN_HISTORY_LIMIT = 0;

/** Default page size for search results returned to the renderer. */
export const DEFAULT_SEARCH_LIMIT = 12;
export const MAX_SEARCH_LIMIT = 50;

/** Debounce applied to keystrokes before a search request is issued (ms). */
export const SEARCH_DEBOUNCE_MS = 60;

/** Window geometry for the command palette. */
export const PALETTE_WINDOW = {
  width: 720,
  minHeight: 120,
  maxHeight: 560,
} as const;
