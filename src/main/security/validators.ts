import path from 'node:path';

/** Schemes the app is willing to hand to the OS URL handler. */
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Returns true only for absolute http/https URLs. Everything else — including
 * `file:`, `javascript:`, `data:` and custom schemes — is rejected.
 */
export function isAllowedExternalUrl(candidate: string): boolean {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 2048) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  if (!ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol)) return false;
  // Reject credentials embedded in the URL (e.g. https://user:pass@host).
  return url.username === '' && url.password === '';
}

/** Validates a filesystem path before it is handed to `shell.openPath`. */
export function isSafeLocalPath(candidate: unknown): candidate is string {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 4096) {
    return false;
  }
  if (candidate.includes('\u0000')) return false;
  if (!path.isAbsolute(candidate)) return false;
  // Block Windows UNC device paths and the POSIX null-ish oddities.
  const normalised = path.normalize(candidate);
  if (normalised.startsWith('\\\\')) return false;
  return true;
}

/**
 * Resolves `relative` inside `base`, returning null when the result escapes the
 * base directory (defence against `../` traversal).
 */
export function resolveWithinBase(base: string, relative: string): string | null {
  if (typeof relative !== 'string' || relative.includes('\u0000')) return null;
  const baseResolved = path.resolve(base);
  const target = path.resolve(baseResolved, relative);
  const rel = path.relative(baseResolved, target);
  if (rel === '') return baseResolved;
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return target;
}

/**
 * Rough structural check for an Electron accelerator: 1–4 `+`-separated tokens,
 * each either a modifier or a printable key.
 */
export function isPlausibleAccelerator(candidate: unknown): candidate is string {
  if (typeof candidate !== 'string') return false;
  const value = candidate.trim();
  if (value.length === 0 || value.length > 64) return false;
  const parts = value.split('+').map((p) => p.trim());
  if (parts.length < 2 || parts.length > 4) return false;
  if (parts.some((p) => p.length === 0)) return false;
  const modifiers = new Set([
    'Command',
    'Cmd',
    'Control',
    'Ctrl',
    'CommandOrControl',
    'CmdOrCtrl',
    'Alt',
    'Option',
    'AltGr',
    'Shift',
    'Super',
    'Meta',
  ]);
  const last = parts[parts.length - 1] as string;
  const hasModifier = parts.slice(0, -1).some((p) => modifiers.has(p));
  return hasModifier && !modifiers.has(last);
}
