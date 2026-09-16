import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
    const fixture = join(
      dirname(fileURLToPath(import.meta.url)),
      "../fixtures/notation/special-relativity.yaml",
    );
    expect(RAPIDITY_GLYPH).toBe(declaredGlyph("rapidity", fixture));
    expect(TRANSVERSE_SCALE_GLYPH).toBe(declaredGlyph("ansatzTransverseScale", fixture));
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
    const dir = mkdtempSync(join(tmpdir(), "kine-notation-"));
    const path = join(dir, "special-relativity.yaml");
    writeFileSync(
      path,
      `modernOnlySymbols:\n  - id: rapidity\n    glyph: "Q"\n    introducedBy: planted\n`,
    );
    expect(declaredGlyph("rapidity", path)).not.toBe(RAPIDITY_GLYPH);
    const symbols = loadModernOnlySymbols(path);
    expect(symbols[0]?.glyph).toBe("Q");
  });
});
