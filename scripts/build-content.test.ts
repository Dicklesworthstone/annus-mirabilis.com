import { describe, expect, test } from "bun:test";
import { compileReadingContent } from "../src/content/compiler/compile.ts";
import { loadReadingFiles } from "./build-content.ts";

describe("content compiler routing", () => {
  test("a stray JSON file with no owning schema still fails unrouted-content", () => {
    const result = compileReadingContent([{ path: "notes.json", text: "{}" }]);
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual({
      severity: "error",
      code: "unrouted-content",
      path: "notes.json",
      message: "No schema owns this path. The preview admits JSON records only.",
    });
  });

  test("a stray non-JSON file under a real content prefix still fails unrouted-content", () => {
    const result = compileReadingContent([
      { path: "foundations/scratch.txt", text: "not a record" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual({
      severity: "error",
      code: "unrouted-content",
      path: "foundations/scratch.txt",
      message: "No schema owns this path. The preview admits JSON records only.",
    });
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

  test("the real content/ tree contains no path this compiler leaves unrouted", async () => {
    const files = await loadReadingFiles();
    const result = compileReadingContent(files);
    const unrouted = result.diagnostics.filter((d) => d.code === "unrouted-content");
    expect(unrouted).toEqual([]);
  });
});
