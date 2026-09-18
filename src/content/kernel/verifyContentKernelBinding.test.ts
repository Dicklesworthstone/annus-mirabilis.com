import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadReadingFiles } from "../../../scripts/build-content.ts";
import { clearRegisteredChecksForTests } from "../compiler/checks/registry.ts";
import { compileContent } from "../compiler/compile.ts";
import { auditKernelBindings } from "./audit.ts";
import { registerKernelBindingCheck } from "./check.ts";
import { KERNEL_BINDING_CHECK_ID } from "./types.ts";
import { checkCleanCommittedSource, type KernelPinFile, loadPins } from "./verify.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("verify-content kernel binding audit (am-inst-show-the-code-4brv)", () => {
  beforeEach(() => {
    clearRegisteredChecksForTests();
    registerKernelBindingCheck();
  });

  afterEach(() => {
    clearRegisteredChecksForTests();
  });

  test("auditKernelBindings passes cleanly on live repository slice kernels", () => {
    const report = auditKernelBindings(root);
    expect(report.ok).toBe(true);
    expect(report.errorCount).toBe(0);
    expect(report.findings).toEqual([]);
  });

  test("live slice manifests pass kernel-identifier-binding compiler check", async () => {
    const readingFiles = await loadReadingFiles(root);
    const experimentFiles = ["bm-01", "bm-05", "bm-06"].map((id) => ({
      path: `experiments/${id}.yaml`,
      text: readFileSync(resolve(root, `content/experiments/${id}.yaml`), "utf8"),
    }));

    const result = await compileContent([...readingFiles, ...experimentFiles]);
    const kernelErrors = result.diagnostics.filter(
      (d) => d.checkId === KERNEL_BINDING_CHECK_ID && d.severity === "error",
    );
    expect(kernelErrors).toEqual([]);
  });

  test("planted undeclared kernelFunction fails with undeclared-kernel-function", async () => {
    const bm01Raw = readFileSync(resolve(root, "content/experiments/bm-01.yaml"), "utf8");
    const plantedText = bm01Raw.replace(
      '    - kernelFunction: stokesEinsteinD\n      identifier: "T"',
      '    - kernelFunction: nonExistentKernelExport\n      identifier: "D"\n      quantityId: diffusionCoefficient\n    - kernelFunction: stokesEinsteinD\n      identifier: "T"',
    );

    const readingFiles = await loadReadingFiles(root);
    const result = await compileContent([
      ...readingFiles,
      { path: "experiments/bm-01.yaml", text: plantedText },
    ]);

    const kernelErrors = result.diagnostics.filter(
      (d) => d.checkId === KERNEL_BINDING_CHECK_ID && d.rule === "undeclared-kernel-function",
    );
    expect(kernelErrors.length).toBe(1);
    expect(kernelErrors[0]?.message).toContain("nonExistentKernelExport");
    expect(kernelErrors[0]?.message).toContain("bm-01");
  });

  test("planted absent identifier fails with identifier-absent-from-kernel", async () => {
    const bm01Raw = readFileSync(resolve(root, "content/experiments/bm-01.yaml"), "utf8");
    const plantedText = bm01Raw.replace(
      '    - kernelFunction: stokesEinsteinD\n      identifier: "T"',
      '    - kernelFunction: stokesEinsteinD\n      identifier: "absentIdentifierXYZ"',
    );

    const readingFiles = await loadReadingFiles(root);
    const result = await compileContent([
      ...readingFiles,
      { path: "experiments/bm-01.yaml", text: plantedText },
    ]);

    const kernelErrors = result.diagnostics.filter(
      (d) => d.checkId === KERNEL_BINDING_CHECK_ID && d.rule === "identifier-absent-from-kernel",
    );
    expect(kernelErrors.length).toBe(1);
    expect(kernelErrors[0]?.message).toContain("absentIdentifierXYZ");
    expect(kernelErrors[0]?.message).toContain("stokesEinsteinD");
  });

  test("planted missing live-term binding fails with live-term-unbound", async () => {
    const bm01Raw = readFileSync(resolve(root, "content/experiments/bm-01.yaml"), "utf8");
    // Remove all diffusionCoefficient bindings (from rmsDisplacement and apparentSpeed)
    const plantedText = bm01Raw
      .replace('    - kernelFunction: rmsDisplacement\n      identifier: "D"\n      quantityId: diffusionCoefficient\n', "")
      .replace('    - kernelFunction: apparentSpeed\n      identifier: "D"\n      quantityId: diffusionCoefficient\n', "");

    const readingFiles = await loadReadingFiles(root);
    const result = await compileContent([
      ...readingFiles,
      { path: "experiments/bm-01.yaml", text: plantedText },
    ]);

    const kernelErrors = result.diagnostics.filter(
      (d) => d.checkId === KERNEL_BINDING_CHECK_ID && d.rule === "live-term-unbound",
    );
    expect(kernelErrors.length).toBeGreaterThanOrEqual(1);
    expect(kernelErrors.some((e) => e.message.includes("diffusionCoefficient"))).toBe(true);
    expect(kernelErrors[0]?.recordId).toBe("bm-01");
  });

  test("planted dangling independent reference fails with dangling-independent-reference", async () => {
    const bm01Raw = readFileSync(resolve(root, "content/experiments/bm-01.yaml"), "utf8");
    const plantedText = bm01Raw.replace(
      "      exportName: \"stokesEinsteinD\"\n      independentReferences: []",
      "      exportName: \"stokesEinsteinD\"\n      independentReferences:\n        - experimentId: bm-01\n          quantityId: nonExistentVerificationRecord",
    );

    const readingFiles = await loadReadingFiles(root);
    const result = await compileContent([
      ...readingFiles,
      { path: "experiments/bm-01.yaml", text: plantedText },
    ]);

    const kernelErrors = result.diagnostics.filter(
      (d) => d.checkId === KERNEL_BINDING_CHECK_ID && d.rule === "dangling-independent-reference",
    );
    expect(kernelErrors.length).toBe(1);
    expect(kernelErrors[0]?.message).toContain("nonExistentVerificationRecord");
  });

  test("planted mismatched kernel source hash fails audit with kernel-hash-drift", () => {
    const livePins = loadPins(resolve(root, "src/content/kernel/pins.json"));
    const modifiedPins: KernelPinFile = {
      schemaVersion: 1,
      functions: {
        ...livePins.functions,
        "stokesEinsteinD@src/physics/reference/diffusion/distributions.ts":
          "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      },
      closures: livePins.closures,
    };

    const report = auditKernelBindings(root, "workspace", { pins: modifiedPins, checkCommitted: false });
    expect(report.ok).toBe(false);
    expect(report.findings.some((f) => f.check === "kernel-hash-drift")).toBe(true);
    const drift = report.findings.find((f) => f.check === "kernel-hash-drift");
    expect(drift?.message).toContain("stokesEinsteinD");
    expect(drift?.message).toContain("drifted");
  });

  test("planted missing kernel pin fails audit with kernel-pin-missing", () => {
    const livePins = loadPins(resolve(root, "src/content/kernel/pins.json"));
    const { "stokesEinsteinD@src/physics/reference/diffusion/distributions.ts": _, ...otherFunctions } =
      livePins.functions;
    const modifiedPins: KernelPinFile = {
      schemaVersion: 1,
      functions: otherFunctions,
      closures: livePins.closures,
    };

    const report = auditKernelBindings(root, "workspace", { pins: modifiedPins, checkCommitted: false });
    expect(report.ok).toBe(false);
    expect(report.findings.some((f) => f.check === "kernel-pin-missing")).toBe(true);
    const missing = report.findings.find((f) => f.check === "kernel-pin-missing");
    expect(missing?.message).toContain("no pinned hash");
  });

  test("pin written against uncommitted source (differing from git HEAD) fails audit with uncommitted-pinned-source", () => {
    const livePins = loadPins(resolve(root, "src/content/kernel/pins.json"));
    // Planted pin differing from committed HEAD source
    const modifiedPins: KernelPinFile = {
      schemaVersion: 1,
      functions: {
        ...livePins.functions,
        "stokesEinsteinD@src/physics/reference/diffusion/distributions.ts":
          "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      },
      closures: livePins.closures,
    };

    const headText = readFileSync(
      resolve(root, "src/physics/reference/diffusion/distributions.ts"),
      "utf8",
    );
    const mockGitRunner = (args: readonly string[]): string => {
      if (args[0] === "show") return headText;
      if (args[0] === "status") return "";
      return "";
    };

    const report = auditKernelBindings(root, "workspace", {
      pins: modifiedPins,
      checkCommitted: true,
      gitRunner: mockGitRunner,
    });
    expect(report.ok).toBe(false);
    expect(report.findings.some((f) => f.check === "uncommitted-pinned-source")).toBe(true);
    const uncommitted = report.findings.find((f) => f.check === "uncommitted-pinned-source");
    expect(uncommitted?.message).toContain("does not match committed source in git HEAD");
  });

  test("uncommitted working-tree modifications in pinned kernel file fails audit with uncommitted-pinned-source", () => {
    const livePins = loadPins(resolve(root, "src/content/kernel/pins.json"));
    const headText = readFileSync(
      resolve(root, "src/physics/reference/diffusion/distributions.ts"),
      "utf8",
    );
    const mockGitRunner = (args: readonly string[]): string => {
      if (args[0] === "status") {
        return " M src/physics/reference/diffusion/distributions.ts\n";
      }
      if (args[0] === "show") return headText;
      return "";
    };

    const report = auditKernelBindings(root, "workspace", {
      pins: livePins,
      checkCommitted: true,
      gitRunner: mockGitRunner,
    });
    expect(report.ok).toBe(false);
    expect(report.findings.some((f) => f.check === "uncommitted-pinned-source")).toBe(true);
    const uncommitted = report.findings.find((f) => f.check === "uncommitted-pinned-source");
    expect(uncommitted?.message).toContain("has uncommitted changes in git HEAD");
  });

  test("checkCleanCommittedSource identifies clean files and reports dirty files", () => {
    const dirty = checkCleanCommittedSource(
      root,
      ["src/physics/reference/diffusion/distributions.ts"],
      (_args) => " M src/physics/reference/diffusion/distributions.ts\n",
    );
    expect(dirty).toEqual(["src/physics/reference/diffusion/distributions.ts"]);

    const clean = checkCleanCommittedSource(
      root,
      ["src/physics/reference/diffusion/distributions.ts"],
      (_args) => "",
    );
    expect(clean).toEqual([]);
  });
});
