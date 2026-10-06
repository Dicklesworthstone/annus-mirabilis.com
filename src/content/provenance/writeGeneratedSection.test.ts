/**
 * Tests for writeGeneratedSection refusal throw sites (am-muyh).
 */

import assert from "node:assert/strict";
import fs, { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { describe } from "node:test";
import { fileURLToPath } from "node:url";
import {
  GeneratedSectionError,
  replaceGeneratedContent,
  writeGeneratedSectionSync,
} from "./writeGeneratedSection.ts";

describe("writeGeneratedSection refusal throw sites (am-muyh)", () => {
  const validTemplate =
    "Header\n<!-- generated:test-sec:start -->\nold content\n<!-- generated:test-sec:end -->\nFooter";

  test("refusal (writeGeneratedSection.ts:47): missing-start-marker rejects template missing start marker", () => {
    // Accept: valid start and end markers
    const accepted = replaceGeneratedContent(validTemplate, "test-sec", "new content");
    assert.ok(accepted.updatedText.includes("new content"));

    // Reject: missing start marker
    assert.throws(
      () =>
        replaceGeneratedContent(
          "Header\nold content\n<!-- generated:test-sec:end -->\nFooter",
          "test-sec",
          "new content",
        ),
      (err: unknown) => {
        assert.ok(err instanceof GeneratedSectionError);
        assert.equal((err as GeneratedSectionError).code, "missing-start-marker");
        return true;
      },
    );
  });

  test("refusal (writeGeneratedSection.ts:53): duplicate-start-marker rejects template with multiple start markers", () => {
    // Accept: single start marker
    const accepted = replaceGeneratedContent(validTemplate, "test-sec", "new content");
    assert.ok(accepted.updatedText.includes("new content"));

    // Reject: duplicate start marker
    const duplicateStart =
      "<!-- generated:test-sec:start -->\n<!-- generated:test-sec:start -->\n<!-- generated:test-sec:end -->";
    assert.throws(
      () => replaceGeneratedContent(duplicateStart, "test-sec", "new content"),
      (err: unknown) => {
        assert.ok(err instanceof GeneratedSectionError);
        assert.equal((err as GeneratedSectionError).code, "duplicate-start-marker");
        return true;
      },
    );
  });

  test("refusal (writeGeneratedSection.ts:59): missing-end-marker rejects template missing end marker", () => {
    // Accept: single end marker present
    const accepted = replaceGeneratedContent(validTemplate, "test-sec", "new content");
    assert.ok(accepted.updatedText.includes("new content"));

    // Reject: missing end marker
    const missingEnd = "<!-- generated:test-sec:start -->\ncontent without end";
    assert.throws(
      () => replaceGeneratedContent(missingEnd, "test-sec", "new content"),
      (err: unknown) => {
        assert.ok(err instanceof GeneratedSectionError);
        assert.equal((err as GeneratedSectionError).code, "missing-end-marker");
        return true;
      },
    );
  });

  test("refusal (writeGeneratedSection.ts:65): duplicate-end-marker rejects template with multiple end markers", () => {
    // Accept: single end marker
    const accepted = replaceGeneratedContent(validTemplate, "test-sec", "new content");
    assert.ok(accepted.updatedText.includes("new content"));

    // Reject: duplicate end marker
    const duplicateEnd =
      "<!-- generated:test-sec:start -->\n<!-- generated:test-sec:end -->\n<!-- generated:test-sec:end -->";
    assert.throws(
      () => replaceGeneratedContent(duplicateEnd, "test-sec", "new content"),
      (err: unknown) => {
        assert.ok(err instanceof GeneratedSectionError);
        assert.equal((err as GeneratedSectionError).code, "duplicate-end-marker");
        return true;
      },
    );
  });

  /*
   * THE SECOND unbalanced-markers SITE CANNOT FIRE, and that is asserted rather than claimed (am-r3qt).
   *
   * `unbalanced-markers` is raised twice. The arm below, a start marker after an end marker, is real
   * and is driven. The other, at :74, reads `startPos === undefined || endPos === undefined` - and by
   * the time control reaches it, four earlier guards have already refused a start-marker count of 0
   * (missing-start-marker) and of more than 1 (duplicate-start-marker), and the same pair for the end
   * marker. So each array holds EXACTLY ONE element and neither index can be undefined. The throw
   * exists because `noUncheckedIndexedAccess` cannot see that; it is a type obligation, not a
   * condition.
   *
   * This is am-r3qt's category 3: not work, record the reason. The structural claim is asserted below
   * rather than restated, so "unreachable by construction" goes red if one of those four guards is
   * removed or reordered - which is the only way the site could become live.
   *
   * NOT CITED, deliberately. `unbalanced-markers` has two sites, so a citation is the only thing that
   * credits one; naming the code in prose credits nothing, and citing :74 would mark a site tested
   * that no test drives.
   */
  test("the located-markers guard is unreachable: four refusals precede it", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./writeGeneratedSection.ts", import.meta.url)),
      "utf8",
    );
    // Each of the four counts is refused before the indices are read, so exactly one of each remains.
    for (const code of [
      "missing-start-marker",
      "duplicate-start-marker",
      "missing-end-marker",
      "duplicate-end-marker",
    ]) {
      assert.ok(source.includes(`"${code}"`), `${code} guard is gone; :74 may now be reachable`);
    }
    // And they precede the read, which is what makes the indices safe. Compared by position in the
    // file rather than by line number, so an insertion above does not make this test lie.
    const guardsEnd = Math.max(
      ...[
        "missing-start-marker",
        "duplicate-start-marker",
        "missing-end-marker",
        "duplicate-end-marker",
      ].map((c) => source.indexOf(`"${c}"`)),
    );
    const indexRead = source.indexOf("const startPos = startIndices[0]");
    assert.ok(indexRead > guardsEnd, "the indices are read before the count guards refuse");
  });

  test("refusal (writeGeneratedSection.ts:81): unbalanced-markers rejects start marker after end marker", () => {
    // Accept: start marker before end marker
    const accepted = replaceGeneratedContent(validTemplate, "test-sec", "new content");
    assert.ok(accepted.updatedText.includes("new content"));

    // Reject: end marker placed before start marker
    const inverted = "<!-- generated:test-sec:end -->\n<!-- generated:test-sec:start -->";
    assert.throws(
      () => replaceGeneratedContent(inverted, "test-sec", "new content"),
      (err: unknown) => {
        assert.ok(err instanceof GeneratedSectionError);
        assert.equal((err as GeneratedSectionError).code, "unbalanced-markers");
        return true;
      },
    );
  });

  test("refusal (writeGeneratedSection.ts:106): file-not-found rejects non-existent file path", () => {
    // Accept: existing file path with section markers succeeds.
    //
    // The temp directory comes from the OS, which every machine has. This line
    // previously named an absolute path in a home directory: first
    // /Users/jemanuel/..., which existed here and on no runner, and then
    // /home/agent/... after am-yhus rewrote the username. The second form
    // exists NOWHERE, including here, so the substitution did not fix the test
    // - it broke it everywhere instead of only on CI, and this file was
    // 5 pass 1 fail locally until this change.
    const scratchDir = fs.mkdtempSync(join(tmpdir(), "am-write-generated-section-"));
    const scratchFile = join(scratchDir, "test-writeGeneratedSectionSync.md");
    fs.writeFileSync(scratchFile, validTemplate, "utf8");

    const accepted = writeGeneratedSectionSync(scratchFile, "test-sec", "written content");
    assert.ok(accepted.prefixSha256);
    assert.ok(accepted.suffixSha256);
    assert.ok(fs.readFileSync(scratchFile, "utf8").includes("written content"));

    // Reject: non-existent file
    assert.throws(
      () => writeGeneratedSectionSync("/nonexistent/file/does/not/exist.md", "test-sec", "content"),
      (err: unknown) => {
        assert.ok(err instanceof GeneratedSectionError);
        assert.equal((err as GeneratedSectionError).code, "file-not-found");
        return true;
      },
    );
  });
});
