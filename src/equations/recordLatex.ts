/**
 * An equation record's formula as plain LaTeX, in its own paper's letters and its own printed
 * letters: the text the Markdown export and the search index print.
 *
 * Both used to render every paper with the Brownian table, which has no glyph for a light-quanta,
 * relativity or mass-energy quantity, so the symbol printed as its term id. The Markdown a reader
 * downloads from the paper page read "eq-model-me-exact-drop.t.kineticEnergyDifference = ..." in
 * 15 to 40 display blocks per paper on BUILD 25. The offline chapters had the same defect and were
 * fixed separately (scripts/build-offline-chapters.ts); this is the one owner for the other two.
 */
import type { Expression } from "./ast.ts";
import { expressionLatex } from "./latex.ts";
import { type PrintedGlyphs, recordQuantities } from "./printedGlyphs.ts";
import { teachingProfile } from "./teachingProfiles.ts";

/** Undefined when the record names a paper with no teaching table, which the parser refuses. */
export function recordLatex(record: {
  readonly tree: Expression;
  readonly paper: string;
  readonly printedGlyphs?: PrintedGlyphs | undefined;
}): string | undefined {
  const profile = teachingProfile(record.paper);
  return profile
    ? expressionLatex(record.tree, recordQuantities(profile.quantities, record.printedGlyphs))
    : undefined;
}
