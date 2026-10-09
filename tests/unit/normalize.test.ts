import { describe, expect, it } from 'vitest';

import { applicationId, normalizeRecords } from '@main/applications/normalize';

import type { RawApplicationRecord } from '@shared/types/application';

const base: RawApplicationRecord = {
  name: 'Visual Studio Code',
  path: '/Applications/Visual Studio Code.app',
  source: 'macos-applications',
};

describe('applicationId', () => {
  it('is stable for the same platform and path', () => {
    expect(applicationId('darwin', '/a/b')).toBe(applicationId('darwin', '/a/b'));
  });

  it('differs across platforms and paths', () => {
    expect(applicationId('darwin', '/a/b')).not.toBe(applicationId('linux', '/a/b'));
    expect(applicationId('darwin', '/a/b')).not.toBe(applicationId('darwin', '/a/c'));
  });
});

describe('normalizeRecords', () => {
  it('normalises whitespace in names', () => {
    const entries = normalizeRecords([{ ...base, name: '  Visual   Studio  Code ' }], 'darwin');
    expect(entries[0]?.name).toBe('Visual Studio Code');
  });

  it('de-duplicates entries by id', () => {
    const entries = normalizeRecords([base, { ...base }], 'darwin');
    expect(entries).toHaveLength(1);
  });

  it('builds keyword variants', () => {
    const entries = normalizeRecords([base], 'darwin');
    expect(entries[0]?.keywords).toContain('visual studio code');
  });

  it('sorts entries by name', () => {
    const entries = normalizeRecords(
      [
        { ...base, name: 'Zed', path: '/z' },
        { ...base, name: 'Alpha', path: '/a' },
      ],
      'darwin',
    );
    expect(entries.map((entry) => entry.name)).toEqual(['Alpha', 'Zed']);
  });

  it('falls back launchTarget to the path', () => {
    const entries = normalizeRecords([base], 'darwin');
    expect(entries[0]?.launchTarget).toBe(base.path);
  });

  it('keeps an explicit launchTarget', () => {
    const entries = normalizeRecords([{ ...base, launchTarget: '/usr/bin/code %U' }], 'linux');
    expect(entries[0]?.launchTarget).toBe('/usr/bin/code %U');
  });

  it('drops empty records', () => {
    const entries = normalizeRecords([{ ...base, name: '   ' }], 'darwin');
    expect(entries).toHaveLength(0);
  });
});
