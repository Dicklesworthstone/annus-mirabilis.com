/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/components/layout/PatentSearchPalette.tsx
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Renamed from PatentSearchPalette to CommandPalette for the Annus Mirabilis edition.
 * - Implemented pure keyboard listener helpers (isEditableTarget, isPaletteShortcut) to support ⌘K / Ctrl+K.
 * - Enforced focus restoration to previously focused element upon Escape / close.
 * - Ships with empty search index until am-plat-search-index-snx1.
 */

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

function SearchIcon({ className = "w-5 h-5" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function XIcon({ className = "w-4 h-4" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CompassIcon({ className = "w-3.5 h-3.5" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <polygon
        points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"
        fill="currentColor"
      />
    </svg>
  );
}

export interface SearchResultItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly url: string;
  readonly category?: string;
}

export interface CommandPaletteProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly searchIndex?: readonly SearchResultItem[];
  readonly onSelectResult?: (item: SearchResultItem) => void;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  if (target.getAttribute("role") === "textbox") return true;
  return false;
}

export function isPaletteShortcut(event: {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
}): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
}

/**
 * Custom hook to register global ⌘K / Ctrl+K opening shortcuts.
 */
export function useCommandPaletteShortcut({
  isOpen,
  onOpen,
  onClose,
}: {
  readonly isOpen: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isPaletteShortcut(event)) {
        if (isEditableTarget(event.target) && !isOpen) {
          // Ignore shortcut while focused in an editable field
          return;
        }
        event.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          onOpen();
        }
        return;
      }

      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onOpen, onClose]);
}

export function CommandPalette({
  isOpen,
  onClose,
  searchIndex = [],
  onSelectResult,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Filter items based on query
  const results = React.useMemo(() => {
    if (!query.trim()) return searchIndex.slice(0, 8);
    const q = query.toLowerCase();
    return searchIndex
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle?.toLowerCase().includes(q) ||
          item.category?.toLowerCase().includes(q),
      )
      .slice(0, 15);
  }, [query, searchIndex]);

  // Focus management: record element that opened palette, restore on close
  useEffect(() => {
    if (isOpen) {
      if (
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== dialogRef.current
      ) {
        previousFocusRef.current = document.activeElement;
      }
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 20);
      return () => clearTimeout(timer);
    }

    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setQuery("");
    setSelectedIndex(0);
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => (results.length === 0 ? 0 : (prev + 1) % results.length));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) =>
          results.length === 0 ? 0 : (prev - 1 + results.length) % results.length,
        );
        return;
      }

      if (event.key === "Enter" && results[selectedIndex]) {
        event.preventDefault();
        const selected = results[selectedIndex];
        if (onSelectResult) {
          onSelectResult(selected);
        } else if (typeof window !== "undefined") {
          window.location.href = selected.url;
        }
        handleClose();
      }
    },
    [handleClose, results, selectedIndex, onSelectResult],
  );

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      open={isOpen}
      aria-modal="true"
      aria-label="Search edition and papers"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] sm:pt-[15vh] p-4 bg-ink-950/60 backdrop-blur-sm w-full h-full border-none m-0 max-w-none max-h-none overflow-hidden"
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
    >
      <div
        className="w-full max-w-2xl bg-parchment-50 dark:bg-ink-950 border border-parchment-300 dark:border-ink-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75dvh]"
        role="document"
      >
        {/* Search input bar */}
        <div className="p-3.5 sm:p-4 border-b border-parchment-200 dark:border-ink-800 flex items-center gap-3 bg-parchment-100/70 dark:bg-ink-900/70">
          <SearchIcon className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0" />
          <input
            ref={inputRef}
            type="search"
            placeholder="Search papers, equations, passages, and instruments..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full bg-transparent border-none text-base font-sans text-ink-950 dark:text-parchment-50 placeholder:text-ink-400 focus:outline-none focus-visible:outline-none rounded-lg"
            aria-label="Search edition"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-activedescendant={
              results[selectedIndex] ? `search-result-${selectedIndex}` : undefined
            }
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="p-2 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 cursor-pointer"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close search"
            className="px-2.5 py-1.5 rounded-md text-[11px] font-mono text-ink-500 hover:bg-parchment-200 dark:hover:bg-ink-800 border border-parchment-300 dark:border-ink-700 cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Results area */}
        <div
          id="command-palette-results"
          role="listbox"
          aria-label="Search results"
          className="p-3 overflow-y-auto max-h-[50dvh] space-y-1.5 flex-1"
        >
          {results.length > 0 ? (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  type="button"
                  key={item.id}
                  id={`search-result-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    if (onSelectResult) onSelectResult(item);
                    else if (typeof window !== "undefined") window.location.href = item.url;
                    handleClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-amber-700 text-white shadow-sm"
                      : "bg-parchment-100/50 dark:bg-ink-900/50 hover:bg-parchment-200/70 text-ink-900 dark:text-parchment-100"
                  }`}
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="font-serif font-bold text-sm truncate">{item.title}</div>
                    {item.subtitle && (
                      <div
                        className={`text-xs truncate ${isSelected ? "text-amber-100" : "text-ink-500 dark:text-ink-400"}`}
                      >
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                  {item.category && (
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300"
                      }`}
                    >
                      {item.category}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center space-y-1.5">
              <p className="font-serif text-base font-bold text-ink-900 dark:text-parchment-100">
                {query ? `No results found for "${query}"` : "Search index empty"}
              </p>
              <p className="text-xs text-ink-500 dark:text-ink-400 font-sans">
                {query
                  ? "Try searching for a paper title, equation symbol, or historical concept."
                  : "Search index will be indexed offline at build time."}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-parchment-200 dark:border-ink-800 bg-parchment-100/70 dark:bg-ink-900/70 flex items-center justify-between text-xs font-mono text-ink-500">
          <div className="flex items-center gap-2">
            <CompassIcon className="w-3.5 h-3.5 text-amber-600" />
            <span>Annus Mirabilis Critical Edition</span>
          </div>
          <div className="text-[11px] flex items-center gap-2">
            <span>↑↓ Navigate</span>
            <span>•</span>
            <span>↵ Select</span>
            <span>•</span>
            <span>ESC Close</span>
          </div>
        </div>
      </div>
    </dialog>
  );
}
