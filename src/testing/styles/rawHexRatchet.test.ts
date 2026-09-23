import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * A shrink-only ratchet gate with enforced tightening pawl against raw hardcoded hex colors
 * in TSX/TS UI components and visual renderers (am-design-themes-typography-288q).
 *
 * To guarantee complete, defect-free theme switching across Annalen (light cream),
 * Kramgasse Night (dark slate/amber), both user-facing UI and
 * visual instrumentation must resolve colors via semantic CSS variables and design tokens
 * (e.g. var(--paper), var(--ink), var(--muted), var(--line), var(--accent)).
 *
 * -----------------------------------------------------------------------------------------
 * RATCHET RULES & THE TIGHTENING PAWL
 * -----------------------------------------------------------------------------------------
 * 1. Pre-existing raw hex colors are pinned per file in rawHexBaseline.json.
 * 2. REGRESSION FAILURE (count > allowed): A file introducing new raw hex colors fails immediately.
 * 3. SLACK BASELINE FAILURE (count < allowed): A shrink-only ratchet without an active pawl allows
 *    backsliding. When a conversion commit eliminates hardcoded hexes, the test FAILS with an
 *    actionable error printing the exact replacement number. The developer MUST tighten
 *    rawHexBaseline.json in the same commit to permanently lock in the improvement.
 * 4. UNLISTED FILE FAILURE: Any new or unlisted file in an audited directory fails at count > 0.
 * 5. DATA COLOR EXEMPTIONS: Physical phenomena (e.g. optical light spectra mapped from frequency
 *    in THz or wavelength in nm) are exempted via the explicit DATA_COLOR_ALLOWLIST.
 *    Exemptions are strictly per-entry { file, hex, reason } and NEVER file-level exclusions.
 * 6. TERMINATION: When all files reach zero raw hex colors, this ratchet has completed its lifecycle.
 *
 * -----------------------------------------------------------------------------------------
 * AUDITED SCOPE (ENFORCED UI & VISUAL DIRECTORIES)
 * -----------------------------------------------------------------------------------------
 * All .tsx and .ts component files under:
 * - src/components/: Core UI components and interactive laboratory instrumentation.
 * - src/visuals/: 2D/3D visualization layers, studio chips, canvas overlays, Three.js scenes.
 * - src/discovery/: Discovery mode journey cards, branches, and exercises.
 * - src/reader/: Historical facsimile viewers, reading interfaces, and entrance interactives.
 * - src/equations/genealogy/: Interactive SVG equation derivation graphs and layout renderers.
 * - src/experiments/interactions/: Parametric interaction controls and sliders.
 *
 * -----------------------------------------------------------------------------------------
 * DELIBERATE OUT-OF-SCOPE BOUNDARIES (ARCHITECTURAL DECISIONS)
 * -----------------------------------------------------------------------------------------
 * The following files contain literal hex strings outside the audited UI scope by design:
 *
 * 1. src/app/theme/tokens.ts:
 *    Authoritative UI theme token definitions (THEME_TOKENS: Annalen, Kramgasse Night, Slate).
 *    This module defines the color tokens that the rest of the application consumes; it cannot
 *    consume tokens from itself.
 *
 * 2. src/equations/colorPalette.ts:
 *    Authoritative KaTeX mathematical palette token registry (COLOR_STYLES).
 *    DECISION: Deliberately recognized as a second token-definition home (not an ad-hoc UI gap).
 *    KaTeX compiles LaTeX mathematical expressions into static HTML/MathML at build time. TeX color
 *    macros (\textcolor{#hex}{...}) require literal hex arguments; KaTeX cannot evaluate dynamic
 *    browser CSS custom properties (var(--...)) inside static equation ASTs. Every text color in
 *    COLOR_STYLES is mathematically calibrated and verified in contrast.test.ts to guarantee
 *    WCAG AA contrast (>= 4.5:1) against all three themes.
 *
 * 3. src/design/semanticColor/tokens.ts:
 *    Authoritative semantic color system definitions.
 *
 * 4. src/app/_opengraph-image.tsx:
 *    Server-side OpenGraph social card image generator using @vercel/og canvas. Runs in an isolated
 *    edge runtime to produce a static PNG, completely detached from browser DOM and theme stylesheets.
 *
 * 5. src/a11y/readingSettings/contrast.ts:
 *    Pure numerical WCAG contrast calculation algorithms with standard black/white (#000000 / #ffffff)
 *    default calculation boundaries.
 *
 * 6. src/design/spectralMapping.ts & src/physics/reference/photoelectric.ts:
 *    Reference physics libraries computing physical optical dispersion, spectroscopy anchors (Balmer
 *    series, Sodium D lines), and Planck/Einstein relations.
 *
 * 7. src/platform/offline/chapter.ts:
 *    Offline export builder generating standalone single-file chapter artifacts.
 *
 * 8. *.test.ts, *.test.tsx:
 *    Test suites, planted negative fixtures, and contrast verification gates (e.g. contrast.test.ts,
 *    colorPalette.test.ts).
 */

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const BASELINE_PATH = join(ROOT, "src/testing/styles/rawHexBaseline.json");

export const AUDITED_DIRECTORIES = [
  "src/components",
  "src/visuals",
  "src/discovery",
  "src/reader",
  "src/equations/genealogy",
  "src/experiments/interactions",
] as const;

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
  // Special relativity frame, simultaneity, and contraction data colors in RodSimultaneityPlots:
  {
    file: "src/components/lab/RodSimultaneityPlots.tsx",
    hex: "#38bdf8",
    reason:
      "Rest-frame proper length L0 rod fill and moving sphere (§4) contracted ellipsoid visual fill",
  },
  {
    file: "src/components/lab/RodSimultaneityPlots.tsx",
    hex: "#f59e0b",
    reason: "Moving-frame Lorentz-contracted length L0/gamma rod fill in relative motion",
  },
  {
    file: "src/components/lab/RodSimultaneityPlots.tsx",
    hex: "#0284c7",
    reason:
      "Platform Frame K boundary stroke, 45-degree invariant light cone worldlines, and §4 longitudinal contraction axis",
  },
  {
    file: "src/components/lab/RodSimultaneityPlots.tsx",
    hex: "#d97706",
    reason:
      "Moving Frame k boundary stroke, and boosted primed coordinate axes (x', ct') tilted by arctan(v/c)",
  },
  {
    file: "src/components/lab/RodSimultaneityPlots.tsx",
    hex: "#ef4444",
    reason: "Physical rod endpoint coordinate measurement events at x=0 and x=L",
  },
  {
    file: "src/components/lab/RodSimultaneityPlots.tsx",
    hex: "#10b981",
    reason: "Spacetime origin reference event E1(0,0) marker in Minkowski diagram",
  },
  {
    file: "src/components/lab/RodSimultaneityPlots.tsx",
    hex: "#f43f5e",
    reason: "Spacetime comparison event E2(dx, c*dt) marker in Minkowski diagram",
  },
  // Wave description, two-source crest superposition, and spherical energy spreading data colors in WaveDescriptionPlots:
  {
    file: "src/components/lab/WaveDescriptionPlots.tsx",
    hex: "#0284c7",
    reason: "Screen intensity profile curve <I(y)> data trace in InterferencePlot",
  },
  {
    file: "src/components/lab/WaveDescriptionPlots.tsx",
    hex: "#e11d48",
    reason: "Selected screen position probe marker line, circle, and text in InterferencePlot",
  },
  {
    file: "src/components/lab/WaveDescriptionPlots.tsx",
    hex: "#38bdf8",
    reason:
      "Coherent wave source S1 crest wavefront rings, pinhead marker, and screen center intensity spot in WavefrontPlot",
  },
  {
    file: "src/components/lab/WaveDescriptionPlots.tsx",
    hex: "#fbbf24",
    reason:
      "Coherent wave source S2 crest wavefront rings and pinhead marker with relative phase shift delta in WavefrontPlot",
  },
  {
    file: "src/components/lab/WaveDescriptionPlots.tsx",
    hex: "#0ea5e9",
    reason:
      "Concentric spherical wave shells (r1, r2, r4) illustrating isotropic inverse-square energy spreading in SpreadingPlot",
  },
  {
    file: "src/components/lab/WaveDescriptionPlots.tsx",
    hex: "#34d399",
    reason:
      "Active radius measurement shell, radius vector ray, and enclosed power flux indicator in SpreadingPlot",
  },
  {
    file: "src/components/lab/WaveDescriptionPlots.tsx",
    hex: "#f59e0b",
    reason: "Central isotropic radiant point source emitter in SpreadingPlot",
  },
  {
    file: "src/components/lab/WaveDescriptionPlots.tsx",
    hex: "#f43f5e",
    reason: "Differential sensor aperture at radius r capturing radiant flux in SpreadingPlot",
  },
  // Radiation vs. Gas comparison data series in CoefficientMatchPlot (§6 The Move):
  {
    file: "src/components/lab/lq06/CoefficientMatchPlot.tsx",
    hex: "#f43f5e",
    reason: "Wien monochromatic radiation (§4) data series stroke and mean quantum energy bar",
  },
  {
    file: "src/components/lab/lq06/CoefficientMatchPlot.tsx",
    hex: "#0ea5e9",
    reason:
      "Ideal gas / solute molecules (§5) data series stroke and mean molecule kinetic energy bar",
  },
  // Equation genealogy graph edge type data colors in Genealogy.tsx:
  {
    file: "src/equations/genealogy/Genealogy.tsx",
    hex: "#2d6a9f",
    reason:
      "Genealogy graph edge stroke and arrowhead marker color for modern-verification-oracle edge type",
  },
  {
    file: "src/equations/genealogy/Genealogy.tsx",
    hex: "#c25e00",
    reason:
      "Genealogy graph edge stroke and arrowhead marker color for cross-reference / crossPaper edge type",
  },
  {
    file: "src/equations/genealogy/Genealogy.tsx",
    hex: "#8c8273",
    reason: "Genealogy graph edge stroke color for historical-derivation default edge type",
  },
  {
    file: "src/equations/genealogy/Genealogy.tsx",
    hex: "#5c5346",
    reason:
      "Genealogy graph arrowhead marker fill color for historical-derivation default edge type",
  },
  // Special relativity electromagnetic field and reference frame data colors in FieldFrameChangePlot:
  {
    file: "src/components/lab/sr08/FieldFrameChangePlot.tsx",
    hex: "#e65100",
    reason:
      "Electric field vector E visual representation (arrowhead, vector line, coordinate label, and component decomposition)",
  },
  {
    file: "src/components/lab/sr08/FieldFrameChangePlot.tsx",
    hex: "#0277bd",
    reason:
      "Magnetic field vector B visual representation (arrowhead, out-of-plane Bz circle, cross/dot indicators, and label)",
  },
  {
    file: "src/components/lab/sr08/FieldFrameChangePlot.tsx",
    hex: "#2e7d32",
    reason:
      "Lorentz force vector F visual representation (arrowhead, vector line, and force label)",
  },
  // Physical pulse directions, frame velocity, and energy ledgers in TwoLedgersPlot (ME-01):
  {
    file: "src/components/lab/me01/TwoLedgersPlot.tsx",
    hex: "#2563eb",
    reason:
      "Physical forward light pulse 1 energy vector and quantity label in moving observer frame",
  },
  {
    file: "src/components/lab/me01/TwoLedgersPlot.tsx",
    hex: "#ea580c",
    reason:
      "Physical backward light pulse 2 energy vector and quantity label in moving observer frame",
  },
  {
    file: "src/components/lab/me01/TwoLedgersPlot.tsx",
    hex: "#059669",
    reason:
      "Observer velocity vector v and physical kinetic energy change Delta K in moving frame energy ledger",
  },
  // Physical transport mechanisms in DriftDiffusionPlots (Einstein 1905 paper 2, §3):
  {
    file: "src/components/lab/DriftDiffusionPlots.tsx",
    hex: "#27ae60",
    reason:
      "Directed Stokes drift flux (J_drift = n*mu*F) physical transport mechanism representation in FluxBalancePlot",
  },
  {
    file: "src/components/lab/DriftDiffusionPlots.tsx",
    hex: "#c0392b",
    reason:
      "Brownian diffusive counter-flux (J_diff = -D*dn/dx) physical transport mechanism representation in FluxBalancePlot",
  },
  // Particle tracer trajectory and position marker data colors in TrajectoryLayer (2D view kit):
  {
    file: "src/visuals/kit/TrajectoryLayer.tsx",
    hex: "#3b82f6",
    reason: "Particle tracer trajectory path and endpoint marker data color in Canvas 2D rendering",
  },
  // Physical ray paths, Doppler shifts, vectors, and power ledgers in MovingMirrorPlot (SR-11):
  {
    file: "src/components/lab/sr11/MovingMirrorPlot.tsx",
    hex: "#f59e0b",
    reason:
      "Incident light wave vector and unshifted reflected ray spectral color in moving mirror reflection",
  },
  {
    file: "src/components/lab/sr11/MovingMirrorPlot.tsx",
    hex: "#3b82f6",
    reason:
      "Doppler blueshifted reflected light wave vector and total output power ledger in moving mirror reflection",
  },
  {
    file: "src/components/lab/sr11/MovingMirrorPlot.tsx",
    hex: "#ef4444",
    reason: "Doppler redshifted reflected light wave vector in moving mirror reflection",
  },
  {
    file: "src/components/lab/sr11/MovingMirrorPlot.tsx",
    hex: "#10b981",
    reason: "Mirror velocity vector and mechanical work rate in moving mirror reflection",
  },
  {
    file: "src/components/lab/sr11/MovingMirrorPlot.tsx",
    hex: "#ec4899",
    reason: "Radiation pressure force vector acting on moving mirror face",
  },
  // Atmospheric procedural sky canvas texture in ThreeStudioScene:
  {
    file: "src/visuals/three/ThreeStudioScene.ts",
    hex: "#60a5fa",
    reason: "canvas 2D gradient stop; CSS custom properties do not resolve in canvas context",
  },
  {
    file: "src/visuals/three/ThreeStudioScene.ts",
    hex: "#93c5fd",
    reason: "canvas 2D gradient stop; CSS custom properties do not resolve in canvas context",
  },
  {
    file: "src/visuals/three/ThreeStudioScene.ts",
    hex: "#bae6fd",
    reason: "canvas 2D gradient stop; CSS custom properties do not resolve in canvas context",
  },
  {
    file: "src/visuals/three/ThreeStudioScene.ts",
    hex: "#e0f2fe",
    reason: "canvas 2D gradient stop; CSS custom properties do not resolve in canvas context",
  },
  {
    file: "src/visuals/three/ThreeStudioScene.ts",
    hex: "#fef3c7",
    reason: "canvas 2D gradient stop; CSS custom properties do not resolve in canvas context",
  },
  // Historical facsimile canvas render backing in usePinnedPdfFacsimile:
  {
    file: "src/reader/facsimile/usePinnedPdfFacsimile.ts",
    hex: "#ffffff",
    reason:
      "canvas 2D fillStyle and PDF.js background; CSS custom properties do not resolve in canvas context",
  },
  // Osmotic pressure configuration integral model comparison in ConfigurationPlot (BM-03 §3):
  // Mass-energy equivalence boundary ledger photon pulse momentum and radiation flux data colors in BoundaryLedgerPlot (ME-03):
  {
    file: "src/components/lab/me03/BoundaryLedgerPlot.tsx",
    hex: "#2563eb",
    reason: "Pulse 1 four-momentum vector and forward radiation beam in BoundaryLedgerPlot",
  },
  {
    file: "src/components/lab/me03/BoundaryLedgerPlot.tsx",
    hex: "#ea580c",
    reason:
      "Pulse 2 four-momentum vector and escaping/retained radiation flow in BoundaryLedgerPlot",
  },
  // Radiation vs. Gas comparison data series in CoefficientMatchPlot (§6 The Move):
  {
    file: "src/components/lab/lq06/CoefficientMatchPlot.tsx",
    hex: "#f43f5e",
    reason: "Wien monochromatic radiation (§4) data series stroke and mean quantum energy bar",
  },
  {
    file: "src/components/lab/lq06/CoefficientMatchPlot.tsx",
    hex: "#0ea5e9",
    reason:
      "Ideal gas / solute molecules (§5) data series stroke and mean molecule kinetic energy bar",
  },
];

const HEX_COLOR_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;

export function findAuditFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...findAuditFiles(full));
    } else if (
      (entry.endsWith(".tsx") || entry.endsWith(".ts")) &&
      !entry.includes(".test.") &&
      !entry.endsWith(".d.ts")
    ) {
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

export interface AuditResult {
  readonly regressions: string[];
  readonly slack: string[];
  readonly replacementUpdates: string[];
}

export function auditFileHexCount(
  fileRel: string,
  count: number,
  baseline: ReadonlyMap<string, number>,
): AuditResult {
  const allowed = baseline.get(fileRel) ?? 0;

  if (count > allowed) {
    return {
      regressions: [
        `${fileRel}: ${count} raw hex color(s) exceeds baseline ${allowed}. ` +
          "Replace hardcoded hex with theme tokens (var(--paper), var(--ink), var(--accent), etc.) [am-design-themes-typography-288q]",
      ],
      slack: [],
      replacementUpdates: [],
    };
  }

  if (count < allowed) {
    return {
      regressions: [],
      slack: [
        `${fileRel}: ${count} raw hex color(s) is below baseline ${allowed}. ` +
          `Ratchet pawl engaged: tighten baseline to ${count} in rawHexBaseline.json to lock in improvement. [am-design-themes-typography-288q]`,
      ],
      replacementUpdates: [`  "${fileRel}": ${count},`],
    };
  }

  return { regressions: [], slack: [], replacementUpdates: [] };
}

describe("raw hex colors ratchet (am-design-themes-typography-288q)", () => {
  test("no file exceeds its recorded baseline and no baseline is slack (enforced tightening pawl)", () => {
    const baselineRaw = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Record<string, number>;
    const baseline = new Map<string, number>(Object.entries(baselineRaw));

    const allRegressions: string[] = [];
    const allSlack: string[] = [];
    const replacementLines: string[] = [];

    const filesToAudit: string[] = [];
    for (const d of AUDITED_DIRECTORIES) {
      filesToAudit.push(...findAuditFiles(join(ROOT, d)));
    }

    for (const file of filesToAudit) {
      const rel = relative(ROOT, file);
      const source = readFileSync(file, "utf8");
      const count = countUnallowlistedHexColors(source, rel, DATA_COLOR_ALLOWLIST);

      const result = auditFileHexCount(rel, count, baseline);
      if (result.regressions.length > 0) {
        allRegressions.push(...result.regressions);
      }
      if (result.slack.length > 0) {
        allSlack.push(...result.slack);
        replacementLines.push(...result.replacementUpdates);
      }
    }

    // Check for stale baseline entries for files that no longer exist
    for (const baselinedFile of baseline.keys()) {
      if (!existsSync(join(ROOT, baselinedFile))) {
        allSlack.push(
          `${baselinedFile}: file does not exist in working tree. Remove from rawHexBaseline.json.`,
        );
      }
    }

    const failureMessages: string[] = [];

    if (allRegressions.length > 0) {
      failureMessages.push(
        `[REGRESSION] Raw hex colors increased in ${allRegressions.length} file(s):\n` +
          allRegressions.join("\n") +
          "\nComponents must use theme CSS variables rather than hardcoded hex colors. See am-design-themes-typography-288q.",
      );
    }

    if (allSlack.length > 0) {
      failureMessages.push(
        `[SLACK BASELINE] Ratchet pawl engaged! ${allSlack.length} file(s) have improved below their baseline:\n` +
          allSlack.join("\n") +
          "\n\nTighten src/testing/styles/rawHexBaseline.json with the following exact replacement entries:\n" +
          replacementLines.join("\n"),
      );
    }

    assert.deepEqual(failureMessages, [], failureMessages.join("\n\n"));
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
    const result = auditFileHexCount("src/components/Example.tsx", 3, fakeBaseline);
    expect(result.regressions.length).toBe(1);
    expect(result.slack.length).toBe(0);
    expect(result.regressions[0]).toContain("exceeds baseline 2");
  });

  test("planted negative: an unlisted file with raw hex triggers regression failure", () => {
    const fakeBaseline = new Map<string, number>();
    const result = auditFileHexCount("src/components/NewComponent.tsx", 1, fakeBaseline);
    expect(result.regressions.length).toBe(1);
    expect(result.slack.length).toBe(0);
    expect(result.regressions[0]).toContain("baseline 0");
  });

  test("planted negative: a file below baseline triggers slack baseline failure (ratchet pawl test)", () => {
    const fakeBaseline = new Map([["src/components/lab/DriftDiffusionPlots.tsx", 23]]);
    // Actual drops to 14 (as pane21 achieved)
    const result = auditFileHexCount(
      "src/components/lab/DriftDiffusionPlots.tsx",
      14,
      fakeBaseline,
    );
    expect(result.regressions.length).toBe(0);
    expect(result.slack.length).toBe(1);
    expect(result.slack[0]).toContain("below baseline 23");
    expect(result.slack[0]).toContain("tighten baseline to 14");
    expect(result.replacementUpdates[0]).toBe(
      '  "src/components/lab/DriftDiffusionPlots.tsx": 14,',
    );
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

  test("the ratchet baseline records non-negative integers only for audited paths", () => {
    const baselineRaw = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Record<string, number>;
    for (const [file, count] of Object.entries(baselineRaw)) {
      expect(typeof count).toBe("number");
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(0);
      expect(file).toMatch(
        /^src\/(components|visuals|discovery|reader|equations\/genealogy|experiments\/interactions)\//,
      );
    }
  });
});
