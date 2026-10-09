import path from 'node:path';
import { app } from 'electron';

/**
 * Resolves a bundled static asset. In development assets live under the project
 * `resources/` folder; when packaged they are copied by Forge into the app's
 * resources directory via `extraResource`.
 */
export function resolveBundledAsset(...segments: string[]): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...segments);
  }
  return path.join(app.getAppPath(), 'resources', ...segments);
}

/** Directory where settings, history and caches are persisted. */
export function userDataDir(): string {
  return app.getPath('userData');
}

export function homeDir(): string {
  return app.getPath('home');
}
