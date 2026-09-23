import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { appendExtractionLog, newExtractionLogRunId } from "./extractionLogging.ts";
import {
  ATTRIBUTION_HEADER_PATTERN,
  attributionHeaderOpensWith,
} from "./hygiene/attributionHeader.ts";

const logRunId = newExtractionLogRunId();

function repoRoot(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return join(currentDir, "../..");
}

export const EXTRACTED_FILES = [
  // The five carriers of the extraction header that no gate's list held (am-75t2). The
  // three lists were drawn by KIND - runtime here, scripts, UI components - while the
  // population is defined by the HEADER, so a file that is a test of an extracted module,
  // or the ambient types an extracted module needs, fell between all three. Each is
  // recorded with its reason rather than as a group:
  //
  //   colorPalette.test.ts             tests src/equations/colorPalette.ts (UI list)
  //   valueFormatting.test.ts          tests src/equations/valueFormatting.ts (UI list)
  //   pinnedPdfFacsimileState.test.ts  tests .../pinnedPdfFacsimileState.ts (UI list)
  //   src/types/pdfjs-dist.d.ts        ambient types the facsimile viewer needs
  //   src/types/three.d.ts             ambient types the Three studio scene needs
  //
  // They are here rather than in the UI list because a test file and an ambient
  // declaration are not UI components, and this list already carries a non-runtime file
  // (src/testing/wasm/artifactHelpers.ts). The durable fix is the bead's criterion (a),
  // deriving the population from the header instead of hand-listing it at all; this
  // closes the hole without pretending the three-list split is sound.
  "src/equations/colorPalette.test.ts",
  "src/equations/valueFormatting.test.ts",
  "src/reader/facsimile/pinnedPdfFacsimileState.test.ts",
  "src/types/pdfjs-dist.d.ts",
  "src/types/three.d.ts",
  "src/experiments/tape/controlTape.ts",
  "src/experiments/scheduler/tickScheduler.ts",
  "src/workers/transport.ts",
  "src/experiments/paramAliases.ts",
  "src/workers/genericWasm.ts",
  "src/workers/useGenericWasmSource.ts",
  "src/testing/wasm/artifactHelpers.ts",
  "src/units/qty.ts",
  "src/physics/intervals.ts",
  "src/physics/energyLedger.ts",
  "src/content/coverage/coverageManifest.ts",
  "src/reader/weave/predicates.ts",
];

export const FORBIDDEN_STRINGS = [
  "classic-patents.com",
  "www.classic-patents.com",
  "classic-patents.vercel.app",
  "prj_eeVw8BqcY9iO2e0VEQyS5i6rZkE0",
  "classic-patents",
  "45_267",
  "45267",
  "/patents/us-821393-wright-flyer",
  "/patents/us-4063220-metcalfe-ethernet",
  "/patents/",
  "https://github.com/Dicklesworthstone/classic-patents.com",
  "https://github.com/Dicklesworthstone",
  "https://schema.org",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "patents.google.com",
  "https://patents.google.com",
  "https://openapi.vercel.sh",
  "https://solidmechanics.org",
];

export const FORBIDDEN_DONOR_CONSTANTS = [
  "PATENT_PARAM_ALIASES",
  "usePatentPhysics",
  "telemetryData",
  "WRIGHT_FLYER_TEACHING_TAPE",
  "LAMARR_HOPPING_TEACHING_TAPE",
  "GOODYEAR_CURE_REGIMES",
  "EDISON_VACUUM_REGIMES",
  "FERMI_CRITICALITY_REGIMES",
  "WRIGHT_AERODYNAMIC_REGIMES",
  "HALL_ELECTROLYSIS_REGIMES",
  "DIESEL_IGNITION_REGIMES",
  "WRIGHT_GROSS_WEIGHT_N",
  "us-381968-tesla-motor",
  "teslaKernel",
  "teslaTransformer",
];

export interface HeaderValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates that an extracted runtime file begins with the mandatory section 9.2
 * attribution and license notice header with the exact required fields. Matches
 * scripts/extractedScriptsHygiene.test.ts's validateAttributionHeader (55b63a7) so the
 * two extraction hygiene gates use one checking shape, not two.
 */
/**
 * The donor's subject vocabulary as words, not substrings. See the note at its use site.
 */
export const DONOR_VOCABULARY = /\b(?:patent\w*|wright)\b/i;

