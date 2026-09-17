/**
 * Anchor-string construction for am-read-anchors-navigation-a6o: the grammar
 * table's emission direction, complementing `src/content/anchors.ts`'s
 * `parseAnchor` (the parse direction) and `src/content/ids.ts` (the id
 * grammar). Every emitted anchor is round-tripped through the real
 * `parseAnchor` before being returned, so this module can never drift from
 * the grammar it targets -- a change to that grammar that this module does
 * not track fails here, not silently in a face renderer.
 *
 * Displayed-equation anchors (`#eq-<printed>`, `#eq-s<n>-<printed>`,
 * `#eq-s<n>-d<j>`) are already fully solved by `allocateEquationIds` in
 * `../../content/ids.ts`, which needs a paper's whole equation list to
 * detect repeated printed labels; this module does not duplicate that
 * batch-scoped logic; a face renderer allocating equations should call
 * `allocateEquationIds` directly and use its `pageAnchor`.
 */

import { entryAnchorForEntrance, parseAnchor } from "../../content/anchors.ts";
import { ENTRANCE_PAPER_SLUGS } from "../../content/ids.ts";

export type EntrancePaperSlug = (typeof ENTRANCE_PAPER_SLUGS)[number];

export type EmittableUnit =
  | Readonly<{ kind: "section"; n: number }>
  | Readonly<{ kind: "paragraph"; n: number; m: number }>
  | Readonly<{ kind: "sentence"; n: number; m: number; k: number; splitSuffix?: "a" | "b" }>
  /** Substantive inline equation attached to a sentence. `parseAnchor` does not
   * currently recognize the footnote-attached inline-math shape `ids.ts`'s
   * `parseInlineMathId` allows (`s<n>-fn<k>-m<i>`); this module emits only the
   * sentence-attached form `parseAnchor` actually accepts. */
  | Readonly<{ kind: "inline-equation"; n: number; m: number; k: number; i: number }>
  | Readonly<{ kind: "footnote"; n: number; k: number }>
  | Readonly<{ kind: "closing"; block: "dateline" | "ack" | "received" }>
  | Readonly<{ kind: "masthead"; part: "title" | "author" }>
  | Readonly<{ kind: "part"; n: 1 | 2 }>
  | Readonly<{ kind: "entry"; paperSlug: EntrancePaperSlug }>
  | Readonly<{ kind: "result"; slug: string }>
  /** `id` already carries its paper-code prefix, e.g. "bm-two-ledgers" for `#arg-bm-two-ledgers`. */
  | Readonly<{ kind: "argument"; id: string }>
  | Readonly<{ kind: "lab"; instrumentId: string }>;

export class InvalidAnchorEmissionError extends Error {
  readonly fragment: string;
  constructor(fragment: string, reason: string) {
    super(`emitAnchor produced '${fragment}', which its own parser rejects: ${reason}`);
    this.name = "InvalidAnchorEmissionError";
    this.fragment = fragment;
  }
}

function buildFragment(unit: EmittableUnit): string {
  switch (unit.kind) {
    case "section":
      return `#s${unit.n}`;
    case "paragraph":
      return `#s${unit.n}-p${unit.m}`;
    case "sentence":
      return `#s${unit.n}-p${unit.m}-s${unit.k}${unit.splitSuffix ?? ""}`;
    case "inline-equation":
      return `#s${unit.n}-p${unit.m}-s${unit.k}-m${unit.i}`;
    case "footnote":
      return `#s${unit.n}-fn${unit.k}`;
    case "closing":
      return `#closing-${unit.block}`;
    case "masthead":
      return `#masthead-${unit.part}`;
    case "part":
      return `#part-${unit.n}`;
    case "entry":
      return entryAnchorForEntrance(`entrance-${unit.paperSlug}`);
    case "result":
      return `#result-${unit.slug}`;
    case "argument":
      return `#arg-${unit.id}`;
    case "lab":
      return `#lab-${unit.instrumentId}`;
  }
}

/** Constructs the anchor fragment (`#...`) for a structural unit, validated against the real parser. */
export function emitAnchor(unit: EmittableUnit): string {
  const fragment = buildFragment(unit);
  const parsed = parseAnchor(fragment);
  if (!parsed.ok) throw new InvalidAnchorEmissionError(fragment, parsed.error);
  return fragment;
}

/** The bare content id (no leading `#`), the DOM `id` attribute value for this unit. */
export function emitContentId(unit: EmittableUnit): string {
  return emitAnchor(unit).slice(1);
}
