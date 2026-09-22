/**
 * Hygiene tests for am-scaf-extract-scripts-7jm's extracted files. Not
 * itself extracted from classic-patents.com: it is new test code written to
 * enforce this bead's acceptance criteria.
 *
 * Fixed fixtures only; creates and deletes no temporary files (AGENTS.md
 * Rule 1), consistent with the donor's own deployment-test property this
 * bead's requirements preserve.
 */

import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ATTRIBUTION_HEADER_PATTERN, attributionHeaderOpensWith } from "../src/testing/hygiene/attributionHeader.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const EXTRACTED_SOURCE_FILES = [
  "scripts/deployment-target.ts",
  "scripts/deployment-target.test.ts",
  "scripts/deployment-verification.ts",
  "scripts/deployment-verification.test.ts",
  "scripts/smoke-test-deployment.ts",
  "scripts/verified-production-deploy.ts",
  "scripts/e2e/paper-e2e-contract.ts",
  "scripts/e2e/paper-e2e-contract.test.ts",
  "scripts/e2e-paper-vertical-slices.ts",
  "scripts/app-router-architecture.ts",
  "scripts/app-router-architecture.test.ts",
] as const;

export interface HeaderValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates that an extracted source file begins with the mandatory section 9.2
 * attribution and license notice header with the exact required fields.
 */
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

const NON_COMMENTABLE_FIXTURE_FILES = [
  "scripts/fixtures/deployment-target/corrupt-project.txt",
  "scripts/fixtures/deployment-target/wrong-project.json",
  "scripts/fixtures/deployment-target/plausible-real-project.json",
] as const;

/**
 * The donor audit's own authoritative list (docs/DONOR_AUDIT.md section
 * 10.1), read from that document rather than retyped here, so this test
 * fails loudly if the audit document and the hygiene scan ever drift apart.
 */
