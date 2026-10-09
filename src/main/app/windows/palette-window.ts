import path from 'node:path';
import { BrowserWindow, screen } from 'electron';

import { IPC } from '@shared/ipc';
import { PALETTE_WINDOW } from '@shared/constants';

import { createLogger } from '../../logger';
import { installNavigationGuards, SECURE_WEB_PREFERENCES } from '../../security/window-security';

const log = createLogger('palette-window');

export interface PaletteWindowDeps {
  preloadPath: string;
  isDev: boolean;
  /** Returns true once the app is really quitting (so `close` is allowed). */
  shouldQuit: () => boolean;
  openExternal: (url: string) => void;
}

/**
 * Owns the single command-palette window: creation, positioning, show/hide,
 * height adaptation and the "hide on blur" launcher behaviour.
 */
export class PaletteWindowManager {
  private window: BrowserWindow | null = null;
  private suppressAutoHide = 0;
  private hiddenHandlers: Array<(visible: boolean) => void> = [];

  constructor(private readonly deps: PaletteWindowDeps) {}

  get browserWindow(): BrowserWindow | null {
    return this.window;
  }

  isVisible(): boolean {
    return this.window?.isVisible() ?? false;
  }

  onVisibilityChange(handler: (visible: boolean) => void): void {
    this.hiddenHandlers.push(handler);
  }

  create(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) return this.window;

    const win = new BrowserWindow({
      width: PALETTE_WINDOW.width,
      height: PALETTE_WINDOW.minHeight,
      show: false,
      frame: false,
      transparent: true,
      resizable: true,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: true,
      backgroundColor: '#00000000',
      title: 'Agzos Tab',
      webPreferences: {
        ...SECURE_WEB_PREFERENCES,
        preload: this.deps.preloadPath,
      },
    });

    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.on('blur', () => {
      if (this.suppressAutoHide === 0 && !this.deps.isDev) this.hide();
    });
    win.on('close', (event) => {
      if (!this.deps.shouldQuit()) {
        event.preventDefault();
        this.hide();
      }
    });
    win.on('closed', () => {
      this.window = null;
    });

    installNavigationGuards(win.webContents, {
      allowedPrefixes: this.allowedPrefixes(),
      openExternal: this.deps.openExternal,
    });

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      void win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      void win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }

    this.window = win;
    return win;
  }

  /** URL prefixes the renderer may legitimately be loaded from. */
  allowedPrefixes(): string[] {
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) return [MAIN_WINDOW_VITE_DEV_SERVER_URL];
    return ['file://'];
  }

  show(): void {
    const win = this.window ?? this.create();
    this.position(win);
    win.show();
    win.focus();
    this.notify(true);
    log.debug('Palette shown');
  }

  hide(): void {
    if (!this.window || this.window.isDestroyed()) return;
    this.window.hide();
    this.notify(false);
    log.debug('Palette hidden');
  }

  toggle(): boolean {
    if (this.isVisible()) {
      this.hide();
      return false;
    }
    this.show();
    return true;
  }

  /** Resizes the window to fit its content, keeping the top edge anchored. */
  setHeight(height: number): void {
    if (!this.window || this.window.isDestroyed()) return;
    const bounds = this.window.getBounds();
    const target = Math.round(
      Math.min(Math.max(height, PALETTE_WINDOW.minHeight), PALETTE_WINDOW.maxHeight),
    );
    if (target === bounds.height) return;
    this.window.setBounds({ ...bounds, height: target });
  }

  send(channel: string, payload?: unknown): void {
    if (!this.window || this.window.isDestroyed()) return;
    this.window.webContents.send(channel, payload);
  }

  /** Prevents "hide on blur" while a native dialog is open. */
  async withAutoHideSuppressed<T>(operation: () => Promise<T>): Promise<T> {
    this.suppressAutoHide += 1;
    try {
      return await operation();
    } finally {
      this.suppressAutoHide = Math.max(0, this.suppressAutoHide - 1);
    }
  }

  destroy(): void {
    this.window?.destroy();
    this.window = null;
  }

  private notify(visible: boolean): void {
    this.send(IPC.eventVisibility, { visible });
    for (const handler of this.hiddenHandlers) handler(visible);
  }

  /** Positions the palette near the top-centre of the display with the cursor. */
  private position(win: BrowserWindow): void {
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const { workArea } = display;
    const bounds = win.getBounds();
    const width = Math.min(bounds.width, workArea.width - 40);
    const x = Math.round(workArea.x + (workArea.width - width) / 2);
    const y = Math.round(workArea.y + workArea.height * 0.18);
    win.setBounds({ x, y, width, height: bounds.height });
  }
}
