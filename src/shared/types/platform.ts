export type Platform = 'win32' | 'darwin' | 'linux';

export function isPlatform(value: unknown): value is Platform {
  return value === 'win32' || value === 'darwin' || value === 'linux';
}
