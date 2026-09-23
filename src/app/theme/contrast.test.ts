import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contrastRatio } from "../../a11y/readingSettings/contrast";
import { COLOR_STYLES } from "../../equations/colorPalette";
import { READER_LAYOUT_TOKENS } from "../../reader/layout/tokens";
import {
  EXTERNAL_CHANNELS,
  scanColourRules,
  scanInheritedInkFailures,
  scanThemeSelectors,
  stripPrintBlocks,
  unchannelledRules,
} from "./colourChannels";
import { auditThemeTokensContrast, LAYOUT_TOKENS, THEME_IDS, THEME_TOKENS } from "./tokens";

const NORMAL_TEXT_MIN = 4.5;
const UI_BOUNDARY_MIN = 3;

describe("contrast: every declared text pair meets WCAG AA (4.5:1)", () => {
  for (const id of THEME_IDS) {
    const tokens = THEME_TOKENS[id];
    test(`${id}: ink on paper`, () => {
      expect(contrastRatio(tokens.ink, tokens.paper)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
    });
    test(`${id}: muted on paper`, () => {
      expect(contrastRatio(tokens.muted, tokens.paper)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
    });
    test(`${id}: accent on paper`, () => {
      expect(contrastRatio(tokens.accent, tokens.paper)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
    });
    // Charts draw labels as well as lines in --plot, on the paper and on wash panels. Until
    // d8f6b397 the dark theme had no plot value and drew #254f49 at 1.77:1 on its paper.
    test(`${id}: plot on paper and on wash`, () => {
      expect(contrastRatio(tokens.plot, tokens.paper)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
      expect(contrastRatio(tokens.plot, tokens.wash)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
    });
  }
});

describe("contrast: inverted and highlighted pairs meet WCAG AA (4.5:1)", () => {
  for (const id of THEME_IDS) {
    const tokens = THEME_TOKENS[id];
    test(`${id}: paper on ink (buttons, badges, skip-link)`, () => {
      expect(contrastRatio(tokens.paper, tokens.ink)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
    });
    test(`${id}: paper on accent (button hover, selection)`, () => {
      expect(contrastRatio(tokens.paper, tokens.accent)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
    });
  }
});

describe("contrast: the focus ring meets the stricter UI non-text minimum (3:1)", () => {
  for (const id of THEME_IDS) {
    const tokens = THEME_TOKENS[id];
    test(`${id}: focusRing on paper`, () => {
      expect(contrastRatio(tokens.focusRing, tokens.paper)).toBeGreaterThanOrEqual(UI_BOUNDARY_MIN);
    });
  }
});

describe("contrast: forbidden low-contrast pairs documented with exact ratios to prevent regression", () => {
  test("identical colors yield exactly 1.0 (asserted forbidden for normal text < 4.5)", () => {
    const ratio = contrastRatio(THEME_TOKENS.annalen.paper, THEME_TOKENS.annalen.paper);
    expect(ratio).toBe(1);
    expect(ratio).toBeLessThan(NORMAL_TEXT_MIN);
  });
  test("the section rule on paper yields 1.45:1 (asserted forbidden for UI boundary < 3.0)", () => {
    // Recomputed against the measured paper, not carried over: the old pair was
    // #c8c2b4 on #eee7d7 at 1.44, and reusing that number here would have made
    // the test pass for a ratio it no longer describes.
    const ratio = contrastRatio(THEME_TOKENS.annalen.rule, THEME_TOKENS.annalen.paper);
    expect(ratio).toBeCloseTo(1.447, 2);
    expect(ratio).toBeLessThan(UI_BOUNDARY_MIN);
  });
  test("hardcoded white on Kramgasse Night amber accent yields 2.18:1 (asserted forbidden for normal text < 4.5, proving why var(--paper) is required)", () => {
    const ratio = contrastRatio("#ffffff", THEME_TOKENS["kramgasse-night"].accent);
    expect(ratio).toBeCloseTo(2.18, 2);
    expect(ratio).toBeLessThan(NORMAL_TEXT_MIN);
  });
});

const HERE = dirname(fileURLToPath(import.meta.url));
const THEMES_CSS = readFileSync(join(HERE, "themes.css"), "utf8");
const GLOBALS_CSS = readFileSync(join(HERE, "../globals.css"), "utf8");

describe("contrast: color never carries meaning alone (AGENTS.md constraint)", () => {
  test("focus-visible rules define outline geometry (width, style, offset), not hue alone", () => {
    expect(THEMES_CSS).toContain("outline: 2px solid var(--focus-ring)");
    expect(THEMES_CSS).toContain("outline-offset: 2px");
  });

  test("forced-colors mode defines CanvasText outline for high-contrast visibility", () => {
    expect(THEMES_CSS).toContain("@media (forced-colors: active)");
    expect(THEMES_CSS).toContain("outline: 2px solid CanvasText");
  });

  test("links define structural underline and hover thickness changes, not hue alone", () => {
    expect(GLOBALS_CSS).toContain("text-underline-offset: 0.2em");
    expect(GLOBALS_CSS).toContain("text-decoration-thickness: 2px");
  });

  // THE THEME BUTTON'S STATE IS A SHAPE: A MOON OR A SUN. It replaced a switch whose state was the
  // knob's position (the owner, 2026-09-22: "a single toggle that is either an icon of sun or a
  // moon"). The shape is chosen by CSS from data-theme, and so is the accessible name, so both are
  // asserted here, in the rule blocks, by property. A rule is found by its WHOLE selector: a line
  // search for `.theme-toggle-sun {` matched the second half of the shared transition rule
  // `.theme-toggle-moon, .theme-toggle-sun`, which sets no opacity at all.
  const RULES = (() => {
    const css = THEMES_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    const out: { selector: string; body: string }[] = [];
    for (const m of css.matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
      const selector = (m[1] ?? "")
        .split(",")
        .map((part) => part.trim().replace(/\s+/g, " "))
        .join(", ");
      out.push({ selector, body: m[2] ?? "" });
    }
    return out;
  })();
  function ruleBody(selector: string): string {
    const found = RULES.filter((r) => r.selector === selector);
    expect(found.length, `exactly one rule for "${selector}" in themes.css`).toBe(1);
    return found[0]?.body ?? "";
  }
  const opacity = (body: string) => /opacity:\s*([\d.]+)/.exec(body)?.[1];
  const DARK = ':root[data-theme="kramgasse-night"]';

  test("the theme button shows a moon in the light theme and a sun in the dark, by shape", () => {
    // Default, which is the light theme: a press goes dark, so the moon.
    expect(opacity(ruleBody(".theme-toggle-moon"))).toBe("1");
    expect(opacity(ruleBody(".theme-toggle-sun"))).toBe("0");
    // Dark theme: a press goes light, so the sun.
    expect(opacity(ruleBody(`${DARK} .theme-toggle-moon`))).toBe("0");
    expect(opacity(ruleBody(`${DARK} .theme-toggle-sun`))).toBe("1");
  });

  test("the theme button's name is the action a press takes, chosen by the same attribute", () => {
    // Both names are in the button; the one that does not apply is display: none, which also
    // removes it from the accessible name. The two selectors share one rule.
    const rule = ruleBody(
      `${DARK} .theme-toggle-to-dark, :root:not([data-theme="kramgasse-night"]) .theme-toggle-to-light`,
    );
    expect(rule).toMatch(/display:\s*none/);
  });

  test("without JavaScript there is no data-theme, and the theme button is not shown", () => {
    expect(ruleBody(":root:not([data-theme]) .theme-toggle")).toMatch(/display:\s*none/);
  });

  test("the theme button draws in system colours when forced colours are on", () => {
    const forced = THEMES_CSS.slice(THEMES_CSS.lastIndexOf("@media (forced-colors: active)"));
    expect(forced).toContain(".theme-toggle-icon");
    expect(forced).toContain("ButtonText");
  });

  test("the theme button's motion stops under reduced motion", () => {
    const reduced = THEMES_CSS.slice(
      THEMES_CSS.lastIndexOf("@media (prefers-reduced-motion: reduce)"),
    );
    const block = reduced.slice(0, reduced.indexOf("}\n}") + 3);
    expect(block).toContain(".theme-toggle-moon");
    expect(block).toContain(".theme-toggle-sun");
    expect(block).toMatch(/transition:\s*none/);
  });

  test("disabled buttons define cursor: not-allowed and reduced opacity, not hue alone", () => {
    expect(GLOBALS_CSS).toContain("button:disabled");
    expect(GLOBALS_CSS).toContain("cursor: not-allowed");
    expect(GLOBALS_CSS).toContain("opacity: 0.55");
  });

  test("planted negative: a rule that distinguishes state only by hue fails the non-color meaning gate", () => {
    function auditRuleNonColor(cssSnippet: string): { passes: boolean; defect?: string } {
      const hasColorChange = /color:\s*[^;]+;|background(-color)?:\s*[^;]+;/i.test(cssSnippet);
      const hasStructuralCue =
        /font-weight:\s*bold|outline:|text-decoration|cursor:\s*not-allowed|opacity:|border-width:|transform:/i.test(
          cssSnippet,
        );
      if (hasColorChange && !hasStructuralCue) {
        return {
          passes: false,
          defect: "State distinguishes change by color alone without structural cue",
        };
      }
      return { passes: true };
    }

    // A defective rule that only changes hue
    const badHueOnlyRule = ".active-tab { color: #ae2119; }";
    expect(auditRuleNonColor(badHueOnlyRule).passes).toBe(false);

    // A compliant rule that changes weight or underline
    const goodRule =
      ".theme-toggle label:has(input:checked) { border-color: var(--accent); font-weight: bold; }";
    expect(auditRuleNonColor(goodRule).passes).toBe(true);
  });

  test("every equation color style defines a textual badge label and structural decoration, never hue alone", () => {
    for (const style of Object.values(COLOR_STYLES)) {
      expect(style.badgeLabel.length).toBeGreaterThan(0);
      expect(style.underlineClass).toContain("underline");
      expect(style.activeRing).toContain("ring");
    }
  });

  test("planted negative: an equation palette missing non-color cues fails the non-hue gate", () => {
    function auditPaletteNonColor(style: {
      badgeLabel?: string;
      underlineClass?: string;
      activeRing?: string;
    }): { passes: boolean; defect?: string } {
      if (!style.badgeLabel || style.badgeLabel.trim().length === 0) {
        return { passes: false, defect: "Missing textual badge label" };
      }
      if (!style.underlineClass?.includes("underline")) {
        return { passes: false, defect: "Missing structural underline decoration" };
      }
      if (!style.activeRing?.includes("ring")) {
        return { passes: false, defect: "Missing focus/active ring outline" };
      }
      return { passes: true };
    }

    const badPalette = { badgeLabel: "", underlineClass: "text-red-500", activeRing: "bg-red-100" };
    expect(auditPaletteNonColor(badPalette).passes).toBe(false);

    const goodPalette = COLOR_STYLES.crimson;
    expect(auditPaletteNonColor(goodPalette).passes).toBe(true);
  });
});

describe("contrast: Annalen's neutrals are the values measured from the plates", () => {
  const annalen = THEME_TOKENS.annalen;

  test("paper and ink are the corpus medians from artifacts/page-images, not a chosen cream", () => {
    // 100 of 100 plates, central 80% crop so the scan edge cannot pose as ink.
    // paper = dominant tone, median 251 = 0xfb. ink = 0.5th percentile, median 63 = 0x3f.
    expect(annalen.paper).toBe("#fbfbfb");
    expect(annalen.ink).toBe("#3f3f3f");
    // And they are NEUTRAL because the plates are greyscale and cannot supply a
    // hue: every channel equal is the measurement, not a style preference. This
    // is the assertion that refuses a future reintroduction of a warm cream on
    // the grounds that it "looks like 1905", which is how #eee7d7 got here.
    for (const token of [annalen.paper, annalen.ink, annalen.muted, annalen.rule, annalen.wash]) {
      const [r, g, b] = [1, 3, 5].map((i) => token.slice(i, i + 2));
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
  });

  test("muted, rule and wash reproduce the ratios Annalen had before the palette moved", () => {
    // Solved rather than sampled: a scan's intermediate tones are paper-side
    // noise, not a designed mid-tone. The targets are the RECOMPUTED figures
    // (5.974, 1.449, 1.086), not the 13.14/5.50 the old docblock quoted.
    expect(contrastRatio(annalen.muted, annalen.paper)).toBeCloseTo(5.985, 2);
    expect(contrastRatio(annalen.rule, annalen.paper)).toBeCloseTo(1.447, 2);
    expect(contrastRatio(annalen.wash, annalen.paper)).toBeCloseTo(1.082, 2);
  });

  test("the accent is unchanged, because it is editorial rather than plate-derived", () => {
    expect(annalen.accent).toBe("#ae2119");
    expect(contrastRatio(annalen.accent, annalen.paper)).toBeGreaterThanOrEqual(NORMAL_TEXT_MIN);
  });
});

describe("auditThemeTokensContrast: automated token contrast check (AC 3)", () => {
  test("auditThemeTokensContrast passes for all declared pairs across both themes", () => {
    const result = auditThemeTokensContrast(THEME_TOKENS);
    expect(result.passes).toBe(true);
    // 8 declared pairs x 2 themes. Was 24 across three until slate was removed; the
    // denominator is stated so a future drop in themes cannot quietly reduce what is checked.
    expect(result.checkedCount).toBe(16);
    expect(result.violations).toHaveLength(0);
  });

  test("planted negative: seeded text contrast violation (< 4.5:1) in any theme is detected", () => {
    const mutatedTokens = {
      ...THEME_TOKENS,
      annalen: {
        ...THEME_TOKENS.annalen,
        // Recomputed against the measured paper #fbfbfb: 2.753, still under 4.5.
        // Carried over unchecked it would have said 2.22, a number for a paper
        // that no longer exists.
        muted: "#999999",
      },
    };
    const result = auditThemeTokensContrast(mutatedTokens);
    expect(result.passes).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    const violation = result.violations.find(
      (v) => v.theme === "annalen" && v.pairName === "muted on paper",
    );
    expect(violation).toBeDefined();
    expect(violation?.ratio).toBeLessThan(4.5);
    expect(violation?.requiredRatio).toBe(4.5);
  });

  test("planted negative: seeded UI boundary contrast violation (< 3.0:1) is detected", () => {
    const mutatedTokens = {
      ...THEME_TOKENS,
      "kramgasse-night": {
        ...THEME_TOKENS["kramgasse-night"],
        // Retargeted from slate when that theme was removed. Contrast against
        // kramgasse-night's paper #1c2128 is 1.16 (< 3.0), RECOMPUTED rather than carried
        // over: slate's paper was #14181a, so the old seed would not give the same ratio.
        focusRing: "#262d35",
      },
    };
    const result = auditThemeTokensContrast(mutatedTokens);
    expect(result.passes).toBe(false);
    const violation = result.violations.find(
      (v) => v.theme === "kramgasse-night" && v.pairName === "focusRing on paper",
    );
    expect(violation).toBeDefined();
    expect(violation?.ratio).toBeLessThan(3.0);
    expect(violation?.requiredRatio).toBe(3.0);
  });
});

describe("layout tokens: cross-bead contract alignment (am-read-page-anatomy-l0b)", () => {
  test("LAYOUT_TOKENS defines positive finite values for all 5 required layout tokens", () => {
    expect(LAYOUT_TOKENS.narrowMaxEm).toBeGreaterThan(0);
    expect(LAYOUT_TOKENS.wideMinEm).toBeGreaterThan(LAYOUT_TOKENS.narrowMaxEm);
    expect(LAYOUT_TOKENS.measureCh).toBeGreaterThan(0);
    expect(LAYOUT_TOKENS.stickyLabMaxVh).toBeGreaterThan(0);
    expect(LAYOUT_TOKENS.scrollPaddingRem).toBeGreaterThan(0);
  });

  test("LAYOUT_TOKENS matches READER_LAYOUT_TOKENS exactly across all properties", () => {
    expect(LAYOUT_TOKENS.narrowMaxEm).toBe(READER_LAYOUT_TOKENS.narrowMaxEm);
    expect(LAYOUT_TOKENS.wideMinEm).toBe(READER_LAYOUT_TOKENS.wideMinEm);
    expect(LAYOUT_TOKENS.measureCh).toBe(READER_LAYOUT_TOKENS.measureCh);
    expect(LAYOUT_TOKENS.stickyLabMaxVh).toBe(READER_LAYOUT_TOKENS.stickyLabMaxVh);
    expect(LAYOUT_TOKENS.scrollPaddingRem).toBe(READER_LAYOUT_TOKENS.scrollPaddingRem);
  });

  test("planted negative: divergent layout tokens fail cross-bead contract check", () => {
    function auditLayoutTokenParity(
      source: Record<string, number>,
      consumer: Record<string, number>,
    ): { valid: boolean; differences: string[] } {
      const diffs: string[] = [];
      for (const key of Object.keys(source)) {
        if (source[key] !== consumer[key]) {
          diffs.push(`${key}: source=${source[key]} consumer=${consumer[key]}`);
        }
      }
      return { valid: diffs.length === 0, differences: diffs };
    }

    // Honest check: real tokens match
    expect(auditLayoutTokenParity(LAYOUT_TOKENS, READER_LAYOUT_TOKENS).valid).toBe(true);

    // Planted negative: altered threshold is flagged
    const badConsumer = { ...READER_LAYOUT_TOKENS, narrowMaxEm: 50 };
    const result = auditLayoutTokenParity(LAYOUT_TOKENS, badConsumer);
    expect(result.valid).toBe(false);
    expect(result.differences).toContain("narrowMaxEm: source=48 consumer=50");
  });
});

/* ==========================================================================
 * Sweeps added under am-design-themes-typography-288q (2026-09-19, pane31).
 *
 * The block above proves the colour-never-alone rule for six hand-picked
 * selectors with `toContain`. Six named examples are not a gate: nothing there
 * looks at a seventh rule. These two sweeps read every project stylesheet, so
 * the property is enforced for rules nobody has written yet.
 * ========================================================================== */

const REPO_ROOT = join(HERE, "../../..");
const CSS_ROOT = join(REPO_ROOT, "src");
const DARK_THEME_INK: Readonly<Record<string, string>> = {
  "kramgasse-night": THEME_TOKENS["kramgasse-night"].ink,
};

describe("contrast sweep: colour is never the only channel, across every stylesheet", () => {
  const rules = scanColourRules(CSS_ROOT, REPO_ROOT);

  test("the sweep actually finds the accent rules it is meant to police", () => {
    expect(rules.length).toBeGreaterThan(20);
    expect(rules.some((r) => r.selector.includes(".legend-prediction"))).toBe(true);
  });

  test("every rule that draws a distinction with --accent has a non-colour channel", () => {
    const offenders = unchannelledRules(rules).map(
      (r) => `${r.file}:${r.line} ${r.selector} { ${r.body} }`,
    );
    expect(offenders).toEqual([]);
  });

  test("planted negative: a new accent-only rule is caught by the same function", () => {
    const planted = [
      {
        file: "seeded.css",
        line: 1,
        selector: ".seeded-state-by-hue-only",
        body: "color: var(--accent);",
        hasInlineChannel: false,
      },
    ];
    expect(unchannelledRules(planted).length).toBe(1);
  });

  test("no EXTERNAL_CHANNELS entry is stale: each selector still exists and still needs the exemption", () => {
    for (const selector of Object.keys(EXTERNAL_CHANNELS)) {
      const matching = rules.filter((r) => r.selector === selector);
      expect(matching.length).toBeGreaterThan(0);
      expect(matching.every((r) => !r.hasInlineChannel)).toBe(true);
    }
  });

  test("every EXTERNAL_CHANNELS reason names where the non-colour channel actually lives", () => {
    for (const [selector, reason] of Object.entries(EXTERNAL_CHANNELS)) {
      expect(reason.length).toBeGreaterThan(40);
      // The reason must name a concrete channel, not merely assert one exists.
      // The vocabulary is deliberately broad because channels legitimately live
      // in different places: a file and line, a UA default, an ARIA state, or a
      // geometry change the CSS itself makes.
      const namesAChannel =
        /\.tsx:\d+|UA default|markup|<em>|outline|border|box-shadow|background block|aria-|italic|DASHED|SQUARE|transient pointer|figure and ground/i.test(
          reason,
        );
      expect(namesAChannel).toBe(true);
      expect(selector.length).toBeGreaterThan(0);
    }
  });
});

describe("contrast sweep: the dark themes stay readable over hardcoded backgrounds", () => {
  const failures = scanInheritedInkFailures(CSS_ROOT, REPO_ROOT, DARK_THEME_INK, contrastRatio);
  const baseline = JSON.parse(
    readFileSync(join(HERE, "darkThemeContrastBaseline.json"), "utf8"),
  ) as Record<string, number>;

  test("no stylesheet exceeds its recorded number of unreadable dark-theme rules", () => {
    const counts: Record<string, number> = {};
    for (const f of failures) counts[f.file] = (counts[f.file] ?? 0) + 1;
    const regressions: string[] = [];
    for (const [file, count] of Object.entries(counts)) {
      const allowed = baseline[file] ?? 0;
      if (count > allowed) regressions.push(`${file}: ${count} > baseline ${allowed}`);
    }
    expect(regressions).toEqual([]);
  });

  test("the baseline has no slack: a stylesheet below its number must be tightened in the same commit", () => {
    const counts: Record<string, number> = {};
    for (const f of failures) counts[f.file] = (counts[f.file] ?? 0) + 1;
    const slack: string[] = [];
    for (const [file, allowed] of Object.entries(baseline)) {
      const actual = counts[file] ?? 0;
      if (actual < allowed) slack.push(`${file}: ${actual} < baseline ${allowed}`);
    }
    expect(slack).toEqual([]);
  });

  test("the debt is fully paid: no stylesheet has any unreadable dark-theme rule", () => {
    // The baseline began at 67 file-theme pairs across 10 stylesheets and is now
    // empty. An empty baseline is STRICTER than a populated one, not weaker: every
    // file's allowance is 0, so the very next hardcoded pale background with no
    // colour fails on its first run.
    expect(failures).toEqual([]);
    expect(Object.keys(baseline)).toEqual([]);
  });

  test("planted negative: a pale background with no colour is caught for both dark themes", () => {
    // #f8e9df is globals.css's own .error background, kept here as the fixture
    // because it is the real shape of the defect rather than an invented one.
    for (const [, ink] of Object.entries(DARK_THEME_INK)) {
      expect(contrastRatio(ink, "#f8e9df")).toBeLessThan(4.5);
    }
  });

  test("the sweep exempts rules that set their own colour, so it does not flag self-consistent pastels", () => {
    for (const f of failures) {
      expect(f.ratio).toBeLessThan(4.5);
      expect(Object.keys(DARK_THEME_INK)).toContain(f.theme);
    }
  });
});

describe("contrast: the accent is perceptibly distinct from ink in both themes", () => {
  // NOT a WCAG threshold. WCAG says nothing about accent-vs-ink. This is a
  // project floor: where colour is used as the REDUNDANT second channel, it
  // should actually be perceivable. Measured 2026-09-19: annalen 2.538,
  // kramgasse-night 1.750. The floor sits below the observed
  // minimum with margin, so it catches a future token collapse, not today.
  const ACCENT_DISTINCTNESS_FLOOR = 1.5;
  for (const id of THEME_IDS) {
    test(`${id}: accent is distinguishable from ink`, () => {
      const t = THEME_TOKENS[id];
      expect(contrastRatio(t.accent, t.ink)).toBeGreaterThanOrEqual(ACCENT_DISTINCTNESS_FLOOR);
    });
  }

  test("planted negative: an accent equal to ink collapses the redundant channel and fails", () => {
    expect(contrastRatio("#1a1916", "#1a1916")).toBeLessThan(ACCENT_DISTINCTNESS_FLOOR);
  });
});

describe("contrast sweep: no stylesheet targets a theme that does not exist", () => {
  const selectors = scanThemeSelectors(CSS_ROOT, REPO_ROOT);

  test("the sweep finds the theme-scoped rules it is meant to police", () => {
    expect(selectors.length).toBeGreaterThan(4);
  });

  test("every [data-theme=...] selector names a real theme id", () => {
    const dead = selectors
      .filter((s) => !(THEME_IDS as readonly string[]).includes(s.theme))
      .map((s) => `${s.file}:${s.line} [data-theme="${s.theme}"]`);
    expect(dead).toEqual([]);
  });

  test("planted negative: the real historical typo is what this gate catches", () => {
    // derivation.css shipped [data-theme="kramgasse"] twice against the real id
    // kramgasse-night, so the move step and the move box silently lost their
    // dark treatment. This is that exact defect, not an invented fixture.
    const planted = [{ file: "derivation.css", line: 105, theme: "kramgasse" }];
    const dead = planted.filter((s) => !(THEME_IDS as readonly string[]).includes(s.theme));
    expect(dead).toHaveLength(1);
  });
});

describe("contrast sweep: the two exemptions are narrow, not a blunting of the gate", () => {
  // Both exemptions below REMOVE findings, so each is shown to remove only the
  // case it names and to leave the real defect catchable.

  test("stripPrintBlocks removes the print block and nothing around it", () => {
    const css = [
      ".before { background: #fffbeb; }",
      "@media print { .printed { background: #f5f5f5; } }",
      ".after { background: #eef2ff; }",
    ].join("\n");
    const stripped = stripPrintBlocks(css);
    expect(stripped).toContain(".before");
    expect(stripped).toContain(".after");
    expect(stripped).not.toContain(".printed");
    expect(stripped).not.toContain("#f5f5f5");
  });

  test("stripPrintBlocks keeps a non-print @media block, which the sweep must still police", () => {
    const css = "@media (min-width: 40em) { .wide { background: #fffbeb; } }";
    const stripped = stripPrintBlocks(css);
    expect(stripped).toContain(".wide");
    expect(stripped).toContain("#fffbeb");
  });

  test("stripPrintBlocks handles a nested block inside the print block without eating the rest", () => {
    const css = [
      "@media print { @page { margin: 1cm; } .printed { background: #f5f5f5; } }",
      ".kept { background: #eef2ff; }",
    ].join("\n");
    const stripped = stripPrintBlocks(css);
    expect(stripped).not.toContain(".printed");
    expect(stripped).toContain(".kept");
  });

  test("the print exemption is load-bearing: print.css has rules the sweep would otherwise flag", () => {
    // .print-scale-facts-table th sets background-color: #f5f5f5 and no colour.
    // It is correct because print.css opens its block with a universal
    // `*, *::before, *::after { color: #000000 }` reset.
    const printCss = readFileSync(join(REPO_ROOT, "src/platform/print/print.css"), "utf8");
    expect(printCss).toContain("background-color: #f5f5f5");
    expect(printCss).toContain("color: #000000");
    expect(stripPrintBlocks(printCss)).not.toContain("background-color: #f5f5f5");
  });
});

describe("contrast: the result weave stays readable and as prominent as authored", () => {
  // The weave lights whole source sentences, so its fill sits under the
  // edition's own body copy. Read from the real stylesheet, never a copy.
  const READER_CSS = readFileSync(join(REPO_ROOT, "src/reader/reader.css"), "utf8");
  const MEANINGS = [
    { name: "assumption-active", border: "#4338ca", authoredFill: "#ecf0fd", style: "dotted" },
    { name: "quantity-compared", border: "#15803d", authoredFill: "#dfece3", style: "solid" },
    { name: "agreement-within-bound", border: "#0e7490", authoredFill: "#daeced", style: "double" },
    { name: "outside-domain", border: "#c2410c", authoredFill: "#f1e9df", style: "dashed" },
  ] as const;

  function darkFill(theme: string, meaning: string): string {
    const re = new RegExp(
      `\\[data-theme="${theme}"\\]\\s*\\.weave-${meaning}\\s*\\{[^}]*background:\\s*(#[0-9a-f]{6})`,
      "i",
    );
    const m = READER_CSS.match(re);
    if (!m?.[1]) throw new Error(`No ${theme} fill declared for .weave-${meaning}`);
    return m[1];
  }

  for (const theme of ["kramgasse-night"] as const) {
    for (const { name, authoredFill } of MEANINGS) {
      test(`${theme}: .weave-${name} keeps body copy at AA and matches Annalen's prominence`, () => {
        const tokens = THEME_TOKENS[theme];
        const fill = darkFill(theme, name);
        // The lit sentence is body copy, so it takes the normal-text minimum.
        expect(contrastRatio(tokens.ink, fill)).toBeGreaterThanOrEqual(4.5);
        // And it stays as prominent as the author made it on paper.
        const authoredSeparation = contrastRatio(authoredFill, THEME_TOKENS.annalen.paper);
        const derivedSeparation = contrastRatio(fill, tokens.paper);
        expect(Math.abs(derivedSeparation - authoredSeparation)).toBeLessThan(0.05);
      });
    }
  }

  test("planted negative: the authored light fills are exactly what fails on a dark page", () => {
    // This is the real defect this block exists for, not an invented fixture.
    for (const theme of ["kramgasse-night"] as const) {
      for (const { authoredFill } of MEANINGS) {
        expect(contrastRatio(THEME_TOKENS[theme].ink, authoredFill)).toBeLessThan(4.5);
      }
    }
  });

  test("the four meanings stay distinguishable without colour, by border style", () => {
    const styles = MEANINGS.map((m) => m.style);
    expect(new Set(styles).size).toBe(styles.length);
    for (const { name, border, style } of MEANINGS) {
      const re = new RegExp(
        `\\.weave-${name}\\s*\\{[^}]*border-bottom:[^;]*${style}[^;]*${border}`,
        "i",
      );
      expect(re.test(READER_CSS)).toBe(true);
    }
  });
});
