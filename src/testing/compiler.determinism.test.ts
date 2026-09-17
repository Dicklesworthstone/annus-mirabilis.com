import { beforeEach, describe, expect, it } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import {
  buildContent,
  CONTENT_COMPILER_FILES,
  loadAllContentFiles,
  loadReadingFiles,
} from "../../scripts/build-content.ts";
import { clearRegisteredChecksForTests } from "../content/compiler/checks/registry.ts";
import { getLogger } from "./log/logger.ts";

async function createFixtureWorkspace(): Promise<{ tempRoot: string; corpusDir: string }> {
  const tempBase = process.env.AM_TEST_TMP ?? tmpdir();
  const tempRoot = await mkdtemp(resolve(tempBase, "am-compiler-det-"));
  await cp(
    resolve(process.cwd(), "src/content/compiler/__fixtures__/corpus"),
    resolve(tempRoot, "corpus"),
    { recursive: true },
  );
  for (const p of CONTENT_COMPILER_FILES) {
    await mkdir(dirname(resolve(tempRoot, p)), { recursive: true });
    await cp(resolve(process.cwd(), p), resolve(tempRoot, p));
  }
  return { tempRoot, corpusDir: "corpus" };
}

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
    const { tempRoot, corpusDir } = await createFixtureWorkspace();
    const first = await buildContent(tempRoot, { corpusDir });
    const second = await buildContent(tempRoot, { corpusDir });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.index).toBeDefined();
    expect(second.index).toBeDefined();
    if (!first.index || !second.index) {
      throw new Error("Expected compilation indexes to be defined");
    }
    const firstIndex = first.index;
    const secondIndex = second.index;

    expect(firstIndex.inputDigest).toBe(secondIndex.inputDigest);
    expect(firstIndex.compilerDigest).toBe(secondIndex.compilerDigest);
    expect(firstIndex.buildDigest).toBe(secondIndex.buildDigest);
    expect(firstIndex.payloads.length).toBe(secondIndex.payloads.length);

    for (let i = 0; i < firstIndex.payloads.length; i++) {
      const p1 = firstIndex.payloads[i];
      const p2 = secondIndex.payloads[i];
      expect(p1).toBeDefined();
      expect(p2).toBeDefined();
      if (!p1 || !p2) {
        throw new Error(`Expected payload ${i} to be defined`);
      }
      expect(p1.file).toBe(p2.file);
      expect(p1.sha256).toBe(p2.sha256);
      expect(p1.bytes).toBe(p2.bytes);

      const bytes1 = await readFile(resolve(tempRoot, "generated/content", p1.file));
      const bytes2 = await readFile(resolve(tempRoot, "generated/content", p2.file));
      expect(bytes1.equals(bytes2)).toBe(true);
    }

    logTest(
      "clean-compile-determinism",
      "passed",
      "Two clean compilations produced byte-identical digests and payload files.",
    );
  });

  it("produces byte-identical output after an edit and revert cycle", async () => {
    const { tempRoot, corpusDir } = await createFixtureWorkspace();
    const clean = await buildContent(tempRoot, { corpusDir });
    expect(clean.ok).toBe(true);
    expect(clean.index).toBeDefined();
    if (!clean.index) {
      throw new Error("Expected clean compilation index to be defined");
    }
    const cleanIndex = clean.index;

    const targetFile = resolve(tempRoot, "corpus/arguments/test-paper/arg-tp-01.json");
    const originalContent = await readFile(targetFile, "utf8");

    // Make an edit in isolated temp workspace
    const editedContent = originalContent.replace(
      "Definition of Simultaneity",
      "Definition of Simultaneity (Temporary Edit)",
    );
    await writeFile(targetFile, editedContent, "utf8");

    const modified = await buildContent(tempRoot, { corpusDir });
    expect(modified.ok).toBe(true);
    expect(modified.index).toBeDefined();
    if (!modified.index) {
      throw new Error("Expected modified compilation index to be defined");
    }
    expect(modified.index.inputDigest).not.toBe(cleanIndex.inputDigest);
    expect(modified.index.buildDigest).not.toBe(cleanIndex.buildDigest);

    // Revert the edit
    await writeFile(targetFile, originalContent, "utf8");

    const reverted = await buildContent(tempRoot, { corpusDir });
    expect(reverted.ok).toBe(true);
    expect(reverted.index).toBeDefined();
    if (!reverted.index) {
      throw new Error("Expected reverted compilation index to be defined");
    }
    expect(reverted.index.inputDigest).toBe(cleanIndex.inputDigest);
    expect(reverted.index.buildDigest).toBe(cleanIndex.buildDigest);

    const cleanPayloadFile = cleanIndex.payloads[0]?.file;
    const revertedPayloadFile = reverted.index.payloads[0]?.file;
    expect(cleanPayloadFile).toBeDefined();
    expect(revertedPayloadFile).toBeDefined();
    if (!cleanPayloadFile || !revertedPayloadFile) {
      throw new Error("Expected payload file to be defined");
    }

    const cleanPayload = await readFile(resolve(tempRoot, "generated/content", cleanPayloadFile));
    const revertedPayload = await readFile(
      resolve(tempRoot, "generated/content", revertedPayloadFile),
    );
    expect(cleanPayload.equals(revertedPayload)).toBe(true);

    logTest(
      "edit-revert-determinism",
      "passed",
      "Reverted edit returned to byte-identical build digest and payload bytes.",
    );
  });

  it("strictly refuses content symlinks regardless of filename prefix, including dot-named and AppleDouble symlinks", async () => {
    const { tempRoot, corpusDir } = await createFixtureWorkspace();
    const targetFile = resolve(tempRoot, "corpus/arguments/test-paper/arg-tp-01.json");
    const dotSymlink = resolve(tempRoot, "corpus/arguments/test-paper/.hidden-symlink.json");
    const regularSymlink = resolve(tempRoot, "corpus/arguments/test-paper/symlinked.json");
    const appleDoubleSymlink = resolve(
      tempRoot,
      "corpus/arguments/test-paper/._apple-double-symlink.json",
    );

    // Test dot-named symlink
    await symlink(targetFile, dotSymlink);
    expect(loadReadingFiles(tempRoot, corpusDir)).rejects.toThrow(
      /Content symlinks are not admitted/,
    );
    expect(loadAllContentFiles(tempRoot, corpusDir)).rejects.toThrow(
      /Content symlinks are not admitted/,
    );
    expect(buildContent(tempRoot, { corpusDir })).rejects.toThrow(
      /Content symlinks are not admitted/,
    );
    await unlink(dotSymlink);

    // Test AppleDouble-prefixed symlink
    await symlink(targetFile, appleDoubleSymlink);
    expect(loadReadingFiles(tempRoot, corpusDir)).rejects.toThrow(
      /Content symlinks are not admitted/,
    );
    expect(loadAllContentFiles(tempRoot, corpusDir)).rejects.toThrow(
      /Content symlinks are not admitted/,
    );
    expect(buildContent(tempRoot, { corpusDir })).rejects.toThrow(
      /Content symlinks are not admitted/,
    );
    await unlink(appleDoubleSymlink);

    // Test regular symlink
    await symlink(targetFile, regularSymlink);
    expect(loadReadingFiles(tempRoot, corpusDir)).rejects.toThrow(
      /Content symlinks are not admitted/,
    );
    expect(loadAllContentFiles(tempRoot, corpusDir)).rejects.toThrow(
      /Content symlinks are not admitted/,
    );
    expect(buildContent(tempRoot, { corpusDir })).rejects.toThrow(
      /Content symlinks are not admitted/,
    );
    await unlink(regularSymlink);

    logTest(
      "symlink-gate-planted-negatives",
      "passed",
      "Content symlinks (dot-named, AppleDouble-prefixed, and regular) are strictly refused.",
    );
  });
});
