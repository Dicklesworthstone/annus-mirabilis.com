/**
 * Regression test for am-arlh:
 * Ensures test runs and compilation of test fixtures never pollute or
 * overwrite the repository's compiled content under generated/content/.
 */

import { describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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

/**
 * The record ids the corpus declares for one entity directory, read from disk.
 *
 * The guard below used to assert a literal payload count. That number was
 * wrong within a day of being written, twice, because authoring a record is
 * ordinary work, and a guard that has to be edited every time the corpus grows
 * teaches everyone to edit the guard. The corpus is the reference: a wipe or a
 * fixture leak still fails, and a new record does not.
 */
function corpusRecordIds(
  entityDir: "papers" | "foundations",
  corpusRoot: string = join(ROOT, "content"),
): string[] {
  const directory = join(corpusRoot, entityDir);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -".json".length))
    .sort();
}

/** A minimal, self-contained foundation record: enough to be compiled, nothing more. */
function writeFoundationRecord(corpusRoot: string, id: string): void {
  const directory = join(corpusRoot, "foundations");
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, `${id}.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        kind: "foundation",
        id,
        title: "Reading a rate",
        question: "What does a rate of change say about a measured quantity?",
        summary:
          "A rate reports how much one quantity changes for a stated change in another, and it carries the units of both.",
        review: "draft",
        explanation: [
          {
            kind: "paragraph",
            text: "A rate is a ratio of two changes. Its units are the units of the numerator divided by the units of the denominator, and dropping either one loses the meaning of the number.",
          },
        ],
        example: [
          {
            kind: "steps",
            items: [
              "A tracer moves 2 micrometres in 4 seconds.",
              "The average rate is 0.5 micrometres per second.",
              "Halving the elapsed time does not halve the distance unless the motion is uniform.",
            ],
          },
        ],
        prerequisites: [],
        stoppingPoint:
          "Check which quantity is in the numerator and whether the rate is an average or an instantaneous value.",
        citations: [],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function compiledIds(
  index: { payloads: readonly { readonly id: string; readonly kind: string }[] },
  kind: string,
): string[] {
  return index.payloads
    .filter((p) => p.kind === kind)
    .map((p) => p.id)
    .sort();
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
      expect(afterIndex).toEqual(beforeIndex);
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
      expect(afterIndex).toEqual(beforeIndex);

      // The fixture corpus declares a paper of its own. None of it may appear
      // here: the repository's compiled papers still answer to content/papers.
      expect(compiledIds(afterIndex, "paper")).toEqual(corpusRecordIds("papers"));
      expect(compiledIds(afterIndex, "paper")).not.toContain("test-paper");
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
      expect(afterIndex).toEqual(beforeIndex);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("the record-for-record invariant survives the corpus growing by one record", async () => {
    // The guard this file replaces asserted a literal payload count and broke
    // the first time anyone authored a record. This is the control for that:
    // the same comparison has to hold at N records and at N + 1, and the extra
    // record has to actually reach the index, or the invariant is vacuous.
    const tempRoot = mkdtempSync(join(tmpdir(), "am-isolation-growth-"));

    try {
      const corpusDir = join(tempRoot, "content");
      writeFixtureCorpus(corpusDir);
      writeFoundationRecord(corpusDir, "growth-probe-rate");

      const first = await buildContent(tempRoot, { corpusDir });
      expect(first.ok).toBe(true);
      const firstIndex = first.index;
      expect(firstIndex).not.toBeNull();
      if (!firstIndex) throw new Error("expected an emitted index for the foreign root");
      expect(compiledIds(firstIndex, "foundation")).toEqual(
        corpusRecordIds("foundations", corpusDir),
      );
      expect(compiledIds(firstIndex, "paper")).toEqual(corpusRecordIds("papers", corpusDir));

      // One more authored record. Nothing else changes.
      writeFoundationRecord(corpusDir, "growth-probe-units");

      const second = await buildContent(tempRoot, { corpusDir });
      expect(second.ok).toBe(true);
      const secondIndex = second.index;
      expect(secondIndex).not.toBeNull();
      if (!secondIndex) throw new Error("expected an emitted index for the foreign root");

      // The record really compiled: the invariant is not passing on an empty set.
      expect(secondIndex.payloads.length).toBe(firstIndex.payloads.length + 1);
      expect(compiledIds(secondIndex, "foundation")).toContain("growth-probe-units");
      expect(compiledIds(secondIndex, "foundation")).toEqual(
        corpusRecordIds("foundations", corpusDir),
      );
      expect(compiledIds(secondIndex, "paper")).toEqual(corpusRecordIds("papers", corpusDir));

      // And the repository corpus is still none of this compile's business.
      expect(compiledIds(readRepoIndex(), "paper")).toEqual(corpusRecordIds("papers"));
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

  it("canonical repository index answers to the corpus on disk, record for record", () => {
    const index = readRepoIndex();

    // One compiled payload per authored record, both directions. A wiped or
    // truncated index fails here; so does a payload with no record behind it.
    expect(compiledIds(index, "paper")).toEqual(corpusRecordIds("papers"));
    expect(compiledIds(index, "foundation")).toEqual(corpusRecordIds("foundations"));
    expect(corpusRecordIds("papers").length).toBeGreaterThan(0);
    expect(corpusRecordIds("foundations").length).toBeGreaterThan(0);

    const ids = index.payloads.map((p) => p.id);
    expect(ids.length).toBe(new Set(ids).size);

    // Every payload the index advertises is really on disk.
    for (const p of index.payloads) {
      expect(existsSync(join(ROOT, "generated", "content", p.file))).toBe(true);
    }

    // Rejects any fixture corruption leftovers
    for (const p of index.payloads) {
      expect(p.id).not.toContain("test-paper");
      expect(p.id).not.toContain("isolation");
      expect(p.id).not.toContain("broken");
    }
  });
});
