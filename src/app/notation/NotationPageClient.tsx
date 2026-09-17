"use client";

/**
 * Interactive Client Component for Scoped Notation Concordance (/notation).
 * Specification: AGENTS.md, am-not-notation-page-2us.
 */

import React, { useMemo, useState } from "react";
import { CollisionClusterView } from "./CollisionClusterView.tsx";
import { ModernOnlySymbolsView } from "./ModernOnlySymbolsView.tsx";
import { NotationEntryCard } from "./NotationEntryCard.tsx";
import type { EnrichedConcordanceEntry, NotationPageData } from "./notationData.ts";
import { filterNotationEntries } from "./notationSearch.ts";

export interface NotationPageClientProps {
  readonly initialData: NotationPageData;
}

export function NotationPageClient({ initialData }: NotationPageClientProps) {
  const [query, setQuery] = useState("");
  const [paperFilter, setPaperFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [opFilter, setOpFilter] = useState("all");
  const [collisionFilter, setCollisionFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"catalogue" | "collisions">("catalogue");

  // Get available sections based on chosen paper
  const availableSections = useMemo(() => {
    const set = new Set<string>();
    for (const entry of initialData.allEntries) {
      if (paperFilter === "all" || entry.paper === paperFilter) {
        for (const s of entry.scope) {
          set.add(s);
        }
      }
    }
    return Array.from(set).sort();
  }, [initialData.allEntries, paperFilter]);

  // Run search & filter
  const searchResult = useMemo(() => {
    return filterNotationEntries(initialData.allEntries, {
      query,
      paper: paperFilter,
      section: sectionFilter,
      operation: opFilter,
      collision: collisionFilter,
    });
  }, [initialData.allEntries, query, paperFilter, sectionFilter, opFilter, collisionFilter]);

  const hasActiveFilters =
    query.trim().length > 0 ||
    paperFilter !== "all" ||
    sectionFilter !== "all" ||
    opFilter !== "all" ||
    collisionFilter !== "all";

  const handleResetFilters = () => {
    setQuery("");
    setPaperFilter("all");
    setSectionFilter("all");
    setOpFilter("all");
    setCollisionFilter("all");
  };

  // Group filtered entries by paper
  const filteredPapers = useMemo(() => {
    const map = new Map<string, EnrichedConcordanceEntry[]>();
    for (const entry of searchResult.filteredEntries) {
      const list = map.get(entry.paper) ?? [];
      list.push(entry);
      map.set(entry.paper, list);
    }
    return initialData.papers
      .map((p) => {
        const entries = map.get(p.paperSlug) ?? [];
        return {
          ...p,
          entries,
        };
      })
      .filter((p) => p.entries.length > 0 || (!hasActiveFilters && p.modernOnlySymbols.length > 0));
  }, [searchResult.filteredEntries, initialData.papers, hasActiveFilters]);

  return (
    <div className="notation-client-root" data-notation-interactive="true">
      {/* Interactive Filter & Search Box */}
      <section className="notation-controls" aria-label="Notation search and filters">
        <div className="search-box-row">
          <div className="search-input-wrapper">
            <span className="search-icon" aria-hidden="true">
              🔍
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by glyph (β, k, V, x'), meaning, modern symbol (c, γ, kB), quantity ID, or section..."
              aria-label="Search notation concordance"
            />
            {query && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setQuery("")}
                aria-label="Clear search text"
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        <div className="filter-grid">
          <div className="filter-group">
            <label htmlFor="paper-select">Paper</label>
            <select
              id="paper-select"
              value={paperFilter}
              onChange={(e) => {
                setPaperFilter(e.target.value);
                setSectionFilter("all");
              }}
            >
              <option value="all">All papers ({initialData.allEntries.length})</option>
              {initialData.papers.map((p) => (
                <option key={p.paperSlug} value={p.paperSlug}>
                  {p.paperTitle} ({p.entries.length})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="section-select">Section scope</label>
            <select
              id="section-select"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              disabled={availableSections.length === 0}
            >
              <option value="all">All sections</option>
              {availableSections.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/^[a-z]+-/, "")}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="operation-select">Operation kind</label>
            <select
              id="operation-select"
              value={opFilter}
              onChange={(e) => setOpFilter(e.target.value)}
            >
              <option value="all">All operations</option>
              <option value="rename">Rename only</option>
              <option value="unitConversion">Unit system conversion</option>
              <option value="modernization">Substantive modernization</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="collision-select">Collision severity</label>
            <select
              id="collision-select"
              value={collisionFilter}
              onChange={(e) => setCollisionFilter(e.target.value)}
            >
              <option value="all">All entries</option>
              <option value="danger">
                Danger collisions only ({initialData.dangerCollisionsCount})
              </option>
              <option value="caution">Caution collisions only</option>
              <option value="any">All collisions ({initialData.totalCollisionsCount})</option>
            </select>
          </div>
        </div>

        <div className="filter-summary-row">
          <div className="results-count" aria-live="polite">
            Showing {searchResult.totalMatches} of {initialData.totalEntriesCount} concordance
            entries
            {hasActiveFilters && " (filtered)"}
          </div>

          <div className="view-mode-toggle">
            {hasActiveFilters && (
              <button
                type="button"
                className="secondary"
                onClick={handleResetFilters}
                aria-label="Reset all search filters"
              >
                Reset filters
              </button>
            )}
            <button
              type="button"
              className={viewMode === "collisions" ? "primary" : "secondary"}
              onClick={() => setViewMode(viewMode === "catalogue" ? "collisions" : "catalogue")}
              aria-pressed={viewMode === "collisions"}
            >
              {viewMode === "catalogue" ? "View Collision Matrix ⚠️" : "View Full Catalogue"}
            </button>
          </div>
        </div>
      </section>

      {/* Collision Cluster Matrix View (when requested or in collision focus mode) */}
      {(viewMode === "collisions" || collisionFilter !== "all") && (
        <CollisionClusterView clusters={initialData.collisionClusters} />
      )}

      {/* Main Catalogue View */}
      {viewMode === "catalogue" && (
        <div className="catalogue-container">
          {filteredPapers.length === 0 ? (
            <div className="empty-results" role="status">
              <h3>No concordance entries match your search.</h3>
              <p>Try searching for a different glyph, meaning, or clearing active filters.</p>
              <button type="button" className="button" onClick={handleResetFilters}>
                Reset all filters
              </button>
            </div>
          ) : (
            filteredPapers.map((paper) => (
              <section
                key={paper.paperSlug}
                className="paper-section"
                id={`paper-${paper.paperSlug}`}
                aria-labelledby={`heading-paper-${paper.paperSlug}`}
              >
                <header className="paper-section-header">
                  <p className="eyebrow">Paper {paper.paperNumber} · 1905</p>
                  <h2 id={`heading-paper-${paper.paperSlug}`}>{paper.paperTitle}</h2>
                  <p className="fine">{paper.locator}</p>
                </header>

                <div className="entries-grid">
                  {paper.entries.map((entry) => (
                    <NotationEntryCard key={entry.id} entry={entry} />
                  ))}
                </div>

                {/* Modern-only symbols section */}
                {paper.modernOnlySymbols &&
                  paper.modernOnlySymbols.length > 0 &&
                  !hasActiveFilters && (
                    <ModernOnlySymbolsView
                      paperTitle={paper.paperTitle}
                      symbols={paper.modernOnlySymbols}
                    />
                  )}
              </section>
            ))
          )}
        </div>
      )}
    </div>
  );
}
