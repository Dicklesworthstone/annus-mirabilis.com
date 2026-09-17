/**
 * View Guard (am-inst-2d-view-kit-u75r).
 *
 * Enforces the hard architectural doctrine from AGENTS.md:
 * "Views consume the accepted snapshot ONLY. React components format quantities and
 *  project accepted coordinates into pixels. They never independently recompute
 *  diffusion, transformed coordinates, or emitted energy. No private useState copy
 *  of a parameter, no recomputation in a component."
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface ViewGuardViolation {
  readonly file: string;
  readonly line?: number;
  readonly rule:
    | "forbidden-physics-import"
    | "private-physics-state"
    | "recompute-diffusion"
    | "recompute-transformed-coordinates"
    | "recompute-emitted-energy"
    | "raw-position-binning";
  readonly message: string;
  readonly snippet?: string;
}

const FORBIDDEN_IMPORT_PATTERNS = [
  {
    pattern: /from\s+["'][^"']*physics\/reference\/[^"']*["']/,
    message: "Views must not import reference physics calculators",
  },
  {
    pattern: /from\s+["'][^"']*workers\/wasm\/[^"']*["']/,
    message: "Views must not import worker WASM calculators directly",
  },
  {
    pattern: /from\s+["'][^"']*public\/wasm\/[^"']*["']/,
    message: "Views must not import compiled WASM binaries directly",
  },
  {
    pattern: /from\s+["'][^"']*equations\/[^"']*["']/,
    message: "Views must not import from equations selection store (decoupling rule)",
  },
];

const STATE_PHYSICS_TERMS = [
  "Diffusion",
  "Velocity",
  "Position",
  "Energy",
  "Wavelength",
  "Temperature",
  "Viscosity",
  "Diffusivity",
  "Radius",
  "Frequency",
  "Momentum",
  "Mass",
  "Gamma",
  "Lorentz",
].join("|");

const HOOK_NAME = ["use", "State"].join("");

const PRIVATE_PHYSICS_STATE_PATTERNS = [
  {
    pattern: new RegExp(`${HOOK_NAME}<[^>]*\\b(?:${STATE_PHYSICS_TERMS})\\b[^>]*>`),
    message: "Component maintains private useState typed with a physical quantity or parameter",
  },
  {
    pattern: new RegExp(
      `${HOOK_NAME}(?:\\s*<[^>]*>)?\\s*\\(\\s*\\b(?:D|t|eta|temperature|viscosity|velocity|particleRadius|gamma|lorentzFactor|frequency|wavelength|energy|mass|k_B|kB)\\b`,
    ),
    message: "Component maintains private useState initialized with a physical parameter",
  },
  {
    pattern:
      /const\s*\[\s*(?:localD|localDiffusivity|localTemperature|localViscosity|localVelocity|localEnergy|localCoord|localX|localY|particleState)\b/,
    message: "Component maintains local useState parameter copy",
  },
];

const RECOMPUTE_DIFFUSION_PATTERNS = [
  {
    pattern: /2\s*\*\s*(?:localD|localDiffusivity|D|diffusivity|diffusionConstant)\s*\*\s*t/,
    message:
      "Component recomputes diffusion mean square displacement (2 * D * t) locally instead of reading from accepted snapshot",
  },
  {
    pattern:
      /Math\.sqrt\s*\(\s*(?:2|4|6)\s*\*\s*(?:localD|localDiffusivity|D|diffusivity|diffusionConstant)\s*\*\s*t\s*\)/,
    message:
      "Component recomputes diffusion RMS displacement (sqrt(2 * D * t)) locally instead of reading from accepted snapshot",
  },
  {
    pattern: /(?:k_B|kB|R)\s*\*\s*T\s*\/\s*(?:\(\s*6\s*\*\s*Math\.PI|6\s*\*\s*Math\.PI)/,
    message:
      "Component recomputes Stokes-Einstein diffusion coefficient locally instead of consuming simulation owner results",
  },
];

const RECOMPUTE_LORENTZ_PATTERNS = [
  {
    pattern: /\(\s*x\s*-\s*(?:localVelocity|localV|v|velocity)\s*\*\s*t\s*\)\s*\/\s*Math\.sqrt/,
    message:
      "Component recomputes transformed coordinates (Lorentz boost) locally instead of reading from accepted snapshot",
  },
  {
    pattern:
      /1\s*\/\s*Math\.sqrt\s*\(\s*1\s*-\s*(?:(?:localVelocity|velocity|v)\s*\*\s*(?:localVelocity|velocity|v)|(?:\(?\s*(?:localVelocity|velocity|v)\s*\/\s*c\s*\)?\s*\*\s*2))/,
    message:
      "Component recomputes Lorentz gamma factor locally instead of reading from accepted snapshot",
  },
  {
    pattern:
      /t\s*\*\s*Math\.sqrt\s*\(\s*1\s*-\s*(?:v\s*\*\s*v|velocity\s*\*\s*velocity|localVelocity\s*\*\s*localVelocity)/,
    message: "Component recomputes time dilation locally instead of reading from accepted snapshot",
  },
];

const RECOMPUTE_ENERGY_PATTERNS = [
  {
    pattern: /(?:h|PLANCK)\s*\*\s*(?:nu|freq|frequency)\b/,
    message:
      "Component recomputes quantum energy (E = h * nu) locally instead of reading from accepted snapshot",
  },
  {
    pattern: /(?:m|mass)\s*\*\s*c\s*\*\s*c\b/,
    message:
      "Component recomputes rest energy (E = m * c^2) locally instead of reading from accepted snapshot",
  },
];

const RAW_BINNING_PATTERNS = [
  {
    pattern: /function\s+binPositions|function\s+computeBins|const\s+bins\s*=\s*positions\.reduce/,
    message:
      "Component re-bins raw positions into a histogram. Histograms accept only owner-supplied HistogramBinData.",
  },
];

/**
 * Audits a single TypeScript/TSX source file against view guard rules.
 */
