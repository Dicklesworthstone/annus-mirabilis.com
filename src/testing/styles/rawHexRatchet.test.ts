import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * A shrink-only ratchet gate against raw hardcoded hex colors in TSX components (am-design-themes-typography-288q).
 *
 * To ensure consistent theme support across Annalen, Kramgasse Night, and Slate,
 * components must use semantic theme tokens and CSS variables (e.g. var(--paper),
 * var(--ink), var(--muted), var(--accent)) rather than hardcoding hex colors.
 *
 * Ratchet rules:
 * 1. Pre-existing raw hex colors are pinned per file in rawHexBaseline.json.
 * 2. The baseline is shrink-only: a file exceeding its baseline count fails.
 * 3. A new file not in the baseline fails at the first raw hex color.
 * 4. Data colors representing physical phenomena (e.g. getFrequencyBand() mapping THz
 *    to optical light colors, or FalseColorLegend wavelength mappings) are explicitly
 *    allowlisted with scientific rationale, NOT via file-level exclusions.
 * 5. When all files reach zero raw hex colors, this ratchet has completed its lifecycle.
 */

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const BASELINE_PATH = join(ROOT, "src/testing/styles/rawHexBaseline.json");
const DIRS_TO_SCAN = ["src/components", "src/visuals", "src/discovery"];

export interface DataColorAllowlistEntry {
  /** Relative path of the file containing the data color */
  readonly file: string;
  /** Allowed lowercase raw hex color code */
  readonly hex: string;
  /** Physical quantity, spectrum mapping, or scientific visualization rationale */
  readonly reason: string;
}

/**
 * Explicit allowlist for physical scientific data mappings.
 * These represent physical light spectra and wavelength mappings,
 * distinct from UI design tokens.
 */
export const DATA_COLOR_ALLOWLIST: readonly DataColorAllowlistEntry[] = [
  // Physical frequency band to visible/invisible spectrum mapping in FluorescencePlot (getFrequencyBand):
  {
    file: "src/components/lab/lq07/FluorescencePlot.tsx",
    hex: "#7c3aed",
    reason: "Ultraviolet (UV) spectral band (> 789 THz, < 380 nm) in getFrequencyBand()",
  },
  {
    file: "src/components/lab/lq07/FluorescencePlot.tsx",
    hex: "#8b5cf6",
    reason: "Violet spectral band (680–789 THz) in getFrequencyBand()",
  },
  {
    file: "src/components/lab/lq07/FluorescencePlot.tsx",
    hex: "#3b82f6",
    reason: "Blue spectral band (600–680 THz) in getFrequencyBand()",
  },
  {
    file: "src/components/lab/lq07/FluorescencePlot.tsx",
    hex: "#10b981",
    reason: "Green spectral band (530–600 THz) in getFrequencyBand()",
  },
  {
    file: "src/components/lab/lq07/FluorescencePlot.tsx",
    hex: "#eab308",
    reason: "Yellow spectral band (510–530 THz) in getFrequencyBand()",
  },
  {
    file: "src/components/lab/lq07/FluorescencePlot.tsx",
    hex: "#f97316",
    reason: "Orange spectral band (480–510 THz) in getFrequencyBand()",
  },
  {
    file: "src/components/lab/lq07/FluorescencePlot.tsx",
    hex: "#ef4444",
    reason: "Red spectral band (400–480 THz) in getFrequencyBand()",
  },
  {
    file: "src/components/lab/lq07/FluorescencePlot.tsx",
    hex: "#b91c1c",
    reason: "Infrared (IR) spectral band (< 400 THz, > 750 nm) in getFrequencyBand()",
  },
  // False-color spectrum legend mapping physical wavelengths (380–750 nm):
  {
    file: "src/visuals/kit/FalseColorLegend.tsx",
    hex: "#4b0082",
    reason: "False-color spectrum legend: indigo wavelength band",
  },
  {
    file: "src/visuals/kit/FalseColorLegend.tsx",
    hex: "#0000ff",
    reason: "False-color spectrum legend: blue wavelength band",
  },
  {
    file: "src/visuals/kit/FalseColorLegend.tsx",
    hex: "#00ff00",
    reason: "False-color spectrum legend: green wavelength band",
  },
  {
    file: "src/visuals/kit/FalseColorLegend.tsx",
    hex: "#ffff00",
    reason: "False-color spectrum legend: yellow wavelength band",
  },
  {
    file: "src/visuals/kit/FalseColorLegend.tsx",
    hex: "#ff7f00",
    reason: "False-color spectrum legend: orange wavelength band",
  },
  {
    file: "src/visuals/kit/FalseColorLegend.tsx",
    hex: "#ff0000",
    reason: "False-color spectrum legend: red wavelength band",
  },
];

