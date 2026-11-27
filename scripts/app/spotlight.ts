import { SITE_ORIGIN } from "../../src/platform/app-bridge/schemas.ts";
import { type SearchDocument, searchResultHref } from "../../src/search/core.ts";

const indexedTypes = new Set(["paper", "section", "result", "instrument", "foundation"]);

/** Only public documents admitted to this release's search corpus can become system search items. */
export function spotlightSnapshot(documents: readonly SearchDocument[], buildDigest: string) {
  const seen = new Set<string>();
  const entries = documents.filter((row) => indexedTypes.has(row.type)).flatMap((row) => {
    const identifier = SITE_ORIGIN + searchResultHref(row);
    // Some projections name the same destination. Spotlight identifies a passage by its URL.
    if (seen.has(identifier)) return [];
    seen.add(identifier);
    return [{
      identifier,
      domain: row.paper === "cross-paper" || !row.paper ? "site" : row.paper,
      title: row.title,
      snippet: Array.from(row.text).slice(0, 240).join(""),
      keywords: row.terms,
    }];
  });
  return { schemaVersion: 1, buildDigest, entries };
}