export function auditViewComponentSource(
  repoRelativePath: string,
  content: string,
): ViewGuardViolation[] {
  const violations: ViewGuardViolation[] = [];
  const lines = content.split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? "";
    const lineNumber = lineIndex + 1;

    // Check forbidden imports
    for (const rule of FORBIDDEN_IMPORT_PATTERNS) {
      if (rule.pattern.test(line)) {
        violations.push({
          file: repoRelativePath,
          line: lineNumber,
          rule: "forbidden-physics-import",
          message: rule.message,
          snippet: line.trim(),
        });
      }
    }

    // Check private physics state
    for (const rule of PRIVATE_PHYSICS_STATE_PATTERNS) {
      if (rule.pattern.test(line)) {
        violations.push({
          file: repoRelativePath,
          line: lineNumber,
          rule: "private-physics-state",
          message: rule.message,
          snippet: line.trim(),
        });
      }
    }

    // Check diffusion recomputation
    for (const rule of RECOMPUTE_DIFFUSION_PATTERNS) {
      if (rule.pattern.test(line)) {
        violations.push({
          file: repoRelativePath,
          line: lineNumber,
          rule: "recompute-diffusion",
          message: rule.message,
          snippet: line.trim(),
        });
      }
    }

    // Check transformed coordinates recomputation
    for (const rule of RECOMPUTE_LORENTZ_PATTERNS) {
      if (rule.pattern.test(line)) {
        violations.push({
          file: repoRelativePath,
          line: lineNumber,
          rule: "recompute-transformed-coordinates",
          message: rule.message,
          snippet: line.trim(),
        });
      }
    }

    // Check emitted energy recomputation
    for (const rule of RECOMPUTE_ENERGY_PATTERNS) {
      if (rule.pattern.test(line)) {
        violations.push({
          file: repoRelativePath,
          line: lineNumber,
          rule: "recompute-emitted-energy",
          message: rule.message,
          snippet: line.trim(),
        });
      }
    }

    // Check raw position binning
    for (const rule of RAW_BINNING_PATTERNS) {
      if (rule.pattern.test(line)) {
        violations.push({
          file: repoRelativePath,
          line: lineNumber,
          rule: "raw-position-binning",
          message: rule.message,
          snippet: line.trim(),
        });
      }
    }
  }

  return violations;
}

/**
 * Audits an entire directory of view components against view guard rules.
 */
export function auditViewKitDirectory(kitDir: string): ViewGuardViolation[] {
  const violations: ViewGuardViolation[] = [];
  const entries = fs.readdirSync(kitDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    // Exclude viewGuard.ts itself to avoid matching the rule pattern definitions
    if (entry.name === "viewGuard.ts") continue;

    const fullPath = path.join(kitDir, entry.name);
    const content = fs.readFileSync(fullPath, "utf8");
    const fileViolations = auditViewComponentSource(entry.name, content);
    violations.push(...fileViolations);
  }

  return violations;
}
