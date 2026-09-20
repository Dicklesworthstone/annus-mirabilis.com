/**
 * Tests for writeGeneratedSection refusal throw sites (am-muyh).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import test, { describe } from "node:test";
import {
  GeneratedSectionError,
  replaceGeneratedContent,
  writeGeneratedSectionSync,
} from "./writeGeneratedSection.ts";

describe("writeGeneratedSection refusal throw sites (am-muyh)", () => {
  const validTemplate = "Header\n<!-- generated:test-sec:start -->\nold content\n<!-- generated:test-sec:end -->\nFooter";

  test("refusal (writeGeneratedSection.ts:47): missing-start-marker rejects template missing start marker", () => {
    // Accept: valid start and end markers
    const accepted = replaceGeneratedContent(validTemplate, "test-sec", "new content");
    assert.ok(accepted.updatedText.includes("new content"));

    // Reject: missing start marker
    assert.throws(
      () => replaceGeneratedContent("Header\nold content\n<!-- generated:test-sec:end -->\nFooter", "test-sec", "new content"),
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
    const duplicateStart = "<!-- generated:test-sec:start -->\n<!-- generated:test-sec:start -->\n<!-- generated:test-sec:end -->";
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
    const duplicateEnd = "<!-- generated:test-sec:start -->\n<!-- generated:test-sec:end -->\n<!-- generated:test-sec:end -->";
    assert.throws(
      () => replaceGeneratedContent(duplicateEnd, "test-sec", "new content"),
      (err: unknown) => {
        assert.ok(err instanceof GeneratedSectionError);
        assert.equal((err as GeneratedSectionError).code, "duplicate-end-marker");
        return true;
      },
    );
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
    // Accept: existing file path with section markers succeeds
    const scratchDir = "/home/agent/.gemini/antigravity-cli/brain/29d4e82d-bbc6-4302-b8e7-83061e8e17fb/scratch";
    const scratchFile = `${scratchDir}/test-writeGeneratedSectionSync.md`;
    fs.mkdirSync(scratchDir, { recursive: true });
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
