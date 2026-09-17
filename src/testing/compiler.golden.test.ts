import { beforeEach, describe, expect, it } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { buildContent, CONTENT_COMPILER_FILES } from "../../scripts/build-content.ts";
import { clearRegisteredChecksForTests } from "../content/compiler/checks/registry.ts";
import { canonicalJsonStringify } from "../content/compiler/emitter.ts";
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

    const paperEntry = result.index!.payloads.find(
      (p) => p.kind === "paper" && p.id === "test-paper",
    );
    expect(paperEntry).toBeDefined();

    const producedPath = resolve(tempRoot, "generated/content", paperEntry!.file);
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

    expect(canonicalProduced).toBe(canonicalGolden);
    expect(parsedProduced.arguments.length).toBe(3);
    expect(parsedProduced.paper.sections.length).toBe(2);
    expect(parsedProduced.equations.length).toBe(1);

    logTest(
      "compiler-golden-payload",
      matches ? "passed" : "failed",
      "Compared compiled paper payload against golden reference JSON (byte-for-byte identical).",
    );
  });
});
