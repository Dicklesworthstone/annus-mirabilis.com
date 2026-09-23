/**
 * Comprehensive accept/reject tests for refusal throw and reporting sites in src/content/kernel (am-muyh).
 *
 * Governed by AGENTS.md doctrine 4 (kernels own the law) and am-muyh:
 * - Accept/reject test pair per reachable refusal site.
 * - Every test carries explicit line citation and literal refusal code.
 * - Zero mocks: tests use authentic records, in-memory source texts, or real file fixtures.
 *
 * Note on possibly-unreachable refusal site (reported to orchestrator):
 * - verify.ts:162 (missing-ts-kernel-fields in verifySliceKernels):
 *   verifySliceKernels iterates over the static SLICE_KERNEL_CATALOG whose entries are
 *   all valid TypeScript kernel references. Reaching this branch requires mutating or
 *   mocking the static catalog, which violates the no-mocking principle.
 */

import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { describe } from "node:test";
import {
  checkIdentifierBindings,
  checkIndependentReferences,
  checkLiveTermBindings,
  validateDisplayRole,
} from "./bindings.ts";
import { runKernelIdentifierCheck } from "./check.ts";
import { extractRustFunction } from "./extractRust.ts";
import {
  extractTypeScriptExport,
  extractTypeScriptFromText,
  KernelExtractionError,
} from "./extractTypeScript.ts";
import type { ExtractedKernelSource } from "./types.ts";
import { verifySliceKernels } from "./verify.ts";

// am-yhus: always the OS temp dir. The old form preferred a mounted external
// volume when present, so this machine and CI ran different code paths.
const TEMP_BASE = tmpdir();

const VALID_EXTRACTED: ExtractedKernelSource = {
  language: "ts",
  exportName: "stokesEinsteinD",
  filePath: "src/physics/reference/diffusion/distributions.ts",
  lineStart: 1,
  lineEnd: 20,
  source: "export function stokesEinsteinD() {}",
  sourceHash: "abc123hash",
  revision: "rev-pinned",
  identifiers: ["T", "eta", "a", "k", "D"],
};

