const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: 'Ctrl/Cmd + Shift + Space', description: 'Toggle the Agzos Tab launcher (global)' },
  { keys: '↑ / ↓', description: 'Move through the results' },
  { keys: 'Enter', description: 'Run the selected result' },
  { keys: 'Escape', description: 'Close the palette or go back' },
  { keys: 'Ctrl/Cmd + K', description: 'Clear the search field' },
  { keys: 'Ctrl/Cmd + D', description: 'Pin or unpin the selected result' },
  { keys: 'Ctrl + N / Ctrl + P', description: 'Alternative previous/next navigation' },
];

export function HelpView(): JSX.Element {
  return (
    <div className="agzos-scroll max-h-[420px] overflow-y-auto px-4 py-4">
      <p className="mb-3 text-[12px] text-graphite-400">
        The palette is fully keyboard driven. Every action below is available without a mouse.
      </p>
      <dl className="space-y-2">
        {SHORTCUTS.map((shortcut) => (
          <div
            key={shortcut.keys}
            className="flex items-center justify-between gap-4 rounded-lg border border-graphite-700 bg-graphite-900/60 px-3 py-2"
          >
            <dt>
              <kbd className="rounded border border-graphite-600 bg-graphite-800 px-2 py-0.5 font-mono text-[11px] text-graphite-100">
                {shortcut.keys}
              </kbd>
            </dt>
            <dd className="text-right text-[12px] text-graphite-300">{shortcut.description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
