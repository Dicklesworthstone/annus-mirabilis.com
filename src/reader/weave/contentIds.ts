/**
 * Content-id addressing for am-read-result-weave-jex, wired to the real anchor grammar that
 * am-read-anchors-navigation-a6o owns (`src/content/anchors.ts`, specified in
 * docs/CONTENT_IDS.md: "Face-Invariant Addressing: Anchors are content IDs, never array
 * positions or line numbers. Switching between German, English, gloss, parallel, reading,
 * results, and facsimile faces preserves the reader's exact place.").
 *
 * A weave predicate's `targets` name the CANONICAL (German/source) sentence id, e.g.
 * "s4-p1-s1". English sometimes splits one German sentence into two translation units,
 * "s4-p1-s1a" and "s4-p1-s1b" (CONTENT_IDS.md 3.3). This module is the one place the weave
 * normalizes between the canonical id and its English split halves, so no consumer -- German
 * face, English face, or a future gloss/parallel face -- ever has to reimplement that mapping
 * or fall back to matching by array position.
 */
import { parseAnchor, sourceSentenceId, splitSentenceIds } from "../../content/anchors.ts";

/** True when `id` parses as a real sentence-level anchor (`s<n>-p<m>-s<k>`, with or without an
 * English split suffix) under the site's one real anchor grammar. */
export function isSentenceContentId(id: string): boolean {
  const parsed = parseAnchor(id);
  return parsed.ok && parsed.value.kind === "sentence";
}

/**
 * The canonical (unsuffixed, German-source) form of a sentence content id. A non-sentence
 * anchor (a section, an equation, a result, ...) has no split-sentence concept and is returned
 * unchanged: canonicalization only ever applies within the sentence-anchor family.
 */
export function canonicalContentId(id: string): string {
  if (!isSentenceContentId(id)) return id;
  return sourceSentenceId(id);
}

/**
 * Every id under which a canonical sentence content id can be rendered on some face: itself
 * (the German source face), and its two English split-sentence halves (present only when
 * English split that sentence into two translation units; a face that did not split it simply
 * never renders the "a"/"b" forms, so their absence from presentIds is not an error here).
 */
export function contentIdVariants(canonicalSentenceId: string): readonly string[] {
  const canonical = canonicalContentId(canonicalSentenceId);
  if (!isSentenceContentId(canonical)) return [canonical];
  const [a, b] = splitSentenceIds(canonical);
  return [canonical, a, b];
}
