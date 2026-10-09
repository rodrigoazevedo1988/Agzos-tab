import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  isAllowedExternalUrl,
  isPlausibleAccelerator,
  isSafeLocalPath,
  resolveWithinBase,
} from '@main/security/validators';

describe('isAllowedExternalUrl', () => {
  it('accepts http and https', () => {
    expect(isAllowedExternalUrl('https://example.com')).toBe(true);
    expect(isAllowedExternalUrl('http://example.com/path?q=1')).toBe(true);
  });

  it('rejects dangerous or unsupported schemes', () => {
    expect(isAllowedExternalUrl('file:///etc/passwd')).toBe(false);
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedExternalUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isAllowedExternalUrl('ftp://example.com')).toBe(false);
  });

  it('rejects embedded credentials', () => {
    expect(isAllowedExternalUrl('https://user:pass@example.com')).toBe(false);
  });

  it('rejects non-strings and garbage', () => {
    expect(isAllowedExternalUrl('not a url')).toBe(false);
    expect(isAllowedExternalUrl('')).toBe(false);
    expect(isAllowedExternalUrl(undefined as unknown as string)).toBe(false);
  });
});

describe('isSafeLocalPath', () => {
  it('accepts normal absolute paths', () => {
    expect(isSafeLocalPath('/Users/example/Documents')).toBe(true);
  });

  it('rejects relative paths and null bytes', () => {
    expect(isSafeLocalPath('documents/file.txt')).toBe(false);
    expect(isSafeLocalPath('/tmp/evil\u0000.txt')).toBe(false);
  });

  it('rejects Windows UNC/device paths', () => {
    expect(isSafeLocalPath('\\\\?\\C:\\Windows')).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isSafeLocalPath(42)).toBe(false);
    expect(isSafeLocalPath(null)).toBe(false);
  });
});

describe('resolveWithinBase', () => {
  const base = path.resolve('/srv/data');

  it('resolves paths inside the base', () => {
    expect(resolveWithinBase(base, 'a/b.txt')).toBe(path.join(base, 'a', 'b.txt'));
  });

  it('blocks traversal outside the base', () => {
    expect(resolveWithinBase(base, '../secret')).toBeNull();
    expect(resolveWithinBase(base, 'a/../../secret')).toBeNull();
  });

  it('returns the base for an empty relative path', () => {
    expect(resolveWithinBase(base, '')).toBe(base);
  });
});

describe('isPlausibleAccelerator', () => {
  it('accepts modifier + key combinations', () => {
    expect(isPlausibleAccelerator('CommandOrControl+Shift+Space')).toBe(true);
    expect(isPlausibleAccelerator('Alt+F4')).toBe(true);
  });

  it('rejects a bare key or too many parts', () => {
    expect(isPlausibleAccelerator('Space')).toBe(false);
    expect(isPlausibleAccelerator('Ctrl+Alt+Shift+Super+K')).toBe(false);
  });

  it('rejects a trailing modifier', () => {
    expect(isPlausibleAccelerator('Ctrl+Shift')).toBe(false);
  });
});
