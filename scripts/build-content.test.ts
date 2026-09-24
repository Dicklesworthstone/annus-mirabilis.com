import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileReadingContent } from "../src/content/compiler/compile.ts";
import { loadReadingFiles, paragraphBindingDiagnostics } from "./build-content.ts";

describe("a required paper's binding gap fails the build by name", () => {
  const ROOT = process.cwd();

  test("the real mass-energy bindings give no paragraph-binding diagnostic", () => {
    expect(paragraphBindingDiagnostics(ROOT, ["mass-energy"])).toEqual([]);
  });

  test("an unbound paragraph is an error diagnostic whose code and rule are paragraph-binding (build-content.ts:141) (build-content.ts:144)", () => {
    // A copy of mass-energy's manifest, passages, equations and bindings with the binding of
    // s0-p5 removed, under the OS temp directory: this suite deletes nothing.
    const root = mkdtempSync(join(tmpdir(), "build-content-bindings-"));
    for (const dir of ["source-blocks", "arguments", "equations"])
      cpSync(join(ROOT, "content", dir, "mass-energy"), join(root, "content", dir, "mass-energy"), {
        recursive: true,
      });
    const yaml = readFileSync(join(ROOT, "content/bindings/mass-energy.yaml"), "utf8");
    const cut = yaml.replace(/ {2}- unit: s0-p5\n(?: {4}.*\n)+/, "");
    expect(cut).not.toBe(yaml);
    cpSync(join(ROOT, "content/bindings"), join(root, "content/bindings"), { recursive: true });
    writeFileSync(join(root, "content/bindings/mass-energy.yaml"), cut);

    const diagnostics = paragraphBindingDiagnostics(root, ["mass-energy"]);
    expect(diagnostics).toContainEqual({
      severity: "error",
      code: "paragraph-binding",
      path: "content/bindings/mass-energy.yaml",
      message: "mass-energy s0-p5 is bound to no passage",
      rule: "paragraph-binding",
      beadId: "am-bind-paragraphs-and-displays-me-u7bu",
    });
    expect(diagnostics.every((d) => d.code === "paragraph-binding")).toBe(true);
  });
});

describe("content compiler routing", () => {
  test("a stray JSON file with no owning schema still fails unrouted-content", () => {
    const result = compileReadingContent([{ path: "notes.json", text: "{}" }]);
    expect(result.ok).toBe(false);
    const diagnostic = result.diagnostics.find((d) => d.path === "notes.json");
    expect(diagnostic).toMatchObject({
      severity: "error",
      code: "unrouted-content",
      path: "notes.json",
    });
    expect(diagnostic?.message).toContain("notes.json");
  });

  test("a stray non-JSON file under a real content prefix still fails unrouted-content", () => {
    const result = compileReadingContent([
      { path: "foundations/scratch.txt", text: "not a record" },
    ]);
    expect(result.ok).toBe(false);
    const diagnostic = result.diagnostics.find((d) => d.path === "foundations/scratch.txt");
    expect(diagnostic).toMatchObject({
      severity: "error",
      code: "unrouted-content",
      path: "foundations/scratch.txt",
    });
    expect(diagnostic?.message).toContain("foundations/scratch.txt");
  });

  test("an empty file list is not itself an unrouted-content failure", () => {
    const result = compileReadingContent([]);
    expect(result.diagnostics.some((d) => d.code === "unrouted-content")).toBe(false);
  });
});

describe("content directory walk", () => {
  test("README.md documentation files are excluded from the routed file set, not routed", async () => {
    const files = await loadReadingFiles();
    expect(files.some((f) => f.path.split("/").pop() === "README.md")).toBe(false);
  });
});

describe("AC5: error aggregation across multiple files", () => {
  test("multiple schema errors across distinct files are all reported in one run", () => {
    const invalidPaper = {
      path: "papers/broken-paper.json",
      text: JSON.stringify({
        schemaVersion: 1,
        kind: "paper",
        id: "broken-paper",
        // missing required fields: title, description, citation, sections, sourceNotice, etc.
      }),
    };
    const invalidFoundation = {
      path: "foundations/broken-foundation.json",
      text: JSON.stringify({
        schemaVersion: 1,
        kind: "foundation",
        id: "broken-foundation",
        // missing required fields: title, question, summary, explanation, example, etc.
      }),
    };

    const result = compileReadingContent([invalidPaper, invalidFoundation]);
    expect(result.ok).toBe(false);

    // Both files must be reported in diagnostics in the same single run
    const paperError = result.diagnostics.find((d) => d.path === "papers/broken-paper.json");
    const foundationError = result.diagnostics.find(
      (d) => d.path === "foundations/broken-foundation.json",
    );

    expect(paperError).toBeDefined();
    expect(paperError?.severity).toBe("error");
    expect(foundationError).toBeDefined();
    expect(foundationError?.severity).toBe("error");

    // All errors are collected and reported together (not halting on the first failure)
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(2);
  });
});
