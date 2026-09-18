/**
 * Regression test for am-arlh:
 * Ensures test runs and compilation of test fixtures never pollute or
 * overwrite the repository's compiled content under generated/content/.
 */

import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { buildContent, parseCliArgs, runContentCompileOnce } from "../../scripts/build-content.ts";
import { createBaseCorpus } from "../content/checks/structural/testFixtures.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const INDEX_PATH = join(ROOT, "generated", "content", "index.json");

function readRepoIndex(): {
  buildDigest: string;
  inputDigest: string;
  payloads: Array<{ id: string; kind: string; file: string }>;
} {
  expect(existsSync(INDEX_PATH)).toBe(true);
  return JSON.parse(readFileSync(INDEX_PATH, "utf8"));
}

function writeFixtureCorpus(dir: string): void {
  for (const file of createBaseCorpus()) {
    const rel = file.path.replace(/^content\//, "");
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, file.text, "utf8");
  }
}

describe("generated/content isolation guard (am-arlh)", () => {
  it("buildContent() in-process defaults to shouldEmit=false when corpusDir != 'content' on repo root", async () => {
    const beforeIndex = readRepoIndex();
    const tempCorpus = mkdtempSync(join(tmpdir(), "am-isolation-inproc-"));

    try {
      writeFixtureCorpus(tempCorpus);

      const result = await buildContent(ROOT, { corpusDir: tempCorpus });
      expect(result.ok).toBe(true);
      // When shouldEmit is false, buildContent returns null for index
      expect(result.index).toBeNull();

      const afterIndex = readRepoIndex();
      expect(afterIndex.buildDigest).toBe(beforeIndex.buildDigest);
      expect(afterIndex.payloads.length).toBe(28);
    } finally {
      rmSync(tempCorpus, { recursive: true, force: true });
    }
  });

  it("runContentCompileOnce() defaults to shouldEmit=false for fixture corpus and leaves generated/content untouched", async () => {
    const beforeIndex = readRepoIndex();
    const tempCorpus = mkdtempSync(join(tmpdir(), "am-isolation-compileonce-"));

    try {
      writeFixtureCorpus(tempCorpus);

      // runContentCompileOnce is the entry point called by the CLI runner
      const ok = await runContentCompileOnce(tempCorpus);
      expect(ok).toBe(true);

      const afterIndex = readRepoIndex();
      expect(afterIndex.buildDigest).toBe(beforeIndex.buildDigest);
      expect(afterIndex.inputDigest).toBe(beforeIndex.inputDigest);
      expect(afterIndex.payloads.length).toBe(28);

      const paperIds = afterIndex.payloads.filter((p) => p.kind === "paper").map((p) => p.id);
      expect(paperIds).toEqual(["brownian-motion", "mass-energy"]);
      expect(paperIds).not.toContain("test-paper");
    } finally {
      rmSync(tempCorpus, { recursive: true, force: true });
    }
  });

  it("buildContent() with a foreign root (root != ROOT) emits to the foreign root's generated dir", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "am-isolation-foreign-root-"));
    const beforeIndex = readRepoIndex();

    try {
      const corpusDir = join(tempRoot, "my-content");
      writeFixtureCorpus(corpusDir);

      const result = await buildContent(tempRoot, { corpusDir });
      expect(result.ok).toBe(true);
      expect(result.index).toBeDefined();

      // Foreign root received the emitted index
      const foreignIndex = join(tempRoot, "generated", "content", "index.json");
      expect(existsSync(foreignIndex)).toBe(true);

      // Repo root index is completely untouched
      const afterIndex = readRepoIndex();
      expect(afterIndex.buildDigest).toBe(beforeIndex.buildDigest);
      expect(afterIndex.payloads.length).toBe(28);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("parseCliArgs parses --emit and --no-emit flags accurately", () => {
    expect(parseCliArgs([])).toEqual({
      corpusDir: "content",
      watchMode: false,
      shouldEmit: undefined,
    });
    expect(parseCliArgs(["--corpus", "fixtures", "--no-emit"])).toEqual({
      corpusDir: "fixtures",
      watchMode: false,
      shouldEmit: false,
    });
    expect(parseCliArgs(["--corpus", "fixtures", "--emit"])).toEqual({
      corpusDir: "fixtures",
      watchMode: false,
      shouldEmit: true,
    });
  });

  it("canonical repository index contains all 28 payloads, brownian-motion and mass-energy papers", () => {
    const index = readRepoIndex();
    expect(index.payloads.length).toBe(28);

    const papers = index.payloads.filter((p) => p.kind === "paper");
    expect(papers.map((p) => p.id)).toEqual(["brownian-motion", "mass-energy"]);

    const foundations = index.payloads.filter((p) => p.kind === "foundation");
    expect(foundations.length).toBeGreaterThan(0);

    // Rejects any fixture corruption leftovers
    for (const p of index.payloads) {
      expect(p.id).not.toContain("test-paper");
      expect(p.id).not.toContain("isolation");
      expect(p.id).not.toContain("broken");
    }
  });
});
