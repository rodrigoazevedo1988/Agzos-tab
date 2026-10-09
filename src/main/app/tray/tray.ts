import { Menu, nativeImage, Tray } from 'electron';

import { APP_NAME } from '@shared/constants';

import { createLogger } from '../../logger';

const log = createLogger('tray');

export interface TrayDeps {
  iconPath: string;
  template: boolean;
  onOpenPalette: () => void;
  onOpenSettings: () => void;
  onQuit: () => void;
}

/**
 * Creates the system tray. Returns `null` when the platform/desktop does not
 * support a tray, so the app degrades gracefully instead of failing to boot.
 */
export function createTray(deps: TrayDeps): Tray | null {
  const image = nativeImage.createFromPath(deps.iconPath);
  if (image.isEmpty()) {
    log.warn('Tray icon could not be loaded; continuing without a tray icon');
  }
  if (deps.template) image.setTemplateImage(true);

  let tray: Tray;
  try {
    tray = new Tray(image);
  } catch (error) {
    log.warn('Tray is not available on this desktop', { reason: (error as Error).name });
    return null;
  }

  const menu = Menu.buildFromTemplate([
    { label: `Open ${APP_NAME}`, click: deps.onOpenPalette },
    { label: 'Settings', click: deps.onOpenSettings },
    { type: 'separator' },
    { label: 'Quit', click: deps.onQuit },
  ]);

  tray.setToolTip(APP_NAME);
  tray.setContextMenu(menu);
  tray.on('click', deps.onOpenPalette);
  return tray;
}