function readForbiddenIdentityList(): string[] {
  const auditPath = path.join(REPO_ROOT, "docs/DONOR_AUDIT.md");
  const audit = fs.readFileSync(auditPath, "utf8");
  const sectionStart = audit.indexOf("### 10.1 Master Fenced List of Exact Forbidden Strings");
  if (sectionStart === -1) {
    throw new Error("docs/DONOR_AUDIT.md is missing section 10.1's forbidden identity list.");
  }
  const fenceStart = audit.indexOf("```text", sectionStart);
  const fenceEnd = audit.indexOf("```", fenceStart + "```text".length);
  if (fenceStart === -1 || fenceEnd === -1) {
    throw new Error("docs/DONOR_AUDIT.md section 10.1's fenced list could not be parsed.");
  }
  return audit
    .slice(fenceStart + "```text".length, fenceEnd)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Reports every forbidden-identity match found outside a file's leading
 * attribution header (the section 9.2 comment block every extracted file
 * begins with). A match inside that header is expected and required: the
 * template itself names the donor path and pinned commit.
 */
function scanForForbiddenIdentities(
  content: string,
  forbidden: readonly string[],
): { token: string; line: number }[] {
  const headerMatch = ATTRIBUTION_HEADER_PATTERN.exec(content);
  const headerEnd = headerMatch ? headerMatch.index + headerMatch[0].length : 0;
  const body = content.slice(headerEnd);
  const bodyStartLine = content.slice(0, headerEnd).split("\n").length;

  const violations: { token: string; line: number }[] = [];
  for (const token of forbidden) {
    let searchFrom = 0;
    let index = body.indexOf(token, searchFrom);
    while (index !== -1) {
      const line = bodyStartLine + body.slice(0, index).split("\n").length - 1;
      violations.push({ token, line });
      searchFrom = index + token.length;
      index = body.indexOf(token, searchFrom);
    }
  }
  return violations;
}

describe("extracted donor identity hygiene", () => {
  const forbidden = readForbiddenIdentityList();

  test("docs/DONOR_AUDIT.md section 10.1 names the donor lock port among the forbidden strings", () => {
    // Guards the self-test below: if the audit document ever stops naming
    // the lock port, that self-test would trivially pass for the wrong
    // reason, so assert the precondition explicitly first.
    expect(forbidden).toContain("45267");
    expect(forbidden).toContain("45_267");
  });

  test("the scanner itself fails on a fixture containing the donor lock port outside a comment", () => {
    const fixtureWithViolation = [
      "export const DEPLOYMENT_LOCK_PORT = 45267;",
      'export const HOSTNAME = "classic-patents.com";',
    ].join("\n");
    const violations = scanForForbiddenIdentities(fixtureWithViolation, forbidden);
    const tokens = violations.map((v) => v.token);
    expect(tokens).toContain("45267");
    expect(tokens).toContain("classic-patents.com");
  });

  test("the scanner does not flag a forbidden string inside the attribution header", () => {
    const fixtureHeaderOnly = [
      "/**",
      " * Extracted from classic-patents.com",
      " * Source repository: https://github.com/Dicklesworthstone/classic-patents.com",
      " * Source path: scripts/example.ts",
      " * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5",
      " * License: MIT License (with OpenAI/Anthropic Rider)",
      " * Preserved license text: /LICENSE",
      " *",
      " * Modifications:",
      " * - none, this is a fixture",
      " */",
      "",
      "export const value = 1;",
    ].join("\n");
    expect(scanForForbiddenIdentities(fixtureHeaderOnly, forbidden)).toEqual([]);
  });

  for (const relativePath of EXTRACTED_SOURCE_FILES) {
    test(`${relativePath}: no forbidden donor identity outside the attribution header`, () => {
      const content = fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
      const violations = scanForForbiddenIdentities(content, forbidden);
      expect(violations).toEqual([]);
    });

    test(`${relativePath}: begins with the section 9.2 attribution header`, () => {
      const content = fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
      const validation = validateAttributionHeader(content);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  }

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
  });

  for (const relativePath of NON_COMMENTABLE_FIXTURE_FILES) {
    test(`${relativePath}: no forbidden donor identity anywhere (fixtures carry no header)`, () => {
      const content = fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
      const violations = scanForForbiddenIdentities(content, forbidden);
      expect(violations).toEqual([]);
    });
  }
});

describe("runId field naming discipline", () => {
  // AGENTS.md "Structured logs": `runId` is reserved for an experiment
  // realization under the runtime contract. A test suite uses `logRunId`
  // and a tool run uses `toolRunId`; neither is a substring match for this
  // pattern (`logRunId`/`toolRunId` capitalize the `R`), so this correctly
  // flags only a literal `runId` field or property, not its prose mentions
  // in a "renamed X to Y" comment.
  const FIELD_PATTERN = /\brunId\s*:/;

  for (const relativePath of EXTRACTED_SOURCE_FILES) {
    test(`${relativePath}: never declares or assigns a field literally named runId`, () => {
      const content = fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
      expect(FIELD_PATTERN.test(content)).toBe(false);
    });
  }
});

describe("tool-run-id artifact directory naming", () => {
  test("scripts/smoke-test-deployment.ts names its artifact directory with a tool run id", () => {
    const content = fs.readFileSync(
      path.join(REPO_ROOT, "scripts/smoke-test-deployment.ts"),
      "utf8",
    );
    expect(content).toContain("newToolRunId");
    expect(content).toContain("toolRunId");
    expect(content).toMatch(/artifacts",\s*"smoke-test-deployment",\s*toolRunId/);
  });

  test("scripts/verified-production-deploy.ts names its future artifact directory with a tool run id", () => {
    const content = fs.readFileSync(
      path.join(REPO_ROOT, "scripts/verified-production-deploy.ts"),
      "utf8",
    );
    expect(content).toContain("newToolRunId");
    expect(content).toMatch(/artifacts",\s*"verified-production-deploy",\s*toolRunId/);
  });
});

describe("the deploy entry point refuses before any network, git, or Vercel call", () => {
  test("main() refuses without a valid --authorization file with zero commands invoked", async () => {
    const { main, __setSpawnForTesting, __resetSpawnForTesting } = await import(
      "./verified-production-deploy.ts"
    );
    const recordedCalls: unknown[] = [];
    __setSpawnForTesting((...args: unknown[]) => {
      recordedCalls.push(args);
      throw new Error("a refused entry point must never reach a spawn call");
    });
    const originalArgv = process.argv;
    process.argv = ["bun", "scripts/verified-production-deploy.ts", "--profile", "scaffold"];
    try {
      let threw = false;
      try {
        await main();
      } catch (error) {
        threw = true;
        const message = error instanceof Error ? error.message : String(error);
        expect(message).toContain("Missing required --authorization");
      }
      expect(threw).toBe(true);
      expect(recordedCalls).toEqual([]);
    } finally {
      process.argv = originalArgv;
      __resetSpawnForTesting();
    }
  });

  test("--help exits cleanly with zero commands invoked", async () => {
    const { main, __setSpawnForTesting, __resetSpawnForTesting } = await import(
      "./verified-production-deploy.ts"
    );
    const recordedCalls: unknown[] = [];
    __setSpawnForTesting((...args: unknown[]) => {
      recordedCalls.push(args);
      throw new Error("--help must never reach a spawn call");
    });
    const originalArgv = process.argv;
    process.argv = [...originalArgv, "--help"];
    try {
      await main();
      expect(recordedCalls).toEqual([]);
    } finally {
      process.argv = originalArgv;
      __resetSpawnForTesting();
    }
  });
});
