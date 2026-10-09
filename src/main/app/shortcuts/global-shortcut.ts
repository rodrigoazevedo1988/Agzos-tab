import { createLogger } from '../../logger';
import { isPlausibleAccelerator } from '../../security/validators';

import type { ShortcutRegistrationResult } from '@shared/types/system';
import type { ShortcutPort } from '../ports';

const log = createLogger('shortcuts');

/**
 * Manages the single global launcher accelerator. Registration can fail when
 * another application already owns the combination, which is surfaced to the
 * user instead of silently doing nothing.
 */
export class GlobalShortcutManager {
  private current: string | null = null;

  constructor(private readonly port: ShortcutPort) {}

  get accelerator(): string | null {
    return this.current;
  }

  register(accelerator: string, handler: () => void): ShortcutRegistrationResult {
    if (!isPlausibleAccelerator(accelerator)) {
      return { ok: false, accelerator, reason: 'invalid' };
    }

    const previous = this.current;
    if (previous) {
      this.port.unregister(previous);
      this.current = null;
    }

    if (this.port.register(accelerator, handler)) {
      this.current = accelerator;
      log.info(`Registered global shortcut`);
      return { ok: true, accelerator };
    }

    // Failed (most likely occupied): try to restore the previous binding.
    if (previous) {
      const restored = this.port.register(previous, handler);
      this.current = restored ? previous : null;
    }
    log.warn('Global shortcut registration failed; it may be in use by another app');
    return { ok: false, accelerator, reason: 'occupied' };
  }

  /** Releases every registered accelerator (called on quit). */
  release(): void {
    this.port.unregisterAll();
    this.current = null;
  }
}
