/**
 * Search and Filtering logic for the Scoped Notation Concordance.
 * Specification: AGENTS.md, am-not-notation-page-2us.
 */

import type { EnrichedConcordanceEntry } from "./notationData.ts";

export interface NotationFilterOptions {
  readonly query?: string | undefined;
  readonly paper?: string | undefined;
  readonly section?: string | undefined;
  readonly operation?: "all" | "rename" | "unitConversion" | "modernization" | string | undefined;
  readonly collision?: "all" | "danger" | "caution" | "any" | string | undefined;
  readonly glyph?: string | undefined;
}

export interface NotationSearchResult {
  readonly filteredEntries: readonly EnrichedConcordanceEntry[];
  readonly totalMatches: number;
  readonly queryApplied: string;
  readonly activeFiltersCount: number;
}

/**
 * Normalizes search terms for flexible matching.
 */
function normalizeQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((w) => w.length > 0);
}

/**
 * Checks if an entry matches a search query.
 * Scope-aware: multi-word searches like "k viscosity", "beta lorentz", "speed of light" match.
 */
export function matchesQuery(entry: EnrichedConcordanceEntry, rawQuery: string): boolean {
  const trimmed = rawQuery.trim();
  if (!trimmed) return true;

  // Exact case-sensitive single-letter check (e.g. distinguishing L vs l)
  if (trimmed.length === 1) {
    if (entry.glyph.unicode === trimmed || entry.glyph.latex === trimmed) {
      return true;
    }
  }

  const queryWords = normalizeQuery(trimmed);
  const keywords = entry.searchKeywords;

  // Every word in query must match at least one keyword (AND search)
  return queryWords.every((word) => {
    // Exact or prefix match against keywords
    return keywords.some((kw) => kw.includes(word) || word.includes(kw));
  });
}

/**
 * Filters and searches concordance entries based on user selections.
 */
export function filterNotationEntries(
  entries: readonly EnrichedConcordanceEntry[],
  options: NotationFilterOptions,
): NotationSearchResult {
  const query = options.query ?? "";
  const paper = options.paper && options.paper !== "all" ? options.paper : undefined;
  const section = options.section && options.section !== "all" ? options.section : undefined;
  const operation =
    options.operation && options.operation !== "all" ? options.operation : undefined;
  const collision =
    options.collision && options.collision !== "all" ? options.collision : undefined;
  const glyph = options.glyph && options.glyph !== "all" ? options.glyph : undefined;

  let activeFilters = 0;
  if (query.trim()) activeFilters++;
  if (paper) activeFilters++;
  if (section) activeFilters++;
  if (operation) activeFilters++;
  if (collision) activeFilters++;
  if (glyph) activeFilters++;

  const filtered = entries.filter((entry) => {
    // 1. Paper filter
    if (paper && entry.paper !== paper) {
      return false;
    }

    // 2. Section filter
    if (section) {
      const matchSection =
        entry.scope.includes(section) ||
        entry.scope.some((s) => s.replace(/^[a-z]+-/, "") === section.replace(/^[a-z]+-/, ""));
      if (!matchSection) return false;
    }

    // 3. Operation kind filter
    if (operation && entry.operation.kind !== operation) {
      return false;
    }

    // 4. Collision filter
    if (collision) {
      if (collision === "any") {
        if (!entry.collision) return false;
      } else if (collision === "danger") {
        if (entry.collision?.severity !== "danger") return false;
      } else if (collision === "caution") {
        if (entry.collision?.severity !== "caution") return false;
      }
    }

    // 5. Glyph filter
    if (glyph) {
      const gMatch =
        entry.glyph.latex === glyph ||
        entry.glyph.unicode === glyph ||
        entry.glyph.latex.replace(/\\/g, "") === glyph;
      if (!gMatch) return false;
    }

    // 6. Text query search
    if (query.trim()) {
      if (!matchesQuery(entry, query)) {
        return false;
      }
    }

    return true;
  });

  return {
    filteredEntries: filtered,
    totalMatches: filtered.length,
    queryApplied: query,
    activeFiltersCount: activeFilters,
  };
}