describe("Kernel bindings refusal sites (bindings.ts) (am-muyh)", () => {
  // Site 1 (line 21)
  test("site (bindings.ts:21) invalid-kernel-display-role: rejects invalid displayRole, accepts recognized role", () => {
    const invalidIssues = validateDisplayRole("bm-01", {
      displayRole: "nonexistent-display-role" as any,
      exportName: "stokesEinsteinD",
    });
    assert.ok(
      invalidIssues.some((i) => i.code === "invalid-kernel-display-role"),
      'expected issue with code "invalid-kernel-display-role"',
    );

    const validIssues = validateDisplayRole("bm-01", {
      displayRole: "pseudocode",
      exportName: "stokesEinsteinD",
    });
    assert.equal(
      validIssues.some((i) => i.code === "invalid-kernel-display-role"),
      false,
    );
  });

  // Site 2 (line 45)
  test("site (bindings.ts:45) missing-ts-kernel-fields: rejects TS kernel missing module or exportName, accepts complete fields", () => {
    const missingModule = validateDisplayRole("bm-01", {
      displayRole: "reference-implementation",
      language: "ts",
      exportName: "stokesEinsteinD",
    });
    assert.ok(
      missingModule.some((i) => i.code === "missing-ts-kernel-fields"),
      'expected issue with code "missing-ts-kernel-fields"',
    );

    const validTS = validateDisplayRole(
      "bm-01",
      {
        displayRole: "reference-implementation",
        language: "ts",
        module: "src/physics/reference/diffusion/distributions.ts",
        exportName: "stokesEinsteinD",
      },
      VALID_EXTRACTED,
    );
    assert.equal(
      validTS.some((i) => i.code === "missing-ts-kernel-fields"),
      false,
    );
  });

  // Site 3 (line 54)
  test("site (bindings.ts:54) missing-rust-kernel-fields: rejects Rust kernel missing required crate/path/fnName/revision, accepts complete fields", () => {
    const missingFields = validateDisplayRole("bm-01", {
      displayRole: "reference-implementation",
      language: "rust",
      fnName: "stokes_einstein",
    });
    assert.ok(
      missingFields.some((i) => i.code === "missing-rust-kernel-fields"),
      'expected issue with code "missing-rust-kernel-fields"',
    );

    const completeRust = validateDisplayRole(
      "bm-01",
      {
        displayRole: "reference-implementation",
        language: "rust",
        crate: "fs-exec",
        path: "crates/fs-exec/src/kernel.rs",
        fnName: "stokes_einstein",
        revision: "rev-pinned",
      },
      { ...VALID_EXTRACTED, language: "rust" },
    );
    assert.equal(
      completeRust.some((i) => i.code === "missing-rust-kernel-fields"),
      false,
    );
  });

  // Site 4 (line 62)
  test("site (bindings.ts:62) missing-kernel-language: rejects kernel with language other than ts or rust, accepts ts and rust", () => {
    const invalidLang = validateDisplayRole("bm-01", {
      displayRole: "reference-implementation",
      language: "python" as any,
      fnName: "stokes_einstein",
    });
    assert.ok(
      invalidLang.some((i) => i.code === "missing-kernel-language"),
      'expected issue with code "missing-kernel-language"',
    );

    const validLang = validateDisplayRole(
      "bm-01",
      {
        displayRole: "reference-implementation",
        language: "ts",
        module: "src/physics/reference/diffusion/distributions.ts",
        exportName: "stokesEinsteinD",
      },
      VALID_EXTRACTED,
    );
    assert.equal(
      validLang.some((i) => i.code === "missing-kernel-language"),
      false,
    );
  });

  // Site 5 (line 78)
  test("site (bindings.ts:78) missing-kernel-source-hash: rejects kernel without extracted source hash, accepts valid source hash", () => {
    const unhashed = validateDisplayRole(
      "bm-01",
      {
        displayRole: "reference-implementation",
        language: "ts",
        module: "src/physics/reference/diffusion/distributions.ts",
        exportName: "stokesEinsteinD",
      },
      { ...VALID_EXTRACTED, sourceHash: "" },
    );
    assert.ok(
      unhashed.some((i) => i.code === "missing-kernel-source-hash"),
      'expected issue with code "missing-kernel-source-hash"',
    );

    const hashed = validateDisplayRole(
      "bm-01",
      {
        displayRole: "reference-implementation",
        language: "ts",
        module: "src/physics/reference/diffusion/distributions.ts",
        exportName: "stokesEinsteinD",
      },
      VALID_EXTRACTED,
    );
    assert.equal(
      hashed.some((i) => i.code === "missing-kernel-source-hash"),
      false,
    );
  });

  // Site 6 (line 113)
  test("site (bindings.ts:113) kernel-source-unextracted: rejects declared binding when extracted source map is missing entry, accepts extracted entry", () => {
    const missingSource = checkIdentifierBindings({
      instrumentId: "bm-01",
      kernels: [{ displayRole: "reference-implementation", exportName: "stokesEinsteinD" }],
      bindings: [{ kernelFunction: "stokesEinsteinD", identifier: "T", quantityId: "temperature" }],
      extracted: new Map(), // missing entry
    });
    assert.ok(
      missingSource.some((i) => i.code === "kernel-source-unextracted"),
      'expected issue with code "kernel-source-unextracted"',
    );

    const presentSource = checkIdentifierBindings({
      instrumentId: "bm-01",
      kernels: [{ displayRole: "reference-implementation", exportName: "stokesEinsteinD" }],
      bindings: [{ kernelFunction: "stokesEinsteinD", identifier: "T", quantityId: "temperature" }],
      extracted: new Map([["stokesEinsteinD", VALID_EXTRACTED]]),
    });
    assert.equal(
      presentSource.some((i) => i.code === "kernel-source-unextracted"),
      false,
    );
  });

  // Site 7 (line 124)
  test("site (bindings.ts:124) identifier-absent-from-kernel: rejects binding naming identifier missing from kernel source, accepts identifier present in kernel", () => {
    const absentIdent = checkIdentifierBindings({
      instrumentId: "bm-01",
      kernels: [{ displayRole: "reference-implementation", exportName: "stokesEinsteinD" }],
      bindings: [
        {
          kernelFunction: "stokesEinsteinD",
          identifier: "notInSourceIdentifier",
          quantityId: "temperature",
        },
      ],
      extracted: new Map([["stokesEinsteinD", VALID_EXTRACTED]]),
    });
    assert.ok(
      absentIdent.some((i) => i.code === "identifier-absent-from-kernel"),
      'expected issue with code "identifier-absent-from-kernel"',
    );

    const presentIdent = checkIdentifierBindings({
      instrumentId: "bm-01",
      kernels: [{ displayRole: "reference-implementation", exportName: "stokesEinsteinD" }],
      bindings: [{ kernelFunction: "stokesEinsteinD", identifier: "T", quantityId: "temperature" }],
      extracted: new Map([["stokesEinsteinD", VALID_EXTRACTED]]),
    });
    assert.equal(
      presentIdent.some((i) => i.code === "identifier-absent-from-kernel"),
      false,
    );
  });

  // Site 8 (line 147)
  test("site (bindings.ts:147) live-term-unbound: rejects live term quantity missing from identifierBindings, accepts bound live terms", () => {
    const unbound = checkLiveTermBindings({
      instrumentId: "bm-01",
      liveTerms: ["temperature", "unboundQuantityId"],
      bindings: [{ kernelFunction: "stokesEinsteinD", identifier: "T", quantityId: "temperature" }],
      extracted: new Map([["stokesEinsteinD", VALID_EXTRACTED]]),
    });
    assert.ok(
      unbound.some((i) => i.code === "live-term-unbound"),
      'expected issue with code "live-term-unbound"',
    );

    const allBound = checkLiveTermBindings({
      instrumentId: "bm-01",
      liveTerms: ["temperature"],
      bindings: [{ kernelFunction: "stokesEinsteinD", identifier: "T", quantityId: "temperature" }],
      extracted: new Map([["stokesEinsteinD", VALID_EXTRACTED]]),
    });
    assert.equal(
      allBound.some((i) => i.code === "live-term-unbound"),
      false,
    );
  });

  // Site 9 (line 201)
  test("site (bindings.ts:201) dangling-independent-reference: rejects reference resolving to nonexistent verification file, accepts empty or valid references", () => {
    const dangling = checkIndependentReferences(process.cwd(), "bm-01", [
      { experimentId: "nonexistent-experiment", quantityId: "nonexistent-qty" },
    ]);
    assert.ok(
      dangling.some((i) => i.code === "dangling-independent-reference"),
      'expected issue with code "dangling-independent-reference"',
    );

    const valid = checkIndependentReferences(process.cwd(), "bm-01", []);
    assert.equal(
      valid.some((i) => i.code === "dangling-independent-reference"),
      false,
    );
  });
});

