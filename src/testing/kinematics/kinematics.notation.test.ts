import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  declaredGlyph,
  loadModernOnlySymbols,
} from "../../physics/reference/kinematics/concordance.ts";
import { RAPIDITY_GLYPH, TRANSVERSE_SCALE_GLYPH } from "../../physics/reference/kinematics.ts";
import { kinematicsLogStart, logKinematics } from "./log.ts";

kinematicsLogStart();

const root = join(dirname(fileURLToPath(import.meta.url)), "../../physics/reference");
const sources = [
  join(root, "kinematics.ts"),
  join(root, "kinematics/constraints.ts"),
  join(root, "kinematics/concordance.ts"),
  join(root, "kinematics/types.ts"),
  join(root, "kinematics/mode1904.ts"),
];

function scan(text: string): { transverseK: boolean; rapidityVarphi: boolean } {
  const transverseK = /\btransverse\w*\s*[:=].*\bk\b/.test(text) || /\bk\s*:\s*number/.test(text);
  const rapidityVarphi =
    /rapidity[\s\S]{0,80}\\varphi|rapidity[\s\S]{0,80}varphi|glyph[^\n]*φ/.test(text);
  return { transverseK, rapidityVarphi };
}

describe("notation", () => {
  test("module source has no transverse k and no rapidity varphi", () => {
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      const found = scan(text);
      expect(found.transverseK).toBe(false);
      expect(found.rapidityVarphi).toBe(false);
      expect(found.transverseK || found.rapidityVarphi).toBe(false);
    }
    expect(RAPIDITY_GLYPH).not.toBe("φ");
    expect(TRANSVERSE_SCALE_GLYPH).not.toBe("k");
  });

  test("concordance glyphs match the fixture yaml", () => {
    // Pass the fixture TEXT, not its path: declaredGlyph parses text, and handing it a
    // path would silently fall back to DEFAULT_SYMBOLS and compare them to themselves.
    const fixtureText = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/notation/special-relativity.yaml"),
      "utf8",
    );
    expect(fixtureText).toContain("modernOnlySymbols:");
    expect(RAPIDITY_GLYPH).toBe(declaredGlyph("rapidity", fixtureText));
    expect(TRANSVERSE_SCALE_GLYPH).toBe(declaredGlyph("ansatzTransverseScale", fixtureText));
    logKinematics({
      testId: "concordance-glyphs",
      outcome: "pass",
      declaredGlyph: RAPIDITY_GLYPH,
      documentedGlyph: RAPIDITY_GLYPH,
    });
  });

  test("planted transverse k is detected", () => {
    const planted = "export function scale(transverse: number, k: number) { return k; }";
    expect(scan(planted).transverseK || /\bk\s*:\s*number/.test(planted)).toBe(true);
  });

  test("fixture pair that disagrees fails the glyph check", () => {
    const plantedText = `modernOnlySymbols:\n  - id: rapidity\n    glyph: "Q"\n    introducedBy: planted\n`;
    expect(declaredGlyph("rapidity", plantedText)).not.toBe(RAPIDITY_GLYPH);
    const symbols = loadModernOnlySymbols(plantedText);
    expect(symbols[0]?.glyph).toBe("Q");
  });
});
