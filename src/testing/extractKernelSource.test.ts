import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertPinnedHash,
  extractFromRepoFile,
  extractFunctionSource,
  KernelExtractionError,
  sha256Hex,
} from "../../scripts/extract-kernel-source.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");
const FIXTURE_DIR = path.join(HERE, "fixtures/kernelSource");

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8");
}

describe("extractFunctionSource: real AST extraction, never a regex slice", () => {
  test("extracts a plain exported function, JSDoc included", () => {
    const source = readFixture("simpleFunction.fixture.ts");
    const extracted = extractFunctionSource(
      "fixtures/kernelSource/simpleFunction.fixture.ts",
      source,
      "publicDoubler",
    );
    expect(extracted.source).toContain("Doubles `x` using the private helper.");
    expect(extracted.source).toContain("export function publicDoubler(x: number): number {");
    expect(extracted.source).toContain("return privateHelper(x);");
    expect(extracted.source).not.toContain("function privateHelper");
    expect(extracted.exportName).toBe("publicDoubler");
    expect(extracted.lineStart).toBeLessThan(extracted.lineEnd);
  });

  test("never pulls in a sibling declaration's text", () => {
    const source = readFixture("simpleFunction.fixture.ts");
    const extracted = extractFunctionSource(
      "fixtures/kernelSource/simpleFunction.fixture.ts",
      source,
      "publicDoubler",
    );
    expect(extracted.source).not.toContain("arrowDoubler");
  });

  test("extracts an arrow-function export const", () => {
    const source = readFixture("simpleFunction.fixture.ts");
    const extracted = extractFunctionSource(
      "fixtures/kernelSource/simpleFunction.fixture.ts",
      source,
      "arrowDoubler",
    );
    expect(extracted.source).toContain("export const arrowDoubler = (x: number): number => x * 2;");
  });

  test("overloaded names: the implementation is extracted, never a bodyless overload signature", () => {
    const source = readFixture("overloaded.fixture.ts");
    const extracted = extractFunctionSource(
      "fixtures/kernelSource/overloaded.fixture.ts",
      source,
      "format",
    );
    expect(extracted.source).toContain("value: number | string");
    expect(extracted.source).toContain("return typeof value");
    // The two bodyless overload signature lines must not be duplicated into the result.
    const occurrences = extracted.source.split("export function format").length - 1;
    expect(occurrences).toBe(1);
  });

  test("re-exports: a specific error names the defining module, not a generic not-found", () => {
    const source = readFixture("reExportBarrel.fixture.ts");
    expect(() =>
      extractFunctionSource(
        "fixtures/kernelSource/reExportBarrel.fixture.ts",
        source,
        "definedHere",
      ),
    ).toThrow(/re-exported.*point kernel extraction at its defining module/s);
  });

  test("an undeclared export name fails with a clear message naming the module", () => {
    const source = readFixture("simpleFunction.fixture.ts");
    expect(() =>
      extractFunctionSource(
        "fixtures/kernelSource/simpleFunction.fixture.ts",
        source,
        "doesNotExist",
      ),
    ).toThrow(KernelExtractionError);
  });

  test("CRLF line endings normalize before hashing: LF and CRLF sources of the same text hash identically", () => {
    const lf = "export function f(x: number): number {\n  return x;\n}\n";
    const crlf = lf.replace(/\n/g, "\r\n");
    expect(sha256Hex(lf)).toBe(sha256Hex(crlf));
    const extractedLf = extractFunctionSource("fixture.ts", lf, "f");
    const extractedCrlf = extractFunctionSource("fixture.ts", crlf, "f");
    expect(extractedLf.sourceHash).toBe(extractedCrlf.sourceHash);
  });

  test("hash stability: extracting the same function twice produces byte-identical hashes", () => {
    const source = readFixture("simpleFunction.fixture.ts");
    const first = extractFunctionSource(
      "fixtures/kernelSource/simpleFunction.fixture.ts",
      source,
      "publicDoubler",
    );
    const second = extractFunctionSource(
      "fixtures/kernelSource/simpleFunction.fixture.ts",
      source,
      "publicDoubler",
    );
    expect(first.sourceHash).toBe(second.sourceHash);
    expect(first.source).toBe(second.source);
  });
});

describe("extractFromRepoFile: the repository-boundary guard", () => {
  test("extracts a real function from a real repository file", () => {
    const extracted = extractFromRepoFile(
      REPO_ROOT,
      "src/testing/fixtures/kernelSource/simpleFunction.fixture.ts",
      "publicDoubler",
    );
    expect(extracted.module).toBe("src/testing/fixtures/kernelSource/simpleFunction.fixture.ts");
    expect(extracted.source).toContain("publicDoubler");
  });

  test("refuses a module path that resolves outside the repository root", () => {
    expect(() => extractFromRepoFile(REPO_ROOT, "../outside.ts", "f")).toThrow(
      /escapes the repository root/,
    );
  });
});

describe("assertPinnedHash: the drift check", () => {
  test("passes when the extracted hash matches the pin", () => {
    const source = readFixture("simpleFunction.fixture.ts");
    const extracted = extractFunctionSource(
      "fixtures/kernelSource/simpleFunction.fixture.ts",
      source,
      "publicDoubler",
    );
    expect(() => assertPinnedHash("bm-fixture", extracted, extracted.sourceHash)).not.toThrow();
  });

  test("a drifted source fails, naming the instrument, the function, and both hashes", () => {
    const source = readFixture("simpleFunction.fixture.ts");
    const extracted = extractFunctionSource(
      "fixtures/kernelSource/simpleFunction.fixture.ts",
      source,
      "publicDoubler",
    );
    const stalePin = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    let message = "";
    try {
      assertPinnedHash("bm-fixture", extracted, stalePin);
      throw new Error("expected a throw");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("bm-fixture");
    expect(message).toContain("publicDoubler");
    expect(message).toContain(stalePin);
    expect(message).toContain(extracted.sourceHash);
  });
});
