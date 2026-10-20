import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useDashboard } from "../state/DashboardContext";
import { buildSearchIndex, searchEntries } from "../search/searchIndex";
import type { SearchEntry } from "../search/searchIndex";

interface SearchBarProps {
  onSelect: (entry: SearchEntry) => void;
}

export function SearchBar({ onSelect }: SearchBarProps) {
  const { state } = useDashboard();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const index = useMemo(() => buildSearchIndex(state.services), [state.services]);
  const results = useMemo(() => searchEntries(index, query), [index, query]);
  const showResults = isOpen && query.trim().length > 0;

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  const select = (entry: SearchEntry) => {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(0);
    inputRef.current?.blur();
    onSelect(entry);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (!query.trim()) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (results.length ? (current + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (results.length ? (current - 1 + results.length) % results.length : 0));
    } else if (event.key === "Enter" && showResults && results[activeIndex]) {
      event.preventDefault();
      select(results[activeIndex]);
    }
  };

  return (
    <div className="topbar__search">
      <span aria-hidden="true">⌕</span>
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search telemetry"
        aria-expanded={showResults}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showResults && results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        placeholder="Search anything..."
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
      />
      <kbd>⌘ K</kbd>
      {showResults && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="search-results"
          onMouseDown={(event) => event.preventDefault()}
        >
          {results.length === 0 ? (
            <li className="search-results__empty" role="presentation">No matching dashboard components</li>
          ) : (
            results.map((entry, position) => (
              <li
                key={entry.id}
                id={`${listId}-${position}`}
                role="option"
                aria-selected={position === activeIndex}
                className={`search-results__item ${position === activeIndex ? "search-results__item--active" : ""}`}
                onMouseEnter={() => setActiveIndex(position)}
                onClick={() => select(entry)}
              >
                <span>{entry.label}</span>
                <small>{entry.category}</small>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
