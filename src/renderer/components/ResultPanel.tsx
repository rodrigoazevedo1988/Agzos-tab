import { CheckCircle2, XCircle } from 'lucide-react';

import type { CommandResult } from '@shared/types/command';

interface ResultPanelProps {
  result: CommandResult;
}

export function ResultPanel({ result }: ResultPanelProps): JSX.Element {
  const content = result.content;
  return (
    <div className="border-t border-graphite-700 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-[12px] font-medium">
        {result.success ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden />
        ) : (
          <XCircle className="h-4 w-4 text-red-400" aria-hidden />
        )}
        <span className={result.success ? 'text-graphite-100' : 'text-red-300'}>
          {result.message ?? (result.success ? 'Done' : (result.error?.message ?? 'Failed'))}
        </span>
      </div>

      {content?.type === 'text' && (
        <pre className="agzos-scroll max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-graphite-900 px-3 py-2 font-mono text-[12px] text-graphite-100">
          {content.text}
        </pre>
      )}

      {content?.type === 'list' && (
        <ul className="agzos-scroll max-h-40 space-y-1 overflow-auto">
          {content.items.length === 0 ? (
            <li className="text-[12px] text-graphite-400">Nothing to show</li>
          ) : (
            content.items.map((item) => (
              <li key={item} className="truncate text-[12px] text-graphite-200">
                {item}
              </li>
            ))
          )}
        </ul>
      )}

      {content?.type === 'key-value' && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {content.entries.map((entry) => (
            <div key={`${entry.key}-${entry.value}`} className="contents">
              <dt className="text-[11px] text-graphite-400">{entry.key}</dt>
              <dd className="truncate text-[12px] text-graphite-100">{entry.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
