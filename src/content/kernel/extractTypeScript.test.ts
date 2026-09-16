import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getLogger } from "../../testing/log/logger.ts";
import { extractTypeScriptExport } from "./extractTypeScript.ts";
import { hashKernelSource } from "./sourceDigest.ts";
import { KERNEL_BEAD_ID } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const logger = getLogger("show-the-code");

function log(testId: string, extra: Record<string, unknown>) {
  logger.log({
    testId,
    beadId: KERNEL_BEAD_ID,
    outcome: "passed",
    message: testId,
    extra,
  });
}

describe("extractTypeScriptExport", () => {
  test("emits exact source including JSDoc and is hash-stable across two runs", () => {
    const first = extractTypeScriptExport({
      root,
      modulePath: "src/content/kernel/__fixtures__/ts/target.ts",
      exportName: "evaluateStokesEinstein",
      revision: "fixture",
    });
    const second = extractTypeScriptExport({
      root,
      modulePath: "src/content/kernel/__fixtures__/ts/target.ts",
      exportName: "evaluateStokesEinstein",
      revision: "fixture",
    });
    expect(first.source).toContain("SI: temperature K");
    expect(first.source).toContain("export function evaluateStokesEinstein");
    expect(first.source).toContain("const D =");
    expect(first.identifiers).toContain("D");
    expect(first.identifiers).toContain("eta");
    expect(first.sourceHash).toBe(second.sourceHash);
    expect(first.sourceHash).toBe(hashKernelSource(first.source));
    log("extract-ts-jsdoc-hash-stable", {
      sourceHash: first.sourceHash,
      function: first.exportName,
    });
  });

  test("follows a named re-export to the owner function", () => {
    const fromBarrel = extractTypeScriptExport({
      root,
      modulePath: "src/content/kernel/__fixtures__/ts/reexport.ts",
      exportName: "evaluateStokesEinstein",
      revision: "fixture",
    });
    const fromOwner = extractTypeScriptExport({
      root,
      modulePath: "src/content/kernel/__fixtures__/ts/target.ts",
      exportName: "evaluateStokesEinstein",
      revision: "fixture",
    });
    expect(fromBarrel.filePath).toBe("src/content/kernel/__fixtures__/ts/target.ts");
    expect(fromBarrel.source).toBe(fromOwner.source);
    expect(fromBarrel.sourceHash).toBe(fromOwner.sourceHash);
    log("extract-ts-reexport", { filePath: fromBarrel.filePath });
  });

  test("keeps overload signatures with the implementation", () => {
    const extracted = extractTypeScriptExport({
      root,
      modulePath: "src/content/kernel/__fixtures__/ts/overloads.ts",
      exportName: "parseKernel",
      revision: "fixture",
    });
    expect(extracted.source).toContain("export function parseKernel(x: string): number;");
    expect(extracted.source).toContain("export function parseKernel(x: number): string;");
    expect(extracted.source).toContain("x: string | number");
    log("extract-ts-overloads", { lineStart: extracted.lineStart, lineEnd: extracted.lineEnd });
  });

  test("normalizes CRLF so the hash matches LF", () => {
    const lf = extractTypeScriptExport({
      root,
      modulePath: "src/content/kernel/__fixtures__/ts/target.ts",
      exportName: "evaluateStokesEinstein",
      revision: "fixture",
    });
    const dir = mkdtempSync(join(tmpdir(), "kernel-crlf-"));
    writeFileSync(join(dir, "crlf.ts"), lf.source.replace(/\n/g, "\r\n"));
    const crlf = extractTypeScriptExport({
      root: dir,
      modulePath: "crlf.ts",
      exportName: "evaluateStokesEinstein",
      revision: "fixture",
    });
    expect(crlf.sourceHash).toBe(lf.sourceHash);
    log("extract-ts-crlf", { sourceHash: crlf.sourceHash });
  });
});
