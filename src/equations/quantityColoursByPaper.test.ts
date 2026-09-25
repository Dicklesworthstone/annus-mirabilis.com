import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { QUANTITY_PALETTE } from "./quantityColours.ts";
import type { CompiledEquation } from "./viewTypes.ts";

/**
 * The explorer and show-the-code colour their quantities from src/generated/quantity-colours-by-
 * paper.css, which they import themselves (am-ywtb). Before, the rules sat inside the reading's
 * sheet, which only a reading formula imported, so on /lab/bm-01/ and /lab/me-02/ the explorer's
 * chip dots were blank and its glyphs ink; and on /lab/bm-05/ and /lab/bm-06/, where show-the-code
 * is the only coloured view, no equations.css defined the palette the rules name.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const generated = join(root, "src/generated");
const byPaper = readFileSync(join(generated, "quantity-colours-by-paper.css"), "utf8");
const perTerm = readFileSync(join(generated, "quantity-colours.css"), "utf8");
const equationFiles = readdirSync(generated).filter((f) => f.endsWith("-equations.json"));

describe("every quantity an explorer can show has its paper's rule", () => {
  test("each term of each compiled equation is coloured by the paper it belongs to", () => {
    const missing: string[] = [];
    let pairs = 0;
    for (const file of equationFiles) {
      const { equations } = JSON.parse(readFileSync(join(generated, file), "utf8")) as {
        equations: CompiledEquation[];
      };
      for (const e of equations)
        for (const t of e.terms) {
          pairs += 1;
          const rule = `[data-paper="${e.paper}"] [data-quantity-id="${t.quantityId}"] { --qc: var(--q-`;
          if (!byPaper.includes(rule)) missing.push(`${file} ${e.id} ${t.quantityId}`);
        }
    }
    // Non-vacuous: the six files and their terms were read before anything was compared.
    expect(equationFiles.length).toBeGreaterThan(0);
    expect(pairs).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  test("the rules moved rather than doubled: the reading's sheet keeps only its per-term rules", () => {
    expect(byPaper).toContain("[data-paper=");
    expect(perTerm).toContain("[data-term=");
    expect(perTerm).not.toContain("[data-paper=");
  });
});

describe("the sheet carries the palette its rules name", () => {
  // Without it, a page whose only coloured view is show-the-code (bm-05, bm-06) imports no
  // equations.css, and var(--q-N) resolves to nothing: the rule matches and colours nothing.
  const block = (selector: string) => {
    const at = byPaper.indexOf(`${selector} {`);
    expect(at, selector).toBeGreaterThan(-1);
    return byPaper.slice(at, byPaper.indexOf("}", at));
  };
  test("every slot, light and dark, with the palette's own values", () => {
    const light = block(":root");
    const dark = block(':root[data-theme="kramgasse-night"]');
    const system = block(":root:not([data-theme])");
    expect(QUANTITY_PALETTE.length).toBeGreaterThan(0);
    QUANTITY_PALETTE.forEach((slot, i) => {
      expect(light).toContain(`--q-${i}: ${slot.light};`);
      expect(dark).toContain(`--q-${i}: ${slot.dark};`);
      expect(system).toContain(`--q-${i}: ${slot.dark};`);
    });
    expect(byPaper).toContain("@media (prefers-color-scheme: dark) { :root:not([data-theme])");
  });
});

describe("the components that show quantities outside a reading formula import the sheet", () => {
  const imports = (file: string) =>
    readFileSync(join(root, file), "utf8")
      .split("\n")
      .filter((line) => /^import "[^"]*\/generated\/quantity-colours-by-paper\.css";$/.test(line));
  for (const file of [
    "src/equations/SemanticEquation.tsx",
    "src/components/lab/ShowTheCode.tsx",
    "src/equations/quantityColourView.ts",
  ])
    test(file, () => {
      expect(imports(file).length).toBe(1);
    });
});
