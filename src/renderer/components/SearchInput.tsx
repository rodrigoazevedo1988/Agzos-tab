import { Loader2, Search } from 'lucide-react';

import type { RefObject } from 'react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
  inputRef: RefObject<HTMLInputElement>;
}

export function SearchInput({ value, onChange, loading, inputRef }: SearchInputProps): JSX.Element {
  return (
    <div className="flex items-center gap-3 border-b border-graphite-700 px-4 py-3">
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-400" aria-hidden />
      ) : (
        <Search className="h-4 w-4 shrink-0 text-graphite-400" aria-hidden />
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search commands, applications and settings…"
        aria-label="Search commands and applications"
        aria-controls="agzos-results"
        aria-activedescendant={undefined}
        role="combobox"
        aria-expanded
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="w-full bg-transparent text-[15px] text-graphite-50 outline-none placeholder:text-graphite-400"
      />
    </div>
  );
}
