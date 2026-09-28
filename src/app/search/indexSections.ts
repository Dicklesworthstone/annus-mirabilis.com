import { SEARCH_TYPES, type SearchType } from "../../search/core.ts";
import { TYPE_LABELS } from "../../search/typeLabels.ts";

export { TYPE_LABELS };

/**
 * THE SECTIONS /search/ RENDERS, AND THEIR HEADINGS.
 *
 * Moved out of page.tsx so a test can read them. The page built its own label map and its own order
 * list, both typed Record<string, string> and string[], and the order list is what decides which
 * kinds the page renders at all: byType is filled by iterating TYPE_ORDER, so a type missing from it
 * is not shown, however many documents the index holds.
 *
 * Measured 2026-09-28: the index had gained walkthrough, discovery and tour documents, the palette
 * grouped and filtered all three because it iterates SEARCH_TYPES, and /search/ showed none of them
 * because they were absent from this list. Two label maps and only one of them checked.
 *
 * TYPE_LABELS is now Record<SearchType, string>, so a new search type does not compile until it has
 * a heading here, and searchSections.test.ts requires every type to appear in the order as well.
 * Listing a type costs nothing when the index holds none of it: the page skips an empty kind.
 */
/**
 * The order sections appear in. Types absent from the index are skipped, never rendered empty.
 *
 * The reading layers come first, then the guided ones, then the reference shelves, because a reader
 * who searched a phrase from a paper wants the paper before they want a route through it.
 */
export const TYPE_ORDER: readonly SearchType[] = [
  "paper",
  "section",
  "argument",
  "result",
  "equation",
  "instrument",
  "foundation",
  "walkthrough",
  "discovery",
  "tour",
  "sentence-de",
  "sentence-en",
  "glossary",
  "misconception",
  "margin",
  "knowledge-card",
  "timeline",
  "person",
  "essay",
  "connection-thread",
  "capstone",
];

/** Every search type this page can render, for the test that keeps the two lists honest. */
export const ALL_SEARCH_TYPES: readonly SearchType[] = SEARCH_TYPES;
