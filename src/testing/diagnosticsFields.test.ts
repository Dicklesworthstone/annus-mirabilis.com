import { beforeEach, describe, expect, it } from "bun:test";
import { cp, mkdir, mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { buildContent, CONTENT_COMPILER_FILES } from "../../scripts/build-content.ts";
import {
  type CheckFamily,
  type ContentCheck,
  clearRegisteredChecksForTests,
  DECLARED_CHECK_FAMILIES,
  registerCheck,
} from "../content/compiler/checks/registry.ts";
import { getLogger } from "./log/logger.ts";
import { RUN_IDENTITY_PATTERN } from "./log/schema.ts";

describe("Diagnostics Fields and Structured Logging Gate (am-cm-compiler-core-oa7)", () => {
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

  it("ensures every diagnostic and summary line follows the schema, carries suite 'build-content' and valid extra.family, and never carries runId", async () => {
    const tempBase = process.env.AM_TEST_TMP ?? tmpdir();
    const tempRoot = await mkdtemp(resolve(tempBase, "am-compiler-diag-"));
    await cp(
      resolve(process.cwd(), "src/content/compiler/__fixtures__/corpus"),
      resolve(tempRoot, "corpus"),
      { recursive: true },
    );
    for (const p of CONTENT_COMPILER_FILES) {
      await mkdir(dirname(resolve(tempRoot, p)), { recursive: true });
      await cp(resolve(process.cwd(), p), resolve(tempRoot, p));
    }

    // Run build against fixture corpus in isolated tempRoot
    const result = await buildContent(tempRoot, {
      corpusDir: "corpus",
    });

    expect(result.ok).toBe(true);

    // Read the most recent log file under artifacts/test-logs/build-content/
    const logDir = resolve(process.cwd(), "artifacts/test-logs/build-content");
    const logFiles = (await readdir(logDir)).filter((f) => f.endsWith(".jsonl")).sort();
    expect(logFiles.length).toBeGreaterThan(0);

    const latestFile = logFiles[logFiles.length - 1]!;
    const logContent = await readFile(resolve(logDir, latestFile), "utf8");
    const lines = logContent
      .trim()
      .split(/\r?\n/)
      .map((l) => JSON.parse(l));

    expect(lines.length).toBeGreaterThan(0);

    let foundSummary = false;

    for (const line of lines) {
      // 1. Suite must be 'build-content'
      expect(line.suite).toBe("build-content");

      // 2. logRunId must match YYYYMMDDTHHMMSSZ-<8 hex>
      expect(typeof line.logRunId).toBe("string");
      expect(RUN_IDENTITY_PATTERN.test(line.logRunId)).toBe(true);

      // 3. beadId must be non-empty
      expect(typeof line.beadId).toBe("string");

      // 4. runId must NEVER appear in compiler logs
      expect(line.runId).toBeUndefined();

      // 5. extra.family must be from the declared list
      expect(line.extra).toBeDefined();
      expect(typeof line.extra.family).toBe("string");
      expect(DECLARED_CHECK_FAMILIES.includes(line.extra.family)).toBe(true);

      if (line.testId === "build-content-summary") {
        foundSummary = true;
        expect(line.extra.phaseDurationsMs).toBeDefined();
        expect(line.extra.phaseDurationsMs.load).toBeDefined();
        expect(line.extra.phaseDurationsMs.total).toBeDefined();
      }
    }

    expect(foundSummary).toBe(true);
    logTest(
      "diagnostics-fields-validation",
      "passed",
      `Validated ${lines.length} lines in ${latestFile} for strict field standards.`,
    );
  });

  it("rejects registering a check with undeclared family 'content-structural' naming declared families in error message", () => {
    clearRegisteredChecksForTests();
    const badCheck: ContentCheck = {
      id: "bad-family",
      family: "content-structural" as unknown as CheckFamily,
      severity: "error",
      run: () => {},
    };

    expect(() => registerCheck(badCheck)).toThrow();
    try {
      registerCheck(badCheck);
    } catch (e: unknown) {
      const err = e as Error;
      expect(err.message).toContain("content-structural");
      expect(err.message).toContain("compiler");
      expect(err.message).toContain("structural");
      expect(err.message).toContain("semantic");
      expect(err.message).toContain("voice");
    }
    logTest(
      "reject-undeclared-family",
      "passed",
      "Rejected check registration with undeclared family 'content-structural'",
    );
  });
});
