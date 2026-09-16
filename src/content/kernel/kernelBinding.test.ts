import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getLogger } from "../../testing/log/logger.ts";
import { clearRegisteredChecksForTests, runAllChecks } from "../compiler/checks/registry.ts";
import { checkIdentifierBindings, checkLiveTermBindings } from "./bindings.ts";
import { registerKernelBindingCheck } from "./check.ts";
import { extractTypeScriptExport } from "./extractTypeScript.ts";
import type { ExtractedKernelSource } from "./types.ts";
import { KERNEL_BEAD_ID, KERNEL_BINDING_CHECK_ID } from "./types.ts";
import { verifySliceKernels } from "./verify.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const logger = getLogger("show-the-code");

function extractedMap(): Map<string, ExtractedKernelSource> {
  const src = extractTypeScriptExport({
    root,
    modulePath: "src/content/kernel/__fixtures__/ts/target.ts",
    exportName: "evaluateStokesEinstein",
    revision: "fixture",
  });
  return new Map([["evaluateStokesEinstein", src]]);
}

describe("kernel identifier bindings", () => {
  test("a planted missing identifier fails naming the instrument and quantity id", () => {
    const extracted = extractedMap();
    const issues = checkLiveTermBindings({
      instrumentId: "bm-01",
      liveTerms: ["diffusionCoefficient"],
      bindings: [
        {
          kernelFunction: "evaluateStokesEinstein",
          identifier: "notARealIdent",
          quantityId: "diffusionCoefficient",
        },
      ],
      extracted,
    });
    expect(issues.some((i) => i.code === "live-term-identifier-missing")).toBe(true);
    expect(issues[0]?.instrumentId).toBe("bm-01");
    expect(issues[0]?.quantityId).toBe("diffusionCoefficient");
    logger.log({
      testId: "planted-missing-identifier",
      beadId: KERNEL_BEAD_ID,
      instrumentId: "bm-01",
      outcome: "passed",
      message: "Planted missing identifier failed with instrument and quantity id",
      extra: { missingBindings: issues.map((i) => i.quantityId) },
    });
  });

  test("a binding whose kernelFunction names no declared entry fails", () => {
    const issues = checkIdentifierBindings({
      instrumentId: "bm-01",
      kernels: [
        {
          displayRole: "reference-implementation",
          language: "ts",
          module: "src/content/kernel/__fixtures__/ts/target.ts",
          exportName: "evaluateStokesEinstein",
        },
      ],
      bindings: [
        {
          kernelFunction: "missingFn",
          identifier: "D",
          quantityId: "diffusionCoefficient",
        },
      ],
      extracted: extractedMap(),
    });
    expect(issues.some((i) => i.code === "undeclared-kernel-function")).toBe(true);
    logger.log({
      testId: "undeclared-kernel-function",
      beadId: KERNEL_BEAD_ID,
      instrumentId: "bm-01",
      outcome: "passed",
      message: "Undeclared kernelFunction failed",
    });
  });

  test("correct fixture bindings pass", () => {
    const issues = checkIdentifierBindings({
      instrumentId: "bm-01",
      kernels: [
        {
          displayRole: "reference-implementation",
          language: "ts",
          module: "src/content/kernel/__fixtures__/ts/target.ts",
          exportName: "evaluateStokesEinstein",
        },
      ],
      bindings: [
        {
          kernelFunction: "evaluateStokesEinstein",
          identifier: "D",
          quantityId: "diffusionCoefficient",
        },
        {
          kernelFunction: "evaluateStokesEinstein",
          identifier: "eta",
          quantityId: "viscosity",
        },
      ],
      extracted: extractedMap(),
    });
    expect(issues).toEqual([]);
    logger.log({
      testId: "correct-bindings",
      beadId: KERNEL_BEAD_ID,
      instrumentId: "bm-01",
      outcome: "passed",
      message: "Correct bindings passed",
      extra: { bindingCount: 2 },
    });
  });

  test("BM-01, BM-05, and BM-06 real kernels pass the live-term binding check", () => {
    const result = verifySliceKernels({ root, revision: "workspace" });
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    const instruments = new Set(result.records.map((r) => r.instrumentId));
    expect(instruments.has("bm-01")).toBe(true);
    expect(instruments.has("bm-05")).toBe(true);
    expect(instruments.has("bm-06")).toBe(true);
    logger.log({
      testId: "slice-manifests-pass",
      beadId: KERNEL_BEAD_ID,
      outcome: "passed",
      message: "Slice kernel catalogs pass identifier bindings",
      extra: {
        bindingCount: result.records.length,
        functions: result.records.map((r) => r.exportName),
      },
    });
  });
});

describe("compiler plugin kernel-identifier-binding", () => {
  beforeEach(() => {
    clearRegisteredChecksForTests();
    registerKernelBindingCheck();
  });
  afterEach(() => {
    clearRegisteredChecksForTests();
  });

  test("registers the rejection and plants a missing live-term identifier", async () => {
    const kernel = extractTypeScriptExport({
      root,
      modulePath: "src/content/kernel/__fixtures__/ts/target.ts",
      exportName: "evaluateStokesEinstein",
      revision: "fixture",
    });
    const result = await runAllChecks({
      records: new Map([
        [
          "bm-01",
          {
            id: "bm-01",
            argumentIds: ["arg-bm-diffusivity"],
            owner: {
              kind: "reference-evaluator",
              kernelFunctions: [
                {
                  displayRole: "reference-implementation",
                  language: "ts",
                  module: "src/content/kernel/__fixtures__/ts/target.ts",
                  exportName: "evaluateStokesEinstein",
                  revision: "fixture",
                },
              ],
              identifierBindings: [
                {
                  kernelFunction: "evaluateStokesEinstein",
                  identifier: "nope",
                  quantityId: "diffusionCoefficient",
                },
              ],
            },
          },
        ],
        [
          "eq-model-bm-diffusivity",
          {
            kind: "equation",
            id: "eq-model-bm-diffusivity",
            argument: "arg-bm-diffusivity",
            tree: {
              kind: "symbol",
              termId: "eq-model-bm-diffusivity.t.diffusion",
              quantityId: "diffusionCoefficient",
            },
          },
        ],
      ]),
      files: [],
      indexes: null,
    });
    expect(result.passed).toBe(false);
    const hit = result.diagnostics.find((d) => d.checkId === KERNEL_BINDING_CHECK_ID);
    expect(hit).toBeDefined();
    expect(hit?.message).toContain("bm-01");
    expect(hit?.message).toContain("diffusionCoefficient");
    expect(kernel.identifiers.includes("nope")).toBe(false);
    logger.log({
      testId: "compiler-check-planted-red",
      beadId: KERNEL_BEAD_ID,
      instrumentId: "bm-01",
      outcome: "passed",
      message: "Compiler plugin rejected a planted missing identifier",
    });
  });
});
