import { beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildContent } from "../../scripts/build-content.ts";
import { clearRegisteredChecksForTests } from "../content/compiler/checks/registry.ts";
import { getLogger } from "./log/logger.ts";

describe("Content Compiler Determinism & Incremental Stability (am-cm-compiler-core-oa7)", () => {
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

  it("produces byte-identical build indexes and payloads across repeated clean compiles", async () => {
    const root = process.cwd();
    const first = await buildContent(root, {
      corpusDir: "src/content/compiler/__fixtures__/corpus",
    });
    const second = await buildContent(root, {
      corpusDir: "src/content/compiler/__fixtures__/corpus",
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.index).toBeDefined();
    expect(second.index).toBeDefined();

    expect(first.index!.inputDigest).toBe(second.index!.inputDigest);
    expect(first.index!.compilerDigest).toBe(second.index!.compilerDigest);
    expect(first.index!.buildDigest).toBe(second.index!.buildDigest);
    expect(first.index!.payloads.length).toBe(second.index!.payloads.length);

    for (let i = 0; i < first.index!.payloads.length; i++) {
      const p1 = first.index!.payloads[i]!;
      const p2 = second.index!.payloads[i]!;
      expect(p1.file).toBe(p2.file);
      expect(p1.sha256).toBe(p2.sha256);
      expect(p1.bytes).toBe(p2.bytes);

      const bytes1 = await readFile(resolve(root, "generated/content", p1.file));
      const bytes2 = await readFile(resolve(root, "generated/content", p2.file));
      expect(bytes1.equals(bytes2)).toBe(true);
    }

    logTest(
      "clean-compile-determinism",
      "passed",
      "Two clean compilations produced byte-identical digests and payload files.",
    );
  });

  it("produces byte-identical output after an edit and revert cycle", async () => {
    const root = process.cwd();
    const clean = await buildContent(root, {
      corpusDir: "src/content/compiler/__fixtures__/corpus",
    });
    expect(clean.ok).toBe(true);

    const targetFile = resolve(
      root,
      "src/content/compiler/__fixtures__/corpus/arguments/test-paper/arg-tp-01.json",
    );
    const originalContent = await readFile(targetFile, "utf8");

    // Make an edit
    const editedContent = originalContent.replace(
      "Definition of Simultaneity",
      "Definition of Simultaneity (Temporary Edit)",
    );
    await writeFile(targetFile, editedContent, "utf8");

    const modified = await buildContent(root, {
      corpusDir: "src/content/compiler/__fixtures__/corpus",
    });
    expect(modified.ok).toBe(true);
    expect(modified.index!.inputDigest).not.toBe(clean.index!.inputDigest);
    expect(modified.index!.buildDigest).not.toBe(clean.index!.buildDigest);

    // Revert the edit
    await writeFile(targetFile, originalContent, "utf8");

    const reverted = await buildContent(root, {
      corpusDir: "src/content/compiler/__fixtures__/corpus",
    });
    expect(reverted.ok).toBe(true);
    expect(reverted.index!.inputDigest).toBe(clean.index!.inputDigest);
    expect(reverted.index!.buildDigest).toBe(clean.index!.buildDigest);

    const cleanPayload = await readFile(
      resolve(root, "generated/content", clean.index!.payloads[0]!.file),
    );
    const revertedPayload = await readFile(
      resolve(root, "generated/content", reverted.index!.payloads[0]!.file),
    );
    expect(cleanPayload.equals(revertedPayload)).toBe(true);

    logTest(
      "edit-revert-determinism",
      "passed",
      "Reverted edit returned to byte-identical build digest and payload bytes.",
    );
  });
});
