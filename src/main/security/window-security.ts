/**
 * Secure `webPreferences` shared by every window. Centralised so no window can
 * accidentally relax the defaults.
 */
export const SECURE_WEB_PREFERENCES = {
  contextIsolation: true,
  nodeIntegration: false,
  nodeIntegrationInWorker: false,
  nodeIntegrationInSubFrames: false,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
  experimentalFeatures: false,
  webviewTag: false,
  spellcheck: false,
} as const;

/** Set of schemes the renderer is ever allowed to be navigated to. */
const ALLOWED_INTERNAL_SCHEMES = new Set(['file:', 'http:', 'https:', 'devtools:']);

export interface NavigationGuardOptions {
  /** URL prefixes considered "the application itself". */
  allowedPrefixes: readonly string[];
  /** Handles a user-initiated external link. */
  openExternal: (url: string) => void;
}

/**
 * Blocks unexpected navigation, new windows and embedded webviews.
 * Navigation to the app's own document is permitted; everything else is denied,
 * and http(s) links are handed to the OS browser instead of being loaded.
 */
export function installNavigationGuards(
  contents: Electron.WebContents,
  options: NavigationGuardOptions,
): void {
  contents.on('will-navigate', (event, url) => {
    if (!isInternal(url, options.allowedPrefixes)) {
      event.preventDefault();
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternal(url)) options.openExternal(url);
    return { action: 'deny' };
  });

  // Deny attaching any `<webview>` regardless of markup.
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  // Extra belt-and-braces: never allow a devtools page to navigate elsewhere.
  contents.on('did-create-window', (child) => {
    child.close();
  });
}

function isInternal(url: string, allowedPrefixes: readonly string[]): boolean {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_INTERNAL_SCHEMES.has(parsed.protocol)) return false;
    return allowedPrefixes.some((prefix) => url.startsWith(prefix));
  } catch {
    return false;
  }
}

function isAllowedExternal(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.username === '' &&
      parsed.password === ''
    );
  } catch {
    return false;
  }
}
