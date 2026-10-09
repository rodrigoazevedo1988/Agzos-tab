import { describe, expect, it } from 'vitest';

import { parseDesktopEntry, stripFieldCodes } from '@main/applications/adapters/linux';

const SAMPLE = `[Desktop Entry]
Type=Application
Name=Text Editor
Comment=Edit text files
Exec=gedit %U
Icon=org.gnome.gedit
Terminal=false

[Desktop Action new-window]
Name=New Window
Exec=gedit --new-window
`;

describe('parseDesktopEntry', () => {
  it('reads the [Desktop Entry] group', () => {
    const entry = parseDesktopEntry(SAMPLE);
    expect(entry.name).toBe('Text Editor');
    expect(entry.exec).toBe('gedit %U');
    expect(entry.icon).toBe('org.gnome.gedit');
    expect(entry.type).toBe('Application');
  });

  it('ignores other groups', () => {
    const entry = parseDesktopEntry(SAMPLE);
    expect(entry.name).not.toBe('New Window');
  });

  it('parses NoDisplay and Hidden', () => {
    const entry = parseDesktopEntry(
      '[Desktop Entry]\nName=X\nExec=x\nNoDisplay=true\nHidden=true\n',
    );
    expect(entry.noDisplay).toBe(true);
    expect(entry.hidden).toBe(true);
  });

  it('handles missing fields', () => {
    const entry = parseDesktopEntry('[Desktop Entry]\nName=Only Name\n');
    expect(entry.exec).toBeUndefined();
  });
});

describe('stripFieldCodes', () => {
  it('removes freedesktop field codes', () => {
    expect(stripFieldCodes('gedit %U')).toBe('gedit');
    expect(stripFieldCodes('code --new-window %F')).toBe('code --new-window');
  });

  it('collapses whitespace', () => {
    expect(stripFieldCodes('app   %U   --flag')).toBe('app --flag');
  });
});
