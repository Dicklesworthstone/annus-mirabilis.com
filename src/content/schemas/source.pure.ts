/**
 * The closed vocabularies of the source-layer schema, and nothing else.
 *
 * This module is the client-safe half of `source.ts`. It holds the constant
 * vocabularies and the literal-union types derived from them: values a reading
 * face needs in order to decide what a block or a gloss token is. It reads no
 * file, hashes no text, and imports no Node builtin, so a Client Component may
 * import it without dragging `node:fs`, `node:path` or `node:crypto` into the
 * browser bundle.
 *
 * `source.ts` imports and re-exports every name declared here, so there is one
 * definition of each vocabulary and no second hand-copied list to drift.
 *
 * Specification: AGENTS.md and am-cm-schemas-source-1en. Separation: am-bwnf.
 */

export const SOURCE_SCHEMA_VERSION = 1;

// 1. PAPER
export const PAPER_SLUGS = [
  "light-quanta",
  "brownian-motion",
  "special-relativity",
  "mass-energy",
  "molecular-dimensions",
] as const;
export type PaperSlug = (typeof PAPER_SLUGS)[number];

// 3. SOURCE BLOCK
export const SOURCE_BLOCK_KINDS = [
  "masthead",
  "heading",
  "part-heading",
  "paragraph",
  "equation",
  "footnote",
  "closing",
] as const;
export type SourceBlockKind = (typeof SOURCE_BLOCK_KINDS)[number];

// 6. GLOSS UNIT
export const GLOSS_NOTE_CLASSES = [
  "konjunktiv-i",
  "konjunktiv-ii",
  "separable-verb",
  "genitive-construction",
  "compound",
  "attributive-phrase",
  "formula-phrase",
  "archaic-spelling",
  "abbreviation",
  "ordinal",
  "unit",
  "term",
  "hedge",
  "necessity",
  "condition",
  "consequence",
  "restriction",
] as const;
export type GlossNoteClass = (typeof GLOSS_NOTE_CLASSES)[number];

export const MULTIWORD_UNIT_KINDS = [
  "separable-verb",
  "fixed-phrase",
  "reflexive",
  "split-construction",
] as const;
export type MultiwordUnitKind = (typeof MULTIWORD_UNIT_KINDS)[number];

// 7. EDITORIAL NOTE
export const EDITORIAL_NOTE_KINDS = [
  "historian-margin",
  "correction",
  "typographical",
  "dispute",
  "side-note",
] as const;
export type EditorialNoteKind = (typeof EDITORIAL_NOTE_KINDS)[number];
