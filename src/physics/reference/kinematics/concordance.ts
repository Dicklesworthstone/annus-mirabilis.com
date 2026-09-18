/**
 * Reads modern-only glyphs from a fixture concordance.
 * This module does not choose the rapidity glyph.
 */

export type ModernOnlySymbol = Readonly<{
  id: string;
  glyph: string;
  introducedBy: string;
}>;

const DEFAULT_SYMBOLS: readonly ModernOnlySymbol[] = Object.freeze([
  { id: "rapidity", glyph: "χ", introducedBy: "kinematics-modern-lens" },
  { id: "ansatzTransverseScale", glyph: "a_\\perp", introducedBy: "kinematics-ansatz" },
  { id: "ansatzSpatialScale", glyph: "a", introducedBy: "kinematics-ansatz" },
  { id: "ansatzTimeScale", glyph: "b", introducedBy: "kinematics-ansatz" },
  { id: "ansatzTimeSpaceCoefficient", glyph: "d", introducedBy: "kinematics-ansatz" },
]);

/**
 * The concordance fixture is read by the test that verifies DEFAULT_SYMBOLS matches it.
 * This module must stay filesystem-free: kinematics.ts imports RAPIDITY_GLYPH from here,
 * and that chain reaches Client Components (sr07/FieldEquationsLab), where a `node:fs`
 * require is a hard bundler error. Callers that have the fixture text pass it in.
 */
export function loadModernOnlySymbols(fixtureText?: string): readonly ModernOnlySymbol[] {
  const text = fixtureText;
  if (!text) return DEFAULT_SYMBOLS;

  const symbols: ModernOnlySymbol[] = [];
  const block = text.split("modernOnlySymbols:")[1] ?? "";
  const entries = block.split(/\n\s*-\s+/).slice(1);
  for (const entry of entries) {
    const id = /id:\s*(\S+)/.exec(entry)?.[1];
    const glyphMatch = /glyph:\s*"([^"]+)"/.exec(entry);
    const introducedBy = /introducedBy:\s*(\S+)/.exec(entry)?.[1];
    if (id && glyphMatch?.[1] && introducedBy) {
      // The fixture is scraped as raw text, so YAML double-quoted escapes are still
      // encoded: "a_\\perp" must decode to a_\perp. Without this the fixture path and
      // the DEFAULT_SYMBOLS path disagreed on every glyph containing a backslash.
      const glyph = glyphMatch[1].replace(/\\\\/g, "\\");
      symbols.push({ id, glyph, introducedBy });
    }
  }
  return symbols.length > 0 ? Object.freeze(symbols) : DEFAULT_SYMBOLS;
}

export function declaredGlyph(id: string, fixtureText?: string): string {
  const found = loadModernOnlySymbols(fixtureText).find((row) => row.id === id);
  if (!found) throw new Error(`Concordance has no modern-only symbol ${id}.`);
  return found.glyph;
}

/** Rapidity glyph declared by the concordance fixture. Never chosen here. */
export const RAPIDITY_GLYPH = declaredGlyph("rapidity");
/** Transverse ansatz coefficient glyph. Identifier is transverseScale. */
export const TRANSVERSE_SCALE_GLYPH = declaredGlyph("ansatzTransverseScale");
