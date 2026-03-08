import { useEffect, useMemo, useRef, useState } from 'react';

export type ComboboxOption = {
  id: number;
  name: string;
};

type ComboboxEntry =
  | { kind: 'option'; option: ComboboxOption; index: number }
  | { kind: 'create'; value: string; index: number };

export type CreatableComboboxProps = {
  label: string;
  value: string;
  options: ComboboxOption[];
  recentIds?: number[];
  frequentIds?: number[];
  onChange: (nextValue: string) => void;
  onCreate: (name: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
  errorText?: string;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function includesNormalized(target: string, query: string): boolean {
  if (!query) return true;
  return normalize(target).includes(query);
}

function byRecency(a: ComboboxOption, b: ComboboxOption, recentRank: Map<number, number>): number {
  const rankA = recentRank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
  const rankB = recentRank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
  return rankA - rankB;
}

function byFrequency(a: ComboboxOption, b: ComboboxOption, frequentRank: Map<number, number>): number {
  const rankA = frequentRank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
  const rankB = frequentRank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
  return rankA - rankB;
}

function optionByIdMap(options: ComboboxOption[]): Map<number, ComboboxOption> {
  const map = new Map<number, ComboboxOption>();
  for (const option of options) map.set(option.id, option);
  return map;
}

export default function CreatableCombobox({
  label,
  value,
  options,
  recentIds = [],
  frequentIds = [],
  onChange,
  onCreate,
  disabled = false,
  placeholder,
  required,
  errorText
}: CreatableComboboxProps) {
  const rootRef = useRef<HTMLLabelElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const selectedOption = useMemo(() => options.find((o) => String(o.id) === value) ?? null, [options, value]);
  const [query, setQuery] = useState(selectedOption?.name ?? '');

  useEffect(() => {
    setQuery(selectedOption?.name ?? '');
  }, [selectedOption?.id]);

  const normalizedQuery = useMemo(() => normalize(query), [query]);
  const optionMap = useMemo(() => optionByIdMap(options), [options]);

  const recentRank = useMemo(() => {
    const map = new Map<number, number>();
    recentIds.forEach((id, idx) => {
      if (!map.has(id)) map.set(id, idx);
    });
    return map;
  }, [recentIds]);

  const frequentRank = useMemo(() => {
    const map = new Map<number, number>();
    frequentIds.forEach((id, idx) => {
      if (!map.has(id)) map.set(id, idx);
    });
    return map;
  }, [frequentIds]);

  const recentOptions = useMemo(() => {
    const dedup = new Set<number>();
    const result: ComboboxOption[] = [];

    for (const id of recentIds) {
      if (dedup.has(id)) continue;
      dedup.add(id);

      const option = optionMap.get(id);
      if (!option) continue;
      if (!includesNormalized(option.name, normalizedQuery)) continue;

      result.push(option);
      if (result.length >= 5) break;
    }

    return result;
  }, [recentIds, optionMap, normalizedQuery]);

  const recentIdSet = useMemo(() => new Set(recentOptions.map((o) => o.id)), [recentOptions]);

  const frequentOptions = useMemo(() => {
    const dedup = new Set<number>();
    const result: ComboboxOption[] = [];

    for (const id of frequentIds) {
      if (dedup.has(id)) continue;
      dedup.add(id);
      if (recentIdSet.has(id)) continue;

      const option = optionMap.get(id);
      if (!option) continue;
      if (!includesNormalized(option.name, normalizedQuery)) continue;

      result.push(option);
      if (result.length >= 10) break;
    }

    return result;
  }, [frequentIds, optionMap, normalizedQuery, recentIdSet]);

  const frequentIdSet = useMemo(() => new Set(frequentOptions.map((o) => o.id)), [frequentOptions]);

  const allMatches = useMemo(() => {
    return options
      .filter((o) => includesNormalized(o.name, normalizedQuery))
      .filter((o) => !recentIdSet.has(o.id) && !frequentIdSet.has(o.id));
  }, [options, normalizedQuery, recentIdSet, frequentIdSet]);

  const exactMatchExists = useMemo(() => {
    if (!normalizedQuery) return false;
    return options.some((o) => normalize(o.name) === normalizedQuery);
  }, [options, normalizedQuery]);

  const shouldShowCreate = query.trim() !== ''
    && !exactMatchExists
    && recentOptions.length === 0
    && frequentOptions.length === 0
    && allMatches.length === 0;

  const entries = useMemo(() => {
    const next: {
      recent: ComboboxEntry[];
      frequent: ComboboxEntry[];
      all: ComboboxEntry[];
      create: ComboboxEntry | null;
      flat: ComboboxEntry[];
    } = {
      recent: [],
      frequent: [],
      all: [],
      create: null,
      flat: []
    };

    let idx = 0;

    const sortedRecent = [...recentOptions].sort((a, b) => byRecency(a, b, recentRank));
    for (const option of sortedRecent) {
      const entry: ComboboxEntry = { kind: 'option', option, index: idx++ };
      next.recent.push(entry);
      next.flat.push(entry);
    }

    const sortedFrequent = [...frequentOptions].sort((a, b) => byFrequency(a, b, frequentRank));
    for (const option of sortedFrequent) {
      const entry: ComboboxEntry = { kind: 'option', option, index: idx++ };
      next.frequent.push(entry);
      next.flat.push(entry);
    }

    for (const option of allMatches) {
      const entry: ComboboxEntry = { kind: 'option', option, index: idx++ };
      next.all.push(entry);
      next.flat.push(entry);
    }

    if (shouldShowCreate) {
      const createEntry: ComboboxEntry = {
        kind: 'create',
        value: query.trim(),
        index: idx++
      };
      next.create = createEntry;
      next.flat.push(createEntry);
    }

    return next;
  }, [allMatches, frequentOptions, query, recentOptions, shouldShowCreate, recentRank, frequentRank]);

  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!isOpen) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex(entries.flat.length > 0 ? 0 : -1);
  }, [isOpen, entries.flat.length, normalizedQuery]);

  const listboxId = useMemo(() => `combobox-list-${label.toLowerCase().replace(/\s+/g, '-')}`, [label]);
  const activeDescendant = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  useEffect(() => {
    if (!isOpen) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setIsOpen(false);
        setQuery(selectedOption?.name ?? '');
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [isOpen, selectedOption]);

  const commitSelection = (option: ComboboxOption) => {
    onChange(String(option.id));
    setQuery(option.name);
    setIsOpen(false);
  };

  const commitCreate = async (name: string) => {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      await onCreate(name.trim());
      setIsOpen(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setActiveIndex((prev) => Math.min(prev + 1, entries.flat.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      setQuery(selectedOption?.name ?? '');
      return;
    }

    if (event.key === 'Enter') {
      if (!isOpen) {
        setIsOpen(true);
        return;
      }

      const selected = entries.flat.find((entry) => entry.index === activeIndex);
      if (!selected) return;

      event.preventDefault();
      if (selected.kind === 'option') {
        commitSelection(selected.option);
      } else {
        await commitCreate(selected.value);
      }
    }
  };

  const renderSection = (title: string, sectionEntries: ComboboxEntry[]) => {
    if (sectionEntries.length === 0) return null;

    return (
      <div className="combobox-section">
        <p className="combobox-section-title">{title}</p>
        {sectionEntries.map((entry) => {
          if (entry.kind !== 'option') return null;

          const isSelected = String(entry.option.id) === value;
          const isActive = entry.index === activeIndex;

          return (
            <button
              key={`${title}-${entry.option.id}`}
              type="button"
              role="option"
              id={`${listboxId}-option-${entry.index}`}
              aria-selected={isSelected}
              className={`combobox-option ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commitSelection(entry.option)}
            >
              <span>{entry.option.name}</span>
              {isSelected ? <span className="combobox-check">✓</span> : null}
            </button>
          );
        })}
      </div>
    );
  };

  const createEntry = entries.create && entries.create.kind === 'create' ? entries.create : null;

  return (
    <label className="field" ref={rootRef}>
      <span>{label}</span>
      <div className={`creatable-combobox ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}>
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onClick={() => {
            if (!disabled) setIsOpen(true);
          }}
          onKeyDown={(event) => {
            void handleKeyDown(event);
          }}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant}
          aria-autocomplete="list"
          aria-label={label}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete="off"
        />

        {isOpen && (
          <div className="combobox-dropdown" role="listbox" id={listboxId}>
            {renderSection('Recent', entries.recent)}
            {renderSection('Frequent', entries.frequent)}
            {renderSection('All Matches', entries.all)}

            {createEntry ? (
              <div className="combobox-create-wrap">
                <button
                  type="button"
                  role="option"
                  id={`${listboxId}-option-${createEntry.index}`}
                  aria-selected={false}
                  className={`combobox-option combobox-create ${createEntry.index === activeIndex ? 'active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { void commitCreate(createEntry.value); }}
                  disabled={isCreating}
                >
                  + Create "{createEntry.value}"
                </button>
              </div>
            ) : null}

            {entries.flat.length === 0 ? <p className="combobox-empty">No categories found.</p> : null}
          </div>
        )}
      </div>
      {errorText ? <span className="hint error">{errorText}</span> : null}
    </label>
  );
}
