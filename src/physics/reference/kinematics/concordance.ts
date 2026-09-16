/**
 * Reads modern-only glyphs from a fixture concordance.
 * This module does not choose the rapidity glyph.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type ModernOnlySymbol = Readonly<{
  id: string;
  glyph: string;
  introducedBy: string;
}>;

function fixturePath(override?: string): string {
  if (override) return override;
  return join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../testing/fixtures/notation/special-relativity.yaml",
  );
}

export function loadModernOnlySymbols(path?: string): readonly ModernOnlySymbol[] {
  const text = readFileSync(fixturePath(path), "utf8");
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
  return Object.freeze(symbols);
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
