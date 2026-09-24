import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CompiledEquation } from "./viewTypes.ts";

/**
 * The explorer and show-the-code colour their quantities from src/generated/quantity-colours-by-
 * paper.css, which they import themselves (am-ywtb). Before, the rules sat inside the reading's
 * sheet, which only a reading formula imported, so on /lab/bm-01/ and /lab/lq-06/ the explorer's
 * chip dots were blank and its glyphs ink.
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
