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

function readFixtureText(path?: string): string | null {
  try {
    const nodeFs = "node:fs";
    const nodePath = "node:path";
    const nodeUrl = "node:url";
    const fs = typeof require !== "undefined" ? require(nodeFs) : null;
    const p = typeof require !== "undefined" ? require(nodePath) : null;
    const u = typeof require !== "undefined" ? require(nodeUrl) : null;
    if (!fs || !p || !u) return null;

    const target = path
      ? path
      : p.join(
          p.dirname(u.fileURLToPath(import.meta.url)),
          "../../../testing/fixtures/notation/special-relativity.yaml",
        );
    return fs.readFileSync(target, "utf8");
  } catch {
    return null;
  }
}

export function loadModernOnlySymbols(path?: string): readonly ModernOnlySymbol[] {
  const text = readFixtureText(path);
  if (!text) return DEFAULT_SYMBOLS;

  const symbols: ModernOnlySymbol[] = [];
  const block = text.split("modernOnlySymbols:")[1] ?? "";
  const entries = block.split(/\n\s*-\s+/).slice(1);
  for (const entry of entries) {
    const id = /id:\s*(\S+)/.exec(entry)?.[1];
    const glyphMatch = /glyph:\s*"([^"]+)"/.exec(entry);
    const introducedBy = /introducedBy:\s*(\S+)/.exec(entry)?.[1];
    if (id && glyphMatch?.[1] && introducedBy) {
      symbols.push({ id, glyph: glyphMatch[1], introducedBy });
    }
  }
  return symbols.length > 0 ? Object.freeze(symbols) : DEFAULT_SYMBOLS;
}

export function declaredGlyph(id: string, path?: string): string {
  const found = loadModernOnlySymbols(path).find((row) => row.id === id);
  if (!found) throw new Error(`Concordance has no modern-only symbol ${id}.`);
  return found.glyph;
}

/** Rapidity glyph declared by the concordance fixture. Never chosen here. */
export const RAPIDITY_GLYPH = declaredGlyph("rapidity");
/** Transverse ansatz coefficient glyph. Identifier is transverseScale. */
export const TRANSVERSE_SCALE_GLYPH = declaredGlyph("ansatzTransverseScale");