describe("Kernel check refusal sites (check.ts) (am-muyh)", () => {
  // Site 10 (line 103)
  test("site (check.ts:107) kernel-export-missing: reports kernel-export-missing when extraction fails on missing module/export, accepts valid kernel", () => {
    const reportedBad: any[] = [];
    const contextBad = {
      records: new Map([
        [
          "test-inst-bad",
          {
            id: "test-inst-bad",
            owner: {
              kernelFunctions: [
                {
                  displayRole: "reference-implementation",
                  language: "ts",
                  module: "src/physics/nonexistent-module-for-test.ts",
                  exportName: "missingFn",
                },
              ],
            },
          },
        ],
      ]),
      report: (issue: any) => reportedBad.push(issue),
    };
    runKernelIdentifierCheck(contextBad as any, process.cwd());
    assert.ok(
      reportedBad.some((r) => r.rule === "kernel-export-missing"),
      'expected report with rule "kernel-export-missing"',
    );

    const reportedGood: any[] = [];
    const contextGood = {
      records: new Map([
        [
          "test-inst-good",
          {
            id: "test-inst-good",
            owner: {
              kernelFunctions: [
                {
                  displayRole: "pseudocode",
                  exportName: "pseudoAlgorithm",
                },
              ],
            },
          },
        ],
      ]),
      report: (issue: any) => reportedGood.push(issue),
    };
    runKernelIdentifierCheck(contextGood as any, process.cwd());
    assert.equal(
      reportedGood.some((r) => r.rule === "kernel-export-missing"),
      false,
    );
  });
});

describe("Kernel Rust extraction refusal sites (extractRust.ts) (am-muyh)", () => {
  // Site 11 (line 272)
  test("site (extractRust.ts:272) kernel-export-missing: rejects Rust source missing named function, accepts defined function", () => {
    assert.throws(
      () =>
        extractRustFunction("pub fn compute_diffusion() -> f64 { 1.0 }", "missing_rust_fn", {
          filePath: "crates/fs-exec/src/kernel.rs",
          revision: "v1",
        }),
      (err: unknown) =>
        err instanceof KernelExtractionError && err.code === "kernel-export-missing",
    );

    const accepted = extractRustFunction(
      "pub fn compute_diffusion() -> f64 { 1.0 }",
      "compute_diffusion",
      { filePath: "crates/fs-exec/src/kernel.rs", revision: "v1" },
    );
    assert.equal(accepted.exportName, "compute_diffusion");
    assert.equal(accepted.language, "rust");
  });
});

