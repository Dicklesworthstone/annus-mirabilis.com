/**
 * Alias resolution for retired anchor spellings, for
 * am-read-anchors-navigation-a6o. Built on top of the real retirement
 * detection already in src/content/anchors.ts's `parseAnchor` (never a
 * duplicate set of regexes), this module derives, where the retirement is
 * unambiguous, the one real replacement location.
 *
 * No real content in this repository has ever retired or split an id yet
 * (every paper is newly authored), so there is no live fixture of a real
 * alias to wire a face renderer against today. These functions are tested
 * against synthetic retired forms that `parseAnchor` already recognizes as
 * retired, not against invented "this id used to exist" history.
 */

import { parseAnchor } from "../../content/anchors";
import type { ParseResult } from "../../content/ids";

export interface AliasResolution {
  /** The retired fragment, including '#'. */
  readonly from: string;
  /** The current, real fragment, including '#'. */
  readonly to: string;
}

const HEADING_PATTERN = /^(s\d+)-h$/;
const FOOTNOTE_SENTENCE_PATTERN = /^(s\d+-fn\d+)-s\d+$/;

/**
 * Resolves a retired anchor to its real current location, when the
 * retirement is unambiguous. Returns null both when the fragment is not
 * retired at all (parses fine on its own) and when it is retired but
 * genuinely ambiguous (a bare `#entrance`/`#entry` never named a paper,
 * so there is no single replacement to guess).
 */
export function resolveAlias(fragment: string): AliasResolution | null {
  const clean = fragment.startsWith("#") ? fragment : `#${fragment}`;
  const parsed: ParseResult<unknown> = parseAnchor(clean);
  if (parsed.ok) return null;
  const target = clean.slice(1);

  if (parsed.rule === "retired-heading-anchor") {
    const match = target.match(HEADING_PATTERN);
    if (match?.[1]) return { from: clean, to: `#${match[1]}` };
  }

  if (parsed.rule === "retired-footnote-sentence-anchor") {
    const match = target.match(FOOTNOTE_SENTENCE_PATTERN);
    if (match?.[1]) return { from: clean, to: `#${match[1]}` };
  }

  return null;
}

/** The bare id (no '#') a static alias element should carry at the new location. */
export function aliasElementId(resolution: AliasResolution): string {
  return resolution.from.slice(1);
}

/**
 * The hash string a JavaScript-enabled reader's location should be
 * rewritten to with `history.replaceState` -- never `pushState`, so
 * following an old link never adds a history entry the back button would
 * have to skip past.
 */
export function rewriteHashTarget(resolution: AliasResolution): string {
  return resolution.to;
}
