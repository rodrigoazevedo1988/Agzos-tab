import type { IpcErrorCode } from './ipc';

/**
 * Error thrown by the preload bridge when an IPC call fails at the transport or
 * permission level. Carries the machine-readable code returned by the main
 * process so the renderer can react without string matching.
 */
export class AgzosApiError extends Error {
  readonly code: IpcErrorCode;

  constructor(code: IpcErrorCode, message: string) {
    super(message);
    this.name = 'AgzosApiError';
    this.code = code;
  }
}
