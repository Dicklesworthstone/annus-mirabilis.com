/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/components/ui/colorPalette.test.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Added WCAG AA contrast verification (>= 4.5:1) for every palette text color against
 *   all three theme backgrounds (annalen, kramgasse-night, slate) using relativeLuminance and contrastRatio.
 * - Retained all interactive LaTeX preparation, balanced group, and double-attribution tests.
 */

import { describe, expect, test } from "bun:test";
import { contrastRatio } from "../a11y/readingSettings/contrast.ts";
import { THEME_TOKENS } from "../app/theme/tokens.ts";
import {
  COLOR_STYLES,
  type ColorVariant,
  prepareInteractiveLatex,
  wrapInteractiveKatexTerm,
  wrapKatexColor,
} from "./colorPalette.ts";

describe("colorPalette WCAG AA contrast validation", () => {
  const colorVariants: readonly ColorVariant[] = [
    "crimson",
    "sapphire",
    "emerald",
    "amber",
    "amethyst",
    "cyan",
    "coral",
    "rose",
    "teal",
  ];

  test("every palette text color satisfies WCAG AA (>= 4.5:1) against Annalen background", () => {
    const annalenPaper = THEME_TOKENS.annalen.paper;
    for (const variant of colorVariants) {
      const cfg = COLOR_STYLES[variant];
      const ratio = contrastRatio(cfg.textHexLight, annalenPaper);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("every palette text color satisfies WCAG AA (>= 4.5:1) against Kramgasse Night and Slate backgrounds", () => {
    const kramgassePaper = THEME_TOKENS["kramgasse-night"].paper;
    const slatePaper = THEME_TOKENS.slate.paper;

    for (const variant of colorVariants) {
      const cfg = COLOR_STYLES[variant];
      const kramgasseRatio = contrastRatio(cfg.textHexDark, kramgassePaper);
      const slateRatio = contrastRatio(cfg.textHexDark, slatePaper);

      expect(kramgasseRatio).toBeGreaterThanOrEqual(4.5);
      expect(slateRatio).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("prepareInteractiveLatex and KaTeX wrappers", () => {
  test("wrapKatexColor produces valid \\textcolor markup", () => {
    const light = wrapKatexColor("E", "crimson", false);
    const dark = wrapKatexColor("E", "crimson", true);
    expect(light).toBe("\\textcolor{#dc2626}{E}");
    expect(dark).toBe("\\textcolor{#f87171}{E}");
  });

  test("wrapInteractiveKatexTerm embeds htmlClass and htmlData attributes", () => {
    const wrapped = wrapInteractiveKatexTerm("energy", "E", "crimson", false);
    expect(wrapped).toBe(
      "\\htmlClass{eq-term eq-term-energy eq-term-crimson}{\\htmlData{var=energy}{\\textcolor{#dc2626}{E}}}",
    );
  });

  test("prepareInteractiveLatex wraps every mention of unique-color variables", () => {
    const equation = {
      colorizedLatex:
        "\\textcolor{#2563eb}{V}^2 = \\textcolor{#2563eb}{V} + \\textcolor{#dc2626}{g}",
      rawLatex: "V^2 = V + g",
      variables: [
        { id: "vel", symbol: "V", color: "sapphire" as const },
        { id: "grav", symbol: "g", color: "crimson" as const },
      ],
    };

    const prepared = prepareInteractiveLatex(equation);
    const count = (needle: string) => prepared.split(needle).length - 1;

    expect(count("var=vel")).toBe(2);
    expect(count("var=grav")).toBe(1);
    expect(count("\\textcolor{")).toBe(count("\\htmlData{var="));
  });

  test("prepareInteractiveLatex falls back to exact-symbol matching when two variables share a palette color", () => {
    const equation = {
      colorizedLatex: "\\textcolor{#2563eb}{V} + \\textcolor{#2563eb}{I} + \\textcolor{#2563eb}{X}",
      rawLatex: "V + I + X",
      variables: [
        { id: "volt", symbol: "V", color: "sapphire" as const },
        { id: "curr", symbol: "I", color: "sapphire" as const },
      ],
    };

    const prepared = prepareInteractiveLatex(equation);
    const count = (needle: string) => prepared.split(needle).length - 1;

    expect(count("var=volt")).toBe(1);
    expect(count("var=curr")).toBe(1);
    expect(prepared).toContain("\\textcolor{#2563eb}{X}");
    expect(count("\\htmlData{var=")).toBe(2);
  });

  test("prepareInteractiveLatex never double-attributes a group when authored hexes drift from declared colors", () => {
    const equation = {
      colorizedLatex:
        "\\textcolor{#059669}{\\Delta q} = \\textcolor{#2563eb}{q_{m}} - \\textcolor{#d97706}{q_{n}}",
      rawLatex: "\\Delta q = q_{m} - q_{n}",
      variables: [
        { id: "measured", symbol: "q_{m}", color: "emerald" as const },
        { id: "nominal", symbol: "q_{n}", color: "sapphire" as const },
        { id: "offset", symbol: "\\Delta q", color: "crimson" as const },
      ],
    };

    const prepared = prepareInteractiveLatex(equation);
    const count = (needle: string) => prepared.split(needle).length - 1;

    expect(count("var=measured")).toBe(1);
    expect(count("var=nominal")).toBe(1);
    expect(count("var=offset")).toBe(1);
    expect(prepared).not.toMatch(/\\htmlData\{var=[^{}]*\}\{\\htmlClass\{/);
  });

  test("prepareInteractiveLatex exact-symbol claims beat color-identity claims for the same group", () => {
    const equation = {
      colorizedLatex: "\\textcolor{#6b7280}{\\alpha} + \\textcolor{#0891b2}{R_2}",
      rawLatex: "\\alpha + R_2",
      variables: [
        { id: "alpha_loss", symbol: "\\alpha", color: "cyan" as const },
        { id: "r2_refl", symbol: "R_2", color: "teal" as const },
      ],
    };

    const prepared = prepareInteractiveLatex(equation);
    const count = (needle: string) => prepared.split(needle).length - 1;

    expect(count("var=alpha_loss")).toBe(1);
    expect(count("var=r2_refl")).toBe(1);
    expect(prepared).not.toMatch(/\\htmlData\{var=[^{}]*\}\{\\htmlClass\{/);
    expect(prepared).toMatch(/var=r2_refl\}\{\\textcolor\{#0891b2\}\{R_2\}/);
  });

  test("prepareInteractiveLatex keeps the double-attribution guard for long variable ids", () => {
    const longId = "a_very_long_variable_identifier_that_exceeds_sixty_five_characters_in_total_x";
    expect(longId.length).toBeGreaterThanOrEqual(65);
    const prepared = prepareInteractiveLatex({
      colorizedLatex: "\\textcolor{#059669}{\\Delta q} = \\textcolor{#2563eb}{q_{m}}",
      rawLatex: "\\Delta q = q_{m}",
      variables: [
        { id: "measured", symbol: "q_{m}", color: "emerald" as const },
        { id: longId, symbol: "\\Delta q", color: "crimson" as const },
      ],
    });
    const count = (needle: string) => prepared.split(needle).length - 1;

    expect(count(`var=${longId}`)).toBe(1);
    expect(count("var=measured")).toBe(1);
    expect(prepared).not.toMatch(/\\htmlData\{var=[^{}]*\}\{\\htmlClass\{/);
  });

  test("prepareInteractiveLatex raw-text fallback never rewrites class names, var ids, hexes, or \\text prose", () => {
    const prepared = prepareInteractiveLatex({
      colorizedLatex:
        "\\htmlClass{eq-term eq-term-a eq-term-crimson}{\\htmlData{var=a}{\\textcolor{#dc2626}{A}}} + eq \\text{ eq } eq",
      rawLatex: "A + eq \\text{ eq } eq",
      variables: [
        { id: "a", symbol: "A", color: "crimson" as const },
        { id: "eq_var", symbol: "eq", color: "sapphire" as const },
      ],
    });
    const count = (needle: string) => prepared.split(needle).length - 1;

    expect(count("var=eq_var}")).toBe(2);
    expect(count("var=a}")).toBe(1);
    expect(prepared).toContain("\\text{ eq }");
    expect(prepared).toContain(
      "\\htmlClass{eq-term eq-term-a eq-term-crimson}{\\htmlData{var=a}{\\textcolor{#dc2626}{A}}}",
    );
  });

  test("prepareInteractiveLatex is idempotent and avoids duplicating existing term classes", () => {
    const alreadyPrepared = {
      rawLatex: "\\htmlClass{eq-term eq-term-v eq-term-sapphire}{\\htmlData{var=v}{V}}",
      variables: [{ id: "v", symbol: "V", color: "sapphire" as const }],
    };

    const result = prepareInteractiveLatex(alreadyPrepared);
    expect(result).toBe(alreadyPrepared.rawLatex);
  });
});