export function validateAttributionHeader(content: string): HeaderValidationResult {
  const errors: string[] = [];
  if (!attributionHeaderOpensWith(content, "/**\n * Extracted from classic-patents.com\n")) {
    errors.push("Missing required opening: '/**\\n * Extracted from classic-patents.com\\n'");
  }
  if (
    !content.includes("Source repository: https://github.com/Dicklesworthstone/classic-patents.com")
  ) {
    errors.push(
      "Missing required 'Source repository: https://github.com/Dicklesworthstone/classic-patents.com'",
    );
  }
  if (!content.includes("Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5")) {
    errors.push("Missing required 'Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5'");
  }
  if (!content.includes("License: MIT License (with OpenAI/Anthropic Rider)")) {
    errors.push("Missing required 'License: MIT License (with OpenAI/Anthropic Rider)'");
  }
  if (!content.includes("Preserved license text: /LICENSE")) {
    errors.push("Missing required 'Preserved license text: /LICENSE'");
  }
  return { valid: errors.length === 0, errors };
}

export interface HygieneViolation {
  path: string;
  line: number;
  token: string;
  excerpt: string;
}

export function scanCodeForHygiene(filePath: string, content: string): HygieneViolation[] {
  const violations: HygieneViolation[] = [];

  // Strip leading attribution header comment block: /** ... */
  let body = content;
  const headerMatch = ATTRIBUTION_HEADER_PATTERN.exec(content);
  const headerOffsetLines = headerMatch ? headerMatch[0].split("\n").length - 1 : 0;
  if (headerMatch) {
    body = content.slice(headerMatch[0].length);
  }

  const lines = body.split("\n");
  for (let idx = 0; idx < lines.length; idx++) {
    const lineNum = idx + 1 + headerOffsetLines;
    const line = lines[idx]!;

    // 1. Check for Math.random
    if (line.includes("Math.random")) {
      const startChar = Math.max(0, line.indexOf("Math.random") - 30);
      violations.push({
        path: filePath,
        line: lineNum,
        token: "Math.random",
        excerpt: line.slice(startChar, startChar + 120).trim(),
      });
    }

    // 2. Check for exact forbidden strings
    for (const forbidden of FORBIDDEN_STRINGS) {
      if (line.includes(forbidden)) {
        const startChar = Math.max(0, line.indexOf(forbidden) - 30);
        violations.push({
          path: filePath,
          line: lineNum,
          token: forbidden,
          excerpt: line.slice(startChar, startChar + 120).trim(),
        });
      }
    }

    // 3. Check for forbidden donor constants/kernels
    for (const constName of FORBIDDEN_DONOR_CONSTANTS) {
      if (line.includes(constName)) {
        const startChar = Math.max(0, line.indexOf(constName) - 30);
        violations.push({
          path: filePath,
          line: lineNum,
          token: constName,
          excerpt: line.slice(startChar, startChar + 120).trim(),
        });
      }
    }

    // 4. The donor's subject vocabulary, matched as WORDS rather than as substrings.
    //
    // This read `lower.includes("patent") || lower.includes("wright")`, and the comment
    // above it promised "(excluding allowed comments or identifiers)" - a behaviour the
    // code did not implement. `ArrowRight` contains "wright" and is an ordinary
    // KeyboardEvent key name; `playwright` contains it too. Both are why a donor UI
    // component could not be added to this gate's list without turning it red on a
    // keyboard handler (am-75t2).
    //
    // A bare \b word rule over-corrects in the other direction: it loses `/patents/`,
    // `patented` and `patentee`, and `/patents/` is one of the tokens AGENTS.md names
    // explicitly. `patent\w*` keeps the donor's route and its inflections while
    // `impatient` still has no word boundary before it. Verified over sixteen cases:
    //   caught   patent, patents, /patents/, patented, patentee, classic-patents.com,
    //            Wright, Wright Flyer, us-821393-wright-flyer
    //   passed   ArrowRight, ArrowLeft, playwright, copyright, downright, impatient
    const match = line.match(DONOR_VOCABULARY);
    if (match) {
      {
        const token = match[0];
        const startChar = Math.max(0, line.indexOf(token) - 30);
        violations.push({
          path: filePath,
          line: lineNum,
          token,
          excerpt: line.slice(startChar, startChar + 120).trim(),
        });
      }
    }
  }

  return violations;
}

