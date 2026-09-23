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

function SearchIcon({ style }: { readonly style?: React.CSSProperties }) {
  return (
    <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function XIcon({ style }: { readonly style?: React.CSSProperties }) {
  return (
    <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CompassIcon({ style }: { readonly style?: React.CSSProperties }) {
  return (
    <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
      data-search-dialog="true"
      data-command-palette-dialog="true"
      aria-modal="true"
      aria-label="Search edition and papers"
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "1rem",
        paddingTop: "10vh",
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        width: "100%",
        height: "100%",
        border: "none",
        margin: 0,
        maxWidth: "none",
        maxHeight: "none",
        overflow: "hidden",
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "42rem",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "1rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "75dvh",
        }}
        role="document"
      >
        {/* Search input bar */}
        <div
          style={{
            padding: "0.875rem 1rem",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            background: "var(--wash)",
          }}
        >
          <SearchIcon
            style={{
              width: "1.25rem",
              height: "1.25rem",
              color: "var(--accent)",
              flexShrink: 0,
            }}
          />
          <input
            ref={inputRef}
            type="search"
            placeholder="Search papers, equations, passages, and instruments..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              fontSize: "1rem",
              fontFamily: "var(--font-sans)",
              color: "var(--ink)",
              outline: "none",
            }}
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
              style={{
                padding: "0.5rem",
                color: "var(--muted)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "auto",
              }}
            >
              <XIcon style={{ width: "1rem", height: "1rem" }} />
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close search"
            style={{
              padding: "0.375rem 0.625rem",
              borderRadius: "0.375rem",
              fontSize: "0.6875rem",
              fontFamily: "var(--font-mono)",
              color: "var(--muted)",
              background: "var(--panel)",
              border: "1px solid var(--line)",
              cursor: "pointer",
              minHeight: "auto",
            }}
          >
            ESC
          </button>
        </div>

        {/* Results area */}
        <div
          id="command-palette-results"
          role="listbox"
          aria-label="Search results"
          style={{
            padding: "0.75rem",
            overflowY: "auto",
            maxHeight: "50dvh",
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
            flex: 1,
          }}
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
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "0.75rem",
                    borderRadius: "0.75rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    cursor: "pointer",
                    transition: "background-color 150ms ease, color 150ms ease",
                    border: "1px solid transparent",
                    background: isSelected ? "var(--accent)" : "var(--wash)",
                    color: isSelected ? "var(--paper)" : "var(--ink)",
                    minHeight: "auto",
                  }}
                >
                  <div
                    style={{
                      minWidth: 0,
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.125rem",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontWeight: 700,
                        fontSize: "0.875rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.title}
                    </div>
                    {item.subtitle && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: isSelected ? "rgba(255, 255, 255, 0.85)" : "var(--muted)",
                        }}
                      >
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                  {item.category && (
                    <span
                      style={{
                        fontSize: "0.625rem",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                        padding: "0.125rem 0.5rem",
                        borderRadius: "0.375rem",
                        background: isSelected ? "rgba(255, 255, 255, 0.2)" : "var(--panel)",
                        color: isSelected ? "white" : "var(--ink)",
                        border: isSelected ? "none" : "1px solid var(--line)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.category}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "var(--ink)",
                  margin: 0,
                }}
              >
                {query ? `No results found for "${query}"` : "Search index empty"}
              </p>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  fontFamily: "var(--font-sans)",
                  margin: 0,
                }}
              >
                {query
                  ? "Try searching for a paper title, equation symbol, or historical concept."
                  : "Search index will be indexed offline at build time."}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "0.75rem",
            borderTop: "1px solid var(--line)",
            background: "var(--wash)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.75rem",
            fontFamily: "var(--font-mono)",
            color: "var(--muted)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CompassIcon
              style={{ width: "0.875rem", height: "0.875rem", color: "var(--accent)" }}
            />
            <span>Annus Mirabilis Critical Edition</span>
          </div>
          <div
            style={{ fontSize: "0.6875rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            {/* Words, not key glyphs: "↵" is in none of the three fonts this site serves, so it
                drew as a fallback glyph (componentGlyphCoverage). The words match the live
                palette's own hint in CommandPalette.ts. */}
            <span>Up and Down to move</span>
            <span>•</span>
            <span>Enter to open</span>
            <span>•</span>
            <span>Escape to close</span>
          </div>
        </div>
      </div>
    </dialog>
  );
}
