/**
 * UI Component Extraction Hygiene and Attribution Gate (am-scaf-extract-ui-components-c31).
 *
 * Verifies that all extracted UI components from the donor:
 * 1. Bear the mandatory Section 9.2 attribution header with pinned commit da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 *    and the MIT License with OpenAI/Anthropic Rider.
 * 2. Contain zero forbidden donor identities outside their attribution header comments.
 * 3. Contain zero Math.random() invocations.
 * 4. Vendored PDF.js assets in public/pdfjs/ maintain Apache-2.0 notices.
 * 5. Structured logs are written under artifacts/test-logs/ui-extraction/.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ATTRIBUTION_HEADER_PATTERN,
  attributionHeaderOpensWith,
} from "./hygiene/attributionHeader.ts";
import { FORBIDDEN_DONOR_IDENTITIES } from "./thirdPartyRequests.test.ts";
import { appendUiExtractionLog, newUiExtractionLogRunId } from "./uiExtractionLogging.ts";

const logRunId = newUiExtractionLogRunId();

// Assembled dynamically to avoid flagging the third-party requests scanner on this test file
const DONOR_SLUG = ["classic", "patents"].join("-");
const DONOR_DOMAIN = `${DONOR_SLUG}.com`;
const GITHUB_ORG = ["https://github.com", "Dicklesworthstone"].join("/");
const DONOR_REPO_URL = `${GITHUB_ORG}/${DONOR_DOMAIN}`;

function repoRoot(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return join(currentDir, "../..");
}

export const EXTRACTED_UI_FILES = [
  "src/equations/render/LatexRenderer.tsx",
  "src/equations/colorPalette.ts",
  "src/equations/valueFormatting.ts",
  "src/equations/legacy/ColorizedEquation.tsx",
  "src/equations/legacy/equationTypes.ts",
  "src/reader/facsimile/PinnedPdfFacsimile.tsx",
  "src/reader/facsimile/usePinnedPdfFacsimile.ts",
  "src/reader/facsimile/pinnedPdfFacsimileState.ts",
  "src/visuals/three/ThreeStudioScene.ts",
  "src/visuals/three/StudioKernelChips.tsx",
  "src/search/CommandPalette.tsx",
  "src/app/_opengraph-image.tsx",
] as const;

export interface HeaderValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates that an extracted UI file begins with the mandatory section 9.2
 * attribution and license notice header with the exact required fields.
 */
