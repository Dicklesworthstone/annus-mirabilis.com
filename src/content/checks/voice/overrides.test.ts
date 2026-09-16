import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findStaleOverrides, type VoiceOverrideEntry, validateOverrideEntry } from "./overrides.ts";

describe("overrides: Validation & Staleness Rules", () => {
  it("validates a complete override entry", () => {
    const raw = {
      target: "arg-bm-01",
      rule: "hyphenated-dash",
      matchedText: "some-text",
      reason: "Historical citation preserving period spelling.",
      reviewer: "einstein-scholar",
      date: "2026-09-16",
    };

    const validated = validateOverrideEntry(raw);
    assert.equal(validated.target, "arg-bm-01");
    assert.equal(validated.reviewer, "einstein-scholar");
    assert.equal(validated.date, "2026-09-16");
  });

  it("fails when reason is missing", () => {
    const raw = {
      target: "arg-bm-01",
      rule: "hyphenated-dash",
      matchedText: "some-text",
      reviewer: "einstein-scholar",
      date: "2026-09-16",
    };

    assert.throws(() => validateOverrideEntry(raw), /missing a non-empty "reason"/);
  });

  it("fails when reviewer is missing", () => {
    const raw = {
      target: "arg-bm-01",
      rule: "hyphenated-dash",
      matchedText: "some-text",
      reason: "Historical citation",
      date: "2026-09-16",
    };

    assert.throws(() => validateOverrideEntry(raw), /missing a non-empty "reviewer"/);
  });

  it("fails when date format is invalid", () => {
    const raw = {
      target: "arg-bm-01",
      rule: "hyphenated-dash",
      matchedText: "some-text",
      reason: "Historical citation",
      reviewer: "einstein-scholar",
      date: "09/16/2026",
    };

    assert.throws(() => validateOverrideEntry(raw), /malformed date/);
  });

  it("flags an override as stale when matchedText no longer occurs in target", () => {
    const overrides: VoiceOverrideEntry[] = [
      {
        target: "arg-01",
        rule: "em-dash",
        matchedText: "old text that was removed",
        reason: "Historical note",
        reviewer: "reviewer-1",
        date: "2026-09-16",
      },
      {
        target: "arg-02",
        rule: "em-dash",
        matchedText: "current text that still exists",
        reason: "Historical note",
        reviewer: "reviewer-1",
        date: "2026-09-16",
      },
    ];

    const currentTexts = new Map<string, string>([
      ["arg-01", "new text with no matches"],
      ["arg-02", "here is the current text that still exists in paragraph"],
    ]);

    const stale = findStaleOverrides(overrides, (t) => currentTexts.get(t));
    assert.equal(stale.length, 1);
    assert.equal(stale[0]?.entry.target, "arg-01");
    assert.equal(stale[0]?.reason, "matched-text-not-found");
  });
});