describe("Extraction Hygiene and Attribution Gate", () => {
  test("all extracted runtime files pass hygiene scan (no forbidden identities, no Math.random, no donor patent constants)", () => {
    const start = performance.now();
    const root = repoRoot();
    const allViolations: HygieneViolation[] = [];

    for (const relPath of EXTRACTED_FILES) {
      const fullPath = join(root, relPath);
      const content = readFileSync(fullPath, "utf-8");

      // Verify attribution header is present and complete
      const headerValidation = validateAttributionHeader(content);
      expect(headerValidation.valid).toBe(true);
      expect(headerValidation.errors).toEqual([]);

      const violations = scanCodeForHygiene(relPath, content);
      for (const v of violations) {
        allViolations.push(v);
        appendExtractionLog({
          logRunId,
          testId: "extraction-hygiene-failure",
          outcome: "fail",
          durationMs: performance.now() - start,
          message: `Hygiene violation in ${v.path}:${v.line}: found forbidden token '${v.token}'`,
          extra: {
            path: v.path,
            token: v.token,
            line: v.line,
            excerpt: v.excerpt,
          },
        });
      }
    }

    expect(allViolations).toEqual([]);

    appendExtractionLog({
      logRunId,
      testId: "extraction-hygiene-all-clean",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: `Hygiene scan verified ${EXTRACTED_FILES.length} runtime files with zero forbidden tokens or Math.random`,
    });
  });

  test("deliberately failing hygiene fixture triggers violation detection and structured log formatting", () => {
    const start = performance.now();
    const badFixtureCode = `/**
 * Attribution header
 */
const seed = Math.random();
const route = "/patents/us-821393-wright-flyer";
const kernel = "wrightKernel";
`;
    const violations = scanCodeForHygiene(
      "src/testing/fixtures/deliberatelyFailingHygiene.ts",
      badFixtureCode,
    );
    expect(violations.length).toBeGreaterThan(0);

    const tokensFound = violations.map((v) => v.token);
    expect(tokensFound).toContain("Math.random");

    for (const v of violations) {
      expect(v.excerpt.length).toBeLessThanOrEqual(120);
      expect(typeof v.line).toBe("number");
      appendExtractionLog({
        logRunId,
        testId: "extraction-hygiene-deliberate-fixture-proof",
        outcome: "pass",
        durationMs: performance.now() - start,
        message: `Deliberate fixture caught violation '${v.token}' on line ${v.line}`,
        extra: {
          path: v.path,
          token: v.token,
          line: v.line,
          excerpt: v.excerpt,
        },
      });
    }
  });

  describe("planted negatives for attribution and license notice verification", () => {
    test("rejects an extracted file with no attribution header", () => {
      const unannotated = 'export const test = "no header";\n';
      const result = validateAttributionHeader(unannotated);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Missing required opening"))).toBe(true);
    });

    test("rejects an extracted file missing the source repository URL", () => {
      const missingRepo = [
        "/**",
        " * Extracted from classic-patents.com",
        " * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5",
        " * License: MIT License (with OpenAI/Anthropic Rider)",
        " * Preserved license text: /LICENSE",
        " */",
      ].join("\n");
      const result = validateAttributionHeader(missingRepo);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Source repository"))).toBe(true);
    });

    test("rejects an extracted file missing the pinned commit", () => {
      const missingCommit = [
        "/**",
        " * Extracted from classic-patents.com",
        " * Source repository: https://github.com/Dicklesworthstone/classic-patents.com",
        " * License: MIT License (with OpenAI/Anthropic Rider)",
        " * Preserved license text: /LICENSE",
        " */",
      ].join("\n");
      const result = validateAttributionHeader(missingCommit);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Pinned commit"))).toBe(true);
    });

    test("rejects an extracted file missing the OpenAI/Anthropic Rider clause", () => {
      const missingRider = [
        "/**",
        " * Extracted from classic-patents.com",
        " * Source repository: https://github.com/Dicklesworthstone/classic-patents.com",
        " * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5",
        " * License: MIT License",
        " * Preserved license text: /LICENSE",
        " */",
      ].join("\n");
      const result = validateAttributionHeader(missingRider);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("License: MIT License (with OpenAI/Anthropic Rider)")),
      ).toBe(true);
    });

    test("rejects an extracted file missing the preserved license text reference", () => {
      const missingLicenseText = [
        "/**",
        " * Extracted from classic-patents.com",
        " * Source repository: https://github.com/Dicklesworthstone/classic-patents.com",
        " * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5",
        " * License: MIT License (with OpenAI/Anthropic Rider)",
        " */",
      ].join("\n");
      const result = validateAttributionHeader(missingLicenseText);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Preserved license text"))).toBe(true);
    });

    test("accepts a complete, correctly-ordered header", () => {
      const complete = [
        "/**",
        " * Extracted from classic-patents.com",
        " * Source repository: https://github.com/Dicklesworthstone/classic-patents.com",
        " * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5",
        " * License: MIT License (with OpenAI/Anthropic Rider)",
        " * Preserved license text: /LICENSE",
        " */",
      ].join("\n");
      const result = validateAttributionHeader(complete);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  test("SI unit 'tesla' is allowed in units code and does not trigger false positive", () => {
    const start = performance.now();
    const unitsCode = `/**
 * Attribution header
 */
export function getUnit() {
  return "tesla";
}
`;
    const violations = scanCodeForHygiene("src/units/qty.ts", unitsCode);
    expect(violations).toEqual([]);

    appendExtractionLog({
      logRunId,
      testId: "extraction-hygiene-tesla-si-unit-allowed",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "Bare SI unit name 'tesla' is allowed in units code without tripping hygiene scan",
    });
  });
});
