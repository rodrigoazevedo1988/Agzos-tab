import type { IpcMainInvokeEvent } from 'electron';

/**
 * Validates that IPC messages come from the application's own top-level frame.
 *
 * Renderer content is loaded either from the Vite dev server or from a `file://`
 * document; any message from an unexpected origin, or from a sub-frame, is
 * rejected before a handler runs.
 */
export class IpcGuard {
  private allowedPrefixes: string[] = [];

  setAllowedPrefixes(prefixes: string[]): void {
    this.allowedPrefixes = prefixes.filter(Boolean);
  }

  get allowed(): readonly string[] {
    return this.allowedPrefixes;
  }

  isTrusted(event: IpcMainInvokeEvent): boolean {
    const frame = event.senderFrame;
    if (!frame) return false;
    // Only the main frame may talk to us — never an <iframe>.
    if (frame.parent !== null) return false;
    const url = frame.url;
    if (!url) return false;
    return this.allowedPrefixes.some((prefix) => url.startsWith(prefix));
  }
}