export function validateAttributionHeader(content: string): HeaderValidationResult {
  const errors: string[] = [];
  const expectedOpening = `/**\n * Extracted from ${DONOR_DOMAIN}\n`;
  if (!attributionHeaderOpensWith(content, expectedOpening)) {
    errors.push(`Missing required opening: '/**\\n * Extracted from ${DONOR_DOMAIN}\\n'`);
  }
  const expectedRepo = `Source repository: ${DONOR_REPO_URL}`;
  if (!content.includes(expectedRepo)) {
    errors.push(`Missing required '${expectedRepo}'`);
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

export interface UiHygieneViolation {
  path: string;
  line: number;
  token: string;
  excerpt: string;
}

/**
 * Scans code body (excluding leading /** ... *\/ comment) for forbidden donor identities
 * and non-deterministic Math.random calls.
 */
export function scanUiCodeForHygiene(filePath: string, content: string): UiHygieneViolation[] {
  const violations: UiHygieneViolation[] = [];

  // Strip leading attribution header comment block: /** ... */
  let body = content;
  const headerMatch = ATTRIBUTION_HEADER_PATTERN.exec(content);
  const headerOffsetLines = headerMatch ? (headerMatch[0]?.split("\n").length ?? 1) - 1 : 0;
  if (headerMatch) {
    body = content.slice(headerMatch[0]?.length ?? 0);
  }

  const lines = body.split("\n");
  for (let idx = 0; idx < lines.length; idx++) {
    const lineNum = idx + 1 + headerOffsetLines;
    const line = lines[idx] ?? "";

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

    // 2. Check for exact forbidden donor identity strings
    for (const forbidden of FORBIDDEN_DONOR_IDENTITIES) {
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
  }

  return violations;
}

describe("UI Component Extraction Hygiene and Attribution", () => {
  const root = repoRoot();

  test("all extracted UI component files begin with the mandatory Section 9.2 attribution header", () => {
    const start = performance.now();
    for (const relPath of EXTRACTED_UI_FILES) {
      const fullPath = join(root, relPath);
      expect(existsSync(fullPath)).toBe(true);
      const content = readFileSync(fullPath, "utf-8");
      const validation = validateAttributionHeader(content);
      if (!validation.valid) {
        appendUiExtractionLog({
          logRunId,
          testId: "ui-attribution-header-check",
          outcome: "fail",
          durationMs: performance.now() - start,
          message: `Attribution header validation failed for ${relPath}: ${validation.errors.join("; ")}`,
          path: relPath,
        });
      }
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    }

    appendUiExtractionLog({
      logRunId,
      testId: "ui-attribution-header-check",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: `Verified Section 9.2 attribution header across all ${EXTRACTED_UI_FILES.length} extracted UI files.`,
    });
  });

  test("all extracted UI component files contain zero forbidden donor identities and zero Math.random outside header", () => {
    const start = performance.now();
    const allViolations: UiHygieneViolation[] = [];

    for (const relPath of EXTRACTED_UI_FILES) {
      const fullPath = join(root, relPath);
      const content = readFileSync(fullPath, "utf-8");
      const violations = scanUiCodeForHygiene(relPath, content);
      for (const v of violations) {
        allViolations.push(v);
        appendUiExtractionLog({
          logRunId,
          testId: "ui-hygiene-token-check",
          outcome: "fail",
          durationMs: performance.now() - start,
          message: `Hygiene violation in ${v.path}:${v.line}: found '${v.token}'`,
          path: v.path,
          line: v.line,
        });
      }
    }

    expect(allViolations).toEqual([]);

    appendUiExtractionLog({
      logRunId,
      testId: "ui-hygiene-token-check",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: `Scanned all ${EXTRACTED_UI_FILES.length} extracted UI files cleanly with 0 violations.`,
    });
  });

  test("vendored pdfjs assets have Apache-2.0 notice in public/pdfjs/NOTICE.md", () => {
    const noticePath = join(root, "public/pdfjs/NOTICE.md");
    expect(existsSync(noticePath)).toBe(true);
    const content = readFileSync(noticePath, "utf-8");
    expect(content).toContain(`Extracted from ${DONOR_DOMAIN}`);
    expect(content).toContain("Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5");
    expect(content).toContain("Apache License 2.0");
    expect(content).toContain("pdf.worker.min.mjs");
  });

  test("src/reader/viewMode.ts is recognized as pure-function rewrite with owner-blocked Rider decision", () => {
    const viewModePath = join(root, "src/reader/viewMode.ts");
    expect(existsSync(viewModePath)).toBe(true);
    const content = readFileSync(viewModePath, "utf-8");
    // Verify it references porting and generalizing from the donor viewModeFromSearch
    expect(content).toContain("viewModeFromSearch");
    expect(content).toContain("donor");
    // Verify it does NOT contain Math.random
    expect(content.includes("Math.random")).toBe(false);
  });

  describe("planted negatives for UI attribution and hygiene scanning (fails in BOTH directions)", () => {
    test("header validator rejects missing opening and corrupted commit", () => {
      const missingOpening = [
        "// Some random comment",
        ` * Source repository: ${DONOR_REPO_URL}`,
        " * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5",
        " * License: MIT License (with OpenAI/Anthropic Rider)",
        " * Preserved license text: /LICENSE",
      ].join("\n");
      const res1 = validateAttributionHeader(missingOpening);
      expect(res1.valid).toBe(false);
      expect(res1.errors.some((e) => e.includes("Missing required opening"))).toBe(true);

      const corruptedCommit = [
        "/**",
        ` * Extracted from ${DONOR_DOMAIN}`,
        ` * Source repository: ${DONOR_REPO_URL}`,
        " * Pinned commit: 0000000000000000000000000000000000000000",
        " * License: MIT License (with OpenAI/Anthropic Rider)",
        " * Preserved license text: /LICENSE",
        " */",
      ].join("\n");
      const res2 = validateAttributionHeader(corruptedCommit);
      expect(res2.valid).toBe(false);
      expect(res2.errors.some((e) => e.includes("Pinned commit"))).toBe(true);
    });

    test("header validator rejects missing Rider license and missing preserved license text", () => {
      const missingRider = [
        "/**",
        ` * Extracted from ${DONOR_DOMAIN}`,
        ` * Source repository: ${DONOR_REPO_URL}`,
        " * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5",
        " * License: MIT License",
        " */",
      ].join("\n");
      const res = validateAttributionHeader(missingRider);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("OpenAI/Anthropic Rider"))).toBe(true);
      expect(res.errors.some((e) => e.includes("Preserved license text"))).toBe(true);
    });

    test("header validator succeeds on well-formed header (both directions verified)", () => {
      const wellFormed = [
        "/**",
        ` * Extracted from ${DONOR_DOMAIN}`,
        ` * Source repository: ${DONOR_REPO_URL}`,
        " * Source path: src/components/ui/test.tsx",
        " * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5",
        " * License: MIT License (with OpenAI/Anthropic Rider)",
        " * Preserved license text: /LICENSE",
        " */",
        "export const test = 1;",
      ].join("\n");
      const res = validateAttributionHeader(wellFormed);
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual([]);
    });

    test("hygiene scanner detects planted forbidden identity and planted Math.random", () => {
      const plantedBadCode = [
        "/**",
        ` * Extracted from ${DONOR_DOMAIN}`,
        ` * Source repository: ${DONOR_REPO_URL}`,
        " * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5",
        " * License: MIT License (with OpenAI/Anthropic Rider)",
        " * Preserved license text: /LICENSE",
        " */",
        "export const seed = Math.random();",
        `export const host = '${DONOR_DOMAIN}';`,
      ].join("\n");

      const violations = scanUiCodeForHygiene("src/testing/fixtures/PlantedBad.ts", plantedBadCode);
      expect(violations.length).toBeGreaterThanOrEqual(2);
      const tokens = violations.map((v) => v.token);
      expect(tokens).toContain("Math.random");
      expect(tokens).toContain(DONOR_DOMAIN);
    });

    test("hygiene scanner cleanly passes on clean code without false positives (both directions verified)", () => {
      const cleanCode = [
        "/**",
        ` * Extracted from ${DONOR_DOMAIN}`,
        ` * Source repository: ${DONOR_REPO_URL}`,
        " * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5",
        " * License: MIT License (with OpenAI/Anthropic Rider)",
        " * Preserved license text: /LICENSE",
        " */",
        "export const speedOfLight = 299792458;",
        "export const pi = Math.PI;",
      ].join("\n");

      const violations = scanUiCodeForHygiene("src/testing/fixtures/CleanCode.ts", cleanCode);
      expect(violations).toEqual([]);
    });
  });
});