const HEX_COLOR_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;

export function findTsxFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...findTsxFiles(full));
    } else if (entry.endsWith(".tsx") && !entry.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

export function extractRawHexColors(source: string): string[] {
  // Strip block comments and line comments
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  // Strip HTML entities (e.g. &#8315; or &#x207B;) so decimal/hex entities do not collide
  const withoutEntities = withoutComments.replace(/&#x?[0-9a-fA-F]+;/g, "");
  // Strip SVG url fragment identifiers (e.g. url(#arrow), url(#clipId))
  const withoutUrlFragments = withoutEntities.replace(/url\(#[^)]+\)/g, "");

  const matches = withoutUrlFragments.match(HEX_COLOR_RE) ?? [];
  return matches.map((m) => m.toLowerCase());
}

export function countUnallowlistedHexColors(
  source: string,
  relativePath: string,
  allowlist: readonly DataColorAllowlistEntry[] = DATA_COLOR_ALLOWLIST,
): number {
  const allowedForFile = new Set(
    allowlist
      .filter((entry) => entry.file === relativePath)
      .map((entry) => entry.hex.toLowerCase()),
  );

  const rawHexes = extractRawHexColors(source);
  let count = 0;
  for (const hex of rawHexes) {
    if (!allowedForFile.has(hex)) {
      count++;
    }
  }
  return count;
}

export function auditFileHexCount(
  fileRel: string,
  count: number,
  baseline: ReadonlyMap<string, number>,
): string[] {
  const allowed = baseline.get(fileRel) ?? 0;
  if (count > allowed) {
    return [
      `${fileRel}: ${count} raw hex color(s), baseline ${allowed}. ` +
        "Replace hardcoded hex with theme tokens (var(--paper), var(--ink), var(--accent), etc.) [am-design-themes-typography-288q]",
    ];
  }
  return [];
}

describe("raw hex colors ratchet (am-design-themes-typography-288q)", () => {
  test("no file exceeds its recorded baseline and no new file introduces raw hex colors", () => {
    const baselineRaw = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Record<string, number>;
    const baseline = new Map<string, number>(Object.entries(baselineRaw));

    const regressions: string[] = [];
    const improvements: string[] = [];

    const filesToAudit: string[] = [];
    for (const d of DIRS_TO_SCAN) {
      filesToAudit.push(...findTsxFiles(join(ROOT, d)));
    }

    for (const file of filesToAudit) {
      const rel = relative(ROOT, file);
      const source = readFileSync(file, "utf8");
      const count = countUnallowlistedHexColors(source, rel, DATA_COLOR_ALLOWLIST);
      const allowed = baseline.get(rel) ?? 0;

      const fileRegressions = auditFileHexCount(rel, count, baseline);
      if (fileRegressions.length > 0) {
        regressions.push(...fileRegressions);
      } else if (count < allowed) {
        improvements.push(`${rel}: ${count} < ${allowed}`);
      }
    }

    assert.deepEqual(
      regressions,
      [],
      `Raw hex colors increased:\n${regressions.join("\n")}\n` +
        "Components must use theme CSS variables rather than hardcoded hex colors. See am-design-themes-typography-288q.",
    );

    if (improvements.length > 0) {
      console.log(
        `[am-design-themes-typography-288q] baseline can be lowered for ${improvements.length} file(s): ${improvements.join(", ")}`,
      );
    }
  });

  test("planted negative: detector fires when a raw hex color is introduced", () => {
    const planted = '<div style={{ color: "#123456" }} />';
    expect(countUnallowlistedHexColors(planted, "src/components/Example.tsx")).toBe(1);
  });

  test("planted negative: detector fires on alpha hex (#rrggbbaa and #rgba)", () => {
    const planted8 = '<div style={{ backgroundColor: "#12345678" }} />';
    expect(countUnallowlistedHexColors(planted8, "src/components/Example.tsx")).toBe(1);

    const planted4 = '<div style={{ backgroundColor: "#1234" }} />';
    expect(countUnallowlistedHexColors(planted4, "src/components/Example.tsx")).toBe(1);
  });

  test("planted negative: a file exceeding its baseline triggers regression failure", () => {
    const fakeBaseline = new Map([["src/components/Example.tsx", 2]]);
    const violations = auditFileHexCount("src/components/Example.tsx", 3, fakeBaseline);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain("baseline 2");
  });

  test("planted negative: an unlisted file with raw hex triggers regression failure", () => {
    const fakeBaseline = new Map<string, number>();
    const violations = auditFileHexCount("src/components/NewComponent.tsx", 1, fakeBaseline);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain("baseline 0");
  });

  test("detector ignores comments and HTML character entities", () => {
    const codeWithComments = `
      // Single line comment with #123456
      /* Block comment with #abcdef */
      const entity = "u&#8315;&#179;";
      const valid = <div className="panel" />;
    `;
    expect(countUnallowlistedHexColors(codeWithComments, "src/components/Example.tsx")).toBe(0);
  });

  test("detector ignores SVG url fragment references", () => {
    const svgCode = '<line markerEnd="url(#arrow)" stroke="var(--ink)" />';
    expect(countUnallowlistedHexColors(svgCode, "src/components/Example.tsx")).toBe(0);
  });

  test("detector permits allowlisted data colors with physical rationale", () => {
    const fluorFile = "src/components/lab/lq07/FluorescencePlot.tsx";
    const uvCode = 'return { name: "Ultraviolet (UV)", color: "#7c3aed" };';
    expect(countUnallowlistedHexColors(uvCode, fluorFile)).toBe(0);

    // An unallowlisted hex in FluorescencePlot is caught
    const unallowedInFluor = 'return { name: "Custom", color: "#ff00ff" };';
    expect(countUnallowlistedHexColors(unallowedInFluor, fluorFile)).toBe(1);

    // The same allowlisted color in a non-allowlisted UI file is caught
    const otherFile = "src/components/lab/PredictPanel.tsx";
    expect(countUnallowlistedHexColors(uvCode, otherFile)).toBe(1);
  });

  test("data color allowlist contains valid hexes and substantive reasons for every entry", () => {
    expect(DATA_COLOR_ALLOWLIST.length).toBeGreaterThanOrEqual(14);
    for (const entry of DATA_COLOR_ALLOWLIST) {
      expect(entry.hex).toMatch(/^#[0-9a-fA-F]{3,8}$/);
      expect(entry.file.length).toBeGreaterThan(0);
      expect(entry.reason.length).toBeGreaterThan(10);
    }
  });

  test("the ratchet baseline records non-negative integers only", () => {
    const baselineRaw = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Record<string, number>;
    for (const [file, count] of Object.entries(baselineRaw)) {
      expect(typeof count).toBe("number");
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(0);
      expect(file).toMatch(/^src\/(components|visuals|discovery)\//);
    }
  });
});