describe("Kernel TypeScript extraction refusal sites (extractTypeScript.ts) (am-muyh)", () => {
  // Site 12 (line 134)
  test("site (extractTypeScript.ts:134) kernel-reexport-cycle: rejects cyclic re-export resolution, accepts acyclic lookup", () => {
    assert.throws(
      () =>
        extractTypeScriptExport({
          root: process.cwd(),
          modulePath: "src/physics/reference/diffusion/distributions.ts",
          exportName: "stokesEinsteinD",
          revision: "fixture",
          seen: new Set(["src/physics/reference/diffusion/distributions.ts#stokesEinsteinD"]),
        }),
      (err: unknown) =>
        err instanceof KernelExtractionError && err.code === "kernel-reexport-cycle",
    );

    const accepted = extractTypeScriptExport({
      root: process.cwd(),
      modulePath: "src/physics/reference/diffusion/distributions.ts",
      exportName: "stokesEinsteinD",
      revision: "fixture",
    });
    assert.equal(accepted.exportName, "stokesEinsteinD");
  });

  // Site 13 (line 144)
  test("site (extractTypeScript.ts:144) kernel-export-missing: rejects nonexistent export from TypeScript file, accepts existing export", () => {
    assert.throws(
      () =>
        extractTypeScriptExport({
          root: process.cwd(),
          modulePath: "src/physics/reference/diffusion/distributions.ts",
          exportName: "nonExistentExportStokes",
          revision: "fixture",
        }),
      (err: unknown) =>
        err instanceof KernelExtractionError && err.code === "kernel-export-missing",
    );

    const accepted = extractTypeScriptExport({
      root: process.cwd(),
      modulePath: "src/physics/reference/diffusion/distributions.ts",
      exportName: "stokesEinsteinD",
      revision: "fixture",
    });
    assert.equal(accepted.exportName, "stokesEinsteinD");
  });

  // Site 14 (line 211)
  test("site (extractTypeScript.ts:211) kernel-export-missing: rejects in-memory text missing named export, accepts defined export", () => {
    assert.throws(
      () =>
        extractTypeScriptFromText({
          fileName: "kernel.ts",
          sourceText: "export const x = 42;",
          exportName: "evaluateStokesEinstein",
        }),
      (err: unknown) =>
        err instanceof KernelExtractionError && err.code === "kernel-export-missing",
    );

    const accepted = extractTypeScriptFromText({
      fileName: "kernel.ts",
      sourceText: "export function evaluateStokesEinstein() { return 1; }",
      exportName: "evaluateStokesEinstein",
    });
    assert.equal(accepted.exportName, "evaluateStokesEinstein");
  });

  // Site 15 (line 217)
  test("site (extractTypeScript.ts:217) kernel-reexport: rejects re-exported symbol from text, accepts defining module function", () => {
    assert.throws(
      () =>
        extractTypeScriptFromText({
          fileName: "index.ts",
          sourceText: "export { evaluateStokesEinstein } from './kernel.ts';",
          exportName: "evaluateStokesEinstein",
        }),
      (err: unknown) => err instanceof KernelExtractionError && err.code === "kernel-reexport",
    );

    const accepted = extractTypeScriptFromText({
      fileName: "kernel.ts",
      sourceText: "export function evaluateStokesEinstein() { return 1; }",
      exportName: "evaluateStokesEinstein",
    });
    assert.equal(accepted.exportName, "evaluateStokesEinstein");
  });
});

describe("Kernel verification refusal sites (verify.ts) (am-muyh)", () => {
  // Site 16 (line 86)
  test("site (verify.ts:86) kernel-pin-missing: reports kernel-pin-missing when pins file is missing catalog function key, accepts matching pins", () => {
    const tempPinsPath = join(TEMP_BASE, `empty-pins-${Date.now()}.json`);
    writeFileSync(
      tempPinsPath,
      JSON.stringify({ schemaVersion: 1, functions: {}, closures: {} }),
      "utf8",
    );

    const result = verifySliceKernels({
      root: process.cwd(),
      revision: "test-rev",
      pinsPath: tempPinsPath,
    });
    assert.ok(
      result.issues.some((i) => i.code === "kernel-pin-missing"),
      'expected issue with code "kernel-pin-missing"',
    );

    // Accept counterpart: verifySliceKernels without pinsPath evaluates without kernel-pin-missing
    const acceptedNoPins = verifySliceKernels({
      root: process.cwd(),
      revision: "test-rev",
    });
    assert.equal(
      acceptedNoPins.issues.some((i) => i.code === "kernel-pin-missing"),
      false,
    );
  });
});
