import { beforeEach, describe, expect, it } from "bun:test";
import { cp, mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { buildContent, CONTENT_COMPILER_FILES } from "../../scripts/build-content.ts";
import { clearRegisteredChecksForTests } from "../content/compiler/checks/registry.ts";
import { canonicalJsonStringify } from "../content/compiler/emitter.ts";
import { READING_IDS, READING_SCHEMA_VERSION } from "../content/schemas/reading.ts";
import { getLogger, newRunIdentity } from "./log/logger.ts";

describe("Content Compiler Golden Payload Comparison (am-cm-compiler-core-oa7)", () => {
  const logger = getLogger("content-compiler-tests");

  beforeEach(() => {
    clearRegisteredChecksForTests();
  });

  function logTest(testId: string, outcome: "passed" | "failed", message: string) {
    logger.log({
      testId,
      beadId: "am-cm-compiler-core-oa7",
      outcome,
      message,
    });
  }

  it("compiles fixture corpus and matches golden payload byte-for-byte", async () => {
    const tempBase = process.env.AM_TEST_TMP ?? tmpdir();
    const tempRoot = await mkdtemp(resolve(tempBase, "am-compiler-golden-"));
    await cp(
      resolve(process.cwd(), "src/content/compiler/__fixtures__/corpus"),
      resolve(tempRoot, "corpus"),
      { recursive: true },
    );
    for (const p of CONTENT_COMPILER_FILES) {
      await mkdir(dirname(resolve(tempRoot, p)), { recursive: true });
      await cp(resolve(process.cwd(), p), resolve(tempRoot, p));
    }

    const result = await buildContent(tempRoot, {
      corpusDir: "corpus",
    });

    expect(result.ok).toBe(true);
    expect(result.index).toBeDefined();
    if (!result.index) throw new Error("result.index is undefined");

    const paperEntry = result.index.payloads.find(
      (p) => p.kind === "paper" && p.id === "test-paper",
    );
    expect(paperEntry).toBeDefined();
    if (!paperEntry) throw new Error("paperEntry is undefined");

    const producedPath = resolve(tempRoot, "generated/content", paperEntry.file);
    const producedContent = await readFile(producedPath, "utf8");

    const goldenPath = resolve(
      process.cwd(),
      "src/content/compiler/__fixtures__/golden/paper-test-paper.golden.json",
    );
    const goldenContent = await readFile(goldenPath, "utf8");

    const parsedProduced = JSON.parse(producedContent);
    const parsedGolden = JSON.parse(goldenContent);

    const canonicalProduced = canonicalJsonStringify(parsedProduced, 2);
    const canonicalGolden = canonicalJsonStringify(parsedGolden, 2);

    const matches = canonicalProduced === canonicalGolden;

    if (!matches) {
      // Retain failure evidence under artifacts/test-logs/build-content/<log-run-id>/
      const runId = newRunIdentity();
      const evidenceDir = resolve(process.cwd(), "artifacts/test-logs/build-content", runId);
      await mkdir(evidenceDir, { recursive: true });
      await writeFile(resolve(evidenceDir, "paper-test-paper.produced.json"), canonicalProduced);
      await writeFile(resolve(evidenceDir, "paper-test-paper.golden.json"), canonicalGolden);
      console.error(`Golden mismatch retained at ${evidenceDir}`);
    }

    // 1. Pinned byte-for-byte golden payload match (do not weaken)
    expect(canonicalProduced).toBe(canonicalGolden);

    // 2. Golden-independent semantic invariants derived from fixture corpus inputs
    // These assertions guard against RH-3 (silent golden regeneration masking corruption).
    const corpusDir = resolve(tempRoot, "corpus");

    // Invariant A: schemaVersion matches the compiler's current constant across all records
    expect(parsedProduced.schemaVersion).toBe(READING_SCHEMA_VERSION);
    expect(parsedProduced.paper.schemaVersion).toBe(READING_SCHEMA_VERSION);
    for (const arg of parsedProduced.arguments) {
      expect(arg.schemaVersion).toBe(READING_SCHEMA_VERSION);
    }
    for (const eq of parsedProduced.equations) {
      expect(eq.schemaVersion).toBe(READING_SCHEMA_VERSION);
    }
    for (const cite of parsedProduced.citations) {
      expect(cite.schemaVersion).toBe(READING_SCHEMA_VERSION);
    }
    for (const foundation of parsedProduced.foundations) {
      expect(foundation.schemaVersion).toBe(READING_SCHEMA_VERSION);
    }

    // Invariant B: every argument id in the payload appears in the fixture source and vice versa
    const fixturePaper = JSON.parse(
      await readFile(resolve(corpusDir, "papers/test-paper.json"), "utf8"),
    );
    const declaredSectionArgIds = (fixturePaper.sections as Array<{ arguments: string[] }>)
      .flatMap((s) => s.arguments)
      .sort();

    const argFileNames = (await readdir(resolve(corpusDir, "arguments/test-paper"))).filter((f) =>
      f.endsWith(".json"),
    );
    const argFiles = await Promise.all(
      argFileNames.map(async (f) =>
        JSON.parse(await readFile(resolve(corpusDir, "arguments/test-paper", f), "utf8")),
      ),
    );
    const fixtureArgFileIds = argFiles.map((a: { id: string }) => a.id).sort();

    const payloadArgIds = (parsedProduced.arguments as Array<{ id: string }>)
      .map((a) => a.id)
      .sort();

    expect(payloadArgIds).toEqual(declaredSectionArgIds);
    expect(payloadArgIds).toEqual(fixtureArgFileIds);

    // Every argument maps to its declared section from the fixture paper
    const sectionByArgId = new Map<string, string>();
    for (const s of fixturePaper.sections as Array<{ id: string; arguments: string[] }>) {
      for (const argId of s.arguments) {
        sectionByArgId.set(argId, s.id);
      }
    }
    for (const arg of parsedProduced.arguments as Array<{ id: string; section: string }>) {
      expect(arg.section).toBe(sectionByArgId.get(arg.id));
    }

    // Paper sections structure matches the fixture paper
    const payloadSections = parsedProduced.paper.sections as Array<{
      id: string;
      title: string;
      arguments: string[];
    }>;
    const fixtureSections = fixturePaper.sections as Array<{
      id: string;
      title: string;
      arguments: string[];
    }>;
    expect(payloadSections.map((s) => s.id)).toEqual(fixtureSections.map((s) => s.id));
    for (const sec of payloadSections) {
      const fixSec = fixtureSections.find((s) => s.id === sec.id);
      expect(fixSec).toBeDefined();
      if (fixSec) {
        expect(sec.arguments).toEqual(fixSec.arguments);
        expect(sec.title).toBe(fixSec.title);
      }
    }

    // Invariant C: equation and citation counts equal what the fixture declares
    const eqFileNames = (await readdir(resolve(corpusDir, "equations/test-paper"))).filter((f) =>
      f.endsWith(".json"),
    );
    const citeFileNames = (await readdir(resolve(corpusDir, "bibliography"))).filter((f) =>
      f.endsWith(".json"),
    );
    const foundationFileNames = (await readdir(resolve(corpusDir, "foundations"))).filter((f) =>
      f.endsWith(".json"),
    );

    const eqFiles = await Promise.all(
      eqFileNames.map(async (f) =>
        JSON.parse(await readFile(resolve(corpusDir, "equations/test-paper", f), "utf8")),
      ),
    );
    const citeFiles = await Promise.all(
      citeFileNames.map(async (f) =>
        JSON.parse(await readFile(resolve(corpusDir, "bibliography", f), "utf8")),
      ),
    );
    const foundationFiles = await Promise.all(
      foundationFileNames.map(async (f) =>
        JSON.parse(await readFile(resolve(corpusDir, "foundations", f), "utf8")),
      ),
    );

    expect(parsedProduced.equations.length).toBe(eqFiles.length);
    expect(parsedProduced.citations.length).toBe(citeFiles.length);
    expect(parsedProduced.foundations.length).toBe(foundationFiles.length);

    const payloadEqIds = (parsedProduced.equations as Array<{ id: string }>)
      .map((e) => e.id)
      .sort();
    const fixtureEqIds = eqFiles.map((e: { id: string }) => e.id).sort();
    expect(payloadEqIds).toEqual(fixtureEqIds);

    const payloadCiteIds = (parsedProduced.citations as Array<{ id: string }>)
      .map((c) => c.id)
      .sort();
    const fixtureCiteIds = citeFiles.map((c: { id: string }) => c.id).sort();
    expect(payloadCiteIds).toEqual(fixtureCiteIds);

    const payloadFoundationIds = (parsedProduced.foundations as Array<{ id: string }>)
      .map((f) => f.id)
      .sort();
    const fixtureFoundationIds = foundationFiles.map((f: { id: string }) => f.id).sort();
    expect(payloadFoundationIds).toEqual(fixtureFoundationIds);

    // Cross-reference referential integrity derived from fixture
    for (const eq of parsedProduced.equations as Array<{ argument: string; paper: string }>) {
      expect(payloadArgIds).toContain(eq.argument);
      expect(eq.paper).toBe(fixturePaper.id);
    }
    expect(payloadCiteIds).toContain(parsedProduced.paper.citation);
    for (const arg of parsedProduced.arguments as Array<{ citations: string[] }>) {
      for (const citeId of arg.citations) {
        expect(payloadCiteIds).toContain(citeId);
      }
    }

    // Invariant D: no argument is missing required fields, and string content is non-empty
    const REQUIRED_ARGUMENT_FIELDS = [
      "id",
      "kind",
      "schemaVersion",
      "paper",
      "section",
      "title",
      "question",
      "recap",
      "review",
      "premises",
      "limitations",
      "citations",
      "readings",
      "prerequisites",
      "meaning",
    ] as const;

    for (const arg of parsedProduced.arguments as Array<Record<string, unknown>>) {
      for (const field of REQUIRED_ARGUMENT_FIELDS) {
        expect(arg).toHaveProperty(field);
        expect(arg[field]).toBeDefined();
      }
      expect(arg.kind).toBe("argument");
      expect(arg.paper).toBe(fixturePaper.id);
      expect(typeof arg.title).toBe("string");
      expect((arg.title as string).trim().length).toBeGreaterThan(0);
      expect(typeof arg.question).toBe("string");
      expect((arg.question as string).trim().length).toBeGreaterThan(0);
      expect(typeof arg.recap).toBe("string");
      expect((arg.recap as string).trim().length).toBeGreaterThan(0);
      expect(["draft", "reviewed", "flagged"]).toContain(arg.review as string);
      expect(Array.isArray(arg.premises)).toBe(true);
      expect((arg.premises as unknown[]).length).toBeGreaterThan(0);
      expect(Array.isArray(arg.limitations)).toBe(true);
      expect((arg.limitations as unknown[]).length).toBeGreaterThan(0);
      expect(Array.isArray(arg.citations)).toBe(true);
      expect((arg.citations as unknown[]).length).toBeGreaterThan(0);
      expect(Array.isArray(arg.prerequisites)).toBe(true);
      expect(typeof arg.meaning).toBe("object");
      expect(typeof (arg.meaning as Record<string, unknown>).logicalRole).toBe("string");
      expect(typeof (arg.meaning as Record<string, unknown>).historicalStatus).toBe("string");
      expect(typeof (arg.meaning as Record<string, unknown>).modelStatus).toBe("string");
      expect(typeof (arg.meaning as Record<string, unknown>).executionStatus).toBe("string");
      expect(typeof arg.readings).toBe("object");
      for (const readingId of READING_IDS) {
        expect(arg.readings).toHaveProperty(readingId);
        const readingsMap = arg.readings as Record<string, unknown>;
        const blocks = readingsMap[readingId];
        expect(Array.isArray(blocks)).toBe(true);
        if (Array.isArray(blocks)) {
          expect(blocks.length).toBeGreaterThan(0);
        }
      }
    }

    logTest(
      "compiler-golden-payload",
      matches ? "passed" : "failed",
      "Compared compiled paper payload against golden reference JSON (byte-for-byte identical).",
    );
  });
});
