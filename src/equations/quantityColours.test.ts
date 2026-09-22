import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { contrastRatio } from "../a11y/readingSettings/contrast";
import { THEME_TOKENS } from "../app/theme/tokens";
import {
  assignQuantityColours,
  type ColourableEquation,
  QUANTITY_PALETTE,
  QuantityColourError,
} from "./quantityColours.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const THEMES = [
  ["light", THEME_TOKENS.annalen],
  ["dark", THEME_TOKENS["kramgasse-night"]],
] as const;

describe("the quantity palette is text, so every colour reads as text in both themes", () => {
  for (const [theme, tokens] of THEMES) {
    for (const colour of QUANTITY_PALETTE) {
      test(`${colour.name} (${theme}) clears 4.5:1 on paper and on wash`, () => {
        expect(contrastRatio(colour[theme], tokens.paper)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colour[theme], tokens.wash)).toBeGreaterThanOrEqual(4.5);
      });
    }
    test(`no quantity takes the ${theme} theme's accent`, () => {
      const accent = tokens.accent.toLowerCase();
      expect(QUANTITY_PALETTE.map((c) => c[theme].toLowerCase())).not.toContain(accent);
    });
  }

  test("every slot has its own pattern, so pattern mode separates what colour cannot", () => {
    const patterns = QUANTITY_PALETTE.map((c) => c.pattern);
    expect(new Set(patterns).size).toBe(patterns.length);
  });

  test("every pattern is an underline, because an overline or a strike over a symbol is mathematics", () => {
    // An overline turned λ_x into a mean, λ̄_x, and dots set above v read as a second derivative.
    for (const c of QUANTITY_PALETTE) {
      expect(c.pattern.startsWith("underline ")).toBe(true);
      expect(c.pattern).not.toMatch(/overline|line-through/);
    }
  });

  test("equations.css declares exactly these values, for light and for dark", () => {
    const css = readFileSync(join(ROOT, "src/equations/equations.css"), "utf8");
    // The declaration block that opens with --q-0 under exactly this selector.
    const block = (selector: string) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = new RegExp(`(^|\\n)\\s*${escaped} \\{\\s*--q-0[^}]*\\}`).exec(css);
      expect(match).not.toBeNull();
      return match?.[0] ?? "";
    };
    const light = block(":root");
    const dark = block(':root[data-theme="kramgasse-night"]');
    const systemDark = block(":root:not([data-theme])");
    for (const c of QUANTITY_PALETTE) {
      expect(light).toContain(`--q-${c.slot}: ${c.light};`);
      expect(dark).toContain(`--q-${c.slot}: ${c.dark};`);
      expect(systemDark).toContain(`--q-${c.slot}: ${c.dark};`);
    }
  });
});

/** The records exactly as authored, so the property is checked on what readers see. */
function records(paper: string): ColourableEquation[] {
  const dir = join(ROOT, "content/equations", paper);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
    .map((r) => ({ id: r.id, argument: r.argument, quantityIds: symbols(r.tree) }));
}
function symbols(node: unknown): string[] {
  if (!node || typeof node !== "object") return [];
  const o = node as Record<string, unknown>;
  const own = o.kind === "symbol" && typeof o.quantityId === "string" ? [o.quantityId] : [];
  return [
    ...own,
    ...Object.values(o).flatMap((v) => (Array.isArray(v) ? v : [v]).flatMap(symbols)),
  ];
}

describe("assignQuantityColours", () => {
  for (const paper of ["brownian-motion", "mass-energy"]) {
    test(`${paper}: no equation shows two quantities in one colour`, () => {
      const eqs = records(paper);
      expect(eqs.length).toBeGreaterThan(0);
      const colours = assignQuantityColours(eqs);
      for (const e of eqs) {
        const ids = [...new Set(e.quantityIds)];
        expect(ids.length).toBeGreaterThan(0);
        expect(new Set(ids.map((id) => colours[id])).size).toBe(ids.length);
      }
    });
  }

  test("a paper whose quantities fit the palette gets one colour per quantity", () => {
    const eqs = records("brownian-motion");
    const colours = assignQuantityColours(eqs);
    const ids = Object.keys(colours);
    expect(ids.length).toBeLessThanOrEqual(QUANTITY_PALETTE.length);
    expect(new Set(Object.values(colours)).size).toBe(ids.length);
  });

  test("the same records give the same colours, whatever order they arrive in", () => {
    const eqs = records("mass-energy");
    expect(assignQuantityColours([...eqs].reverse())).toEqual(assignQuantityColours(eqs));
  });

  test("the colouring is found where a fixed-order pass fails (the constant C and its eight neighbours)", () => {
    // The first implementation assigned slots in record order and threw on these records.
    expect(() => assignQuantityColours(records("mass-energy"))).not.toThrow();
  });

  const refusal = (run: () => unknown) => {
    try {
      run();
    } catch (error) {
      expect(error).toBeInstanceOf(QuantityColourError);
      return (error as QuantityColourError).code;
    }
    return "no refusal";
  };

  test("an equation with more quantities than colours is refused, not coloured twice", () => {
    const nine = Array.from({ length: 9 }, (_, i) => `q${i}`);
    expect(
      refusal(() =>
        assignQuantityColours([{ id: "eq-model-x-nine", argument: "arg-x", quantityIds: nine }]),
      ),
    ).toBe("equation-exceeds-palette");
  });

  test("a paper that no eight colours can serve is refused, even when every equation fits", () => {
    // Nine quantities, every pair of them in some two-term equation: each needs a colour unlike
    // the other eight, so nine are needed although no single equation shows more than two.
    const nine = Array.from({ length: 9 }, (_, i) => `q${i}`);
    const pairs = nine.flatMap((a, i) =>
      nine
        .slice(i + 1)
        .map((b) => ({ id: `eq-model-x-${a}-${b}`, argument: "arg-x", quantityIds: [a, b] })),
    );
    expect(pairs.length).toBe(36);
    expect(refusal(() => assignQuantityColours(pairs))).toBe("paper-not-colourable");
  });
});
