import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripTypesViolations, typeScriptFilesUnder } from "./stripTypesCompatible.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

describe("the detector reaches its predicate in both directions", () => {
  test("each refused construct is found, and named", () => {
    const planted = [
      "class A { constructor(readonly code: string) {} }",
      "class B { constructor(private x: number, public y = 0) {} }",
      "enum Colour { Red }",
      "namespace Inner { export const x = 1; }",
    ].join("\n");
    const found = stripTypesViolations("planted.ts", planted);
    expect(found.map((v) => `${v.construct}@${v.line}`)).toEqual([
      "parameter-property@1",
      "parameter-property@2",
      "parameter-property@2",
      "enum@3",
      "namespace@4",
    ]);
  });

  test("what strip-types accepts is not reported", () => {
    // The shapes this repository uses in their place, plus the ambient forms strip-types keeps.
    const accepted = [
      "class A { readonly code: string; constructor(code: string) { this.code = code; } }",
      "class B { constructor(x: number, y = 0) { void x; void y; } }",
      'type Colour = "red";',
      "declare enum Ambient { A }",
      "declare namespace AmbientNs { const x: number; }",
      "declare global { interface Window { amFlag?: boolean } }",
      'declare module "virtual:thing" { const v: string; export default v; }',
    ].join("\n");
    expect(stripTypesViolations("accepted.ts", accepted)).toEqual([]);
  });
});

describe("no tracked TypeScript under src or scripts needs code generated for it", () => {
  const files = typeScriptFilesUnder(ROOT, ["src", "scripts"]);

  test("the population is the repository's, not an empty list", () => {
    // Measured 2026-10-02: 3,510 tracked .ts/.tsx files under src and scripts (plus gitignored
    // generated ones). A floor, not a census: the corpus grows.
    expect(files.length).toBeGreaterThan(3000);
  });

  test("0 parameter properties, runtime enums or runtime namespaces", () => {
    const violations = files.flatMap((file) =>
      stripTypesViolations(file, readFileSync(join(ROOT, file), "utf8")),
    );
    console.log(
      `strip-types compatibility: examined ${files.length} files, ${violations.length} violations`,
    );
    expect(violations.map((v) => `${v.file}:${v.line} ${v.construct}`)).toEqual([]);
  });
});
