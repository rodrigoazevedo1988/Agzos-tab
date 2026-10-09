import type { z } from 'zod';
import type { IpcError, IpcErrorCode, IpcResponse } from './ipc';

export function ipcOk<T>(data: T): IpcResponse<T> {
  return { ok: true, data };
}

export function ipcFail<T>(code: IpcErrorCode, message: string): IpcResponse<T> {
  return { ok: false, error: { code, message } };
}

export function ipcError(code: IpcErrorCode, message: string): IpcError {
  return { code, message };
}

export type ParseResult<T> = { success: true; data: T } | { success: false; error: IpcError };

/**
 * Parses IPC arguments with a zod schema. Returns a structured error instead of
 * throwing so handlers can always reply with a predictable envelope.
 */
export function parseArgs<S extends z.ZodTypeAny>(
  schema: S,
  value: unknown,
): ParseResult<z.infer<S>> {
  const result = schema.safeParse(value);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const first = result.error.issues[0];
  const path = first?.path.length ? `${first.path.join('.')}: ` : '';
  return {
    success: false,
    error: ipcError('INVALID_ARGUMENT', `${path}${first?.message ?? 'Invalid arguments'}`),
  };
}

/** Normalises any thrown value into a safe, non-leaking error message. */
export function toIpcError(cause: unknown, fallbackCode: IpcErrorCode = 'INTERNAL'): IpcError {
  if (cause instanceof Error) {
    return ipcError(fallbackCode, cause.message);
  }
  return ipcError(fallbackCode, 'Unexpected error');
}
