import { describe, expect, test } from "bun:test";
import { compileReadingContent } from "../src/content/compiler/compile.ts";
import { loadReadingFiles } from "./build-content.ts";

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
