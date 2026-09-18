import { describe, test } from "bun:test";
import assert from "node:assert/strict";
import { SpanValidationError, spanTextDigest, validateSpanAnchor } from "./spans.ts";

describe("spans schema refusal throw sites (am-muyh)", () => {
  const text = "Dies ist ein kurzer Satz.";
  const digest = spanTextDigest(text);

  test("spans: (spans.ts:43) invalid-span raised when raw span is not an object", () => {
    assert.throws(
      () => validateSpanAnchor(null, text, 1),
      (err) => {
        assert.ok(err instanceof SpanValidationError);
        assert.equal(err.code, "invalid-span");
        return true;
      },
    );
  });

  test("spans: (spans.ts:49) invalid-span-start raised when start is negative, non-integer, or non-number", () => {
    assert.throws(
      () =>
        validateSpanAnchor({ start: -1, end: 4, blockRevision: 1, textDigest: digest }, text, 1),
      (err) => {
        assert.ok(err instanceof SpanValidationError);
        assert.equal(err.code, "invalid-span-start");
        return true;
      },
    );

    assert.throws(
      () =>
        validateSpanAnchor({ start: 1.5, end: 4, blockRevision: 1, textDigest: digest }, text, 1),
      (err) => {
        assert.ok(err instanceof SpanValidationError);
        assert.equal(err.code, "invalid-span-start");
        return true;
      },
    );

    // Accept valid start
    const accepted = validateSpanAnchor(
      { start: 0, end: 4, blockRevision: 1, textDigest: digest },
      text,
      1,
    );
    assert.equal(accepted.start, 0);
  });

  test("spans: (spans.ts:56) invalid-span-end raised when end <= start or non-integer", () => {
    assert.throws(
      () => validateSpanAnchor({ start: 2, end: 2, blockRevision: 1, textDigest: digest }, text, 1),
      (err) => {
        assert.ok(err instanceof SpanValidationError);
        assert.equal(err.code, "invalid-span-end");
        return true;
      },
    );

    assert.throws(
      () => validateSpanAnchor({ start: 2, end: 1, blockRevision: 1, textDigest: digest }, text, 1),
      (err) => {
        assert.ok(err instanceof SpanValidationError);
        assert.equal(err.code, "invalid-span-end");
        return true;
      },
    );

    // Accept valid end
    const accepted = validateSpanAnchor(
      { start: 2, end: 5, blockRevision: 1, textDigest: digest },
      text,
      1,
    );
    assert.equal(accepted.end, 5);
  });

  test("spans: (spans.ts:65) span-out-of-bounds raised when end exceeds plain text length", () => {
    assert.throws(
      () =>
        validateSpanAnchor({ start: 0, end: 100, blockRevision: 1, textDigest: digest }, text, 1),
      (err) => {
        assert.ok(err instanceof SpanValidationError);
        assert.equal(err.code, "span-out-of-bounds");
        return true;
      },
    );

    // Accept bounded end
    const accepted = validateSpanAnchor(
      { start: 0, end: text.length, blockRevision: 1, textDigest: digest },
      text,
      1,
    );
    assert.equal(accepted.end, text.length);
  });

  test("spans: (spans.ts:80) invalid-span-revision raised when blockRevision is non-positive or non-integer", () => {
    assert.throws(
      () => validateSpanAnchor({ start: 0, end: 4, blockRevision: 0, textDigest: digest }, text, 1),
      (err) => {
        assert.ok(err instanceof SpanValidationError);
        assert.equal(err.code, "invalid-span-revision");
        return true;
      },
    );

    assert.throws(
      () =>
        validateSpanAnchor({ start: 0, end: 4, blockRevision: -2, textDigest: digest }, text, 1),
      (err) => {
        assert.ok(err instanceof SpanValidationError);
        assert.equal(err.code, "invalid-span-revision");
        return true;
      },
    );

    // Accept valid positive integer revision
    const accepted = validateSpanAnchor(
      { start: 0, end: 4, blockRevision: 1, textDigest: digest },
      text,
      1,
    );
    assert.equal(accepted.blockRevision, 1);
  });

  test("spans: (spans.ts:88) span-revision-stale raised when blockRevision is older than current", () => {
    assert.throws(
      () => validateSpanAnchor({ start: 0, end: 4, blockRevision: 1, textDigest: digest }, text, 2),
      (err) => {
        assert.ok(err instanceof SpanValidationError);
        assert.equal(err.code, "span-revision-stale");
        return true;
      },
    );
  });

  test("spans: (spans.ts:95) span-revision-future raised when blockRevision is ahead of current", () => {
    assert.throws(
      () => validateSpanAnchor({ start: 0, end: 4, blockRevision: 3, textDigest: digest }, text, 2),
      (err) => {
        assert.ok(err instanceof SpanValidationError);
        assert.equal(err.code, "span-revision-future");
        return true;
      },
    );

    // Accept matching revision
    const accepted = validateSpanAnchor(
      { start: 0, end: 4, blockRevision: 2, textDigest: digest },
      text,
      2,
    );
    assert.equal(accepted.blockRevision, 2);
  });

  test("spans: (spans.ts:104) span-digest-mismatch raised when textDigest does not match computed digest", () => {
    assert.throws(
      () =>
        validateSpanAnchor(
          { start: 0, end: 4, blockRevision: 1, textDigest: "wrong-digest" },
          text,
          1,
        ),
      (err) => {
        assert.ok(err instanceof SpanValidationError);
        assert.equal(err.code, "span-digest-mismatch");
        return true;
      },
    );

    // Accept matching digest
    const accepted = validateSpanAnchor(
      { start: 0, end: 4, blockRevision: 1, textDigest: digest },
      text,
      1,
    );
    assert.equal(accepted.textDigest, digest);
  });
});
