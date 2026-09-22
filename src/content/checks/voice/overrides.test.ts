import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { isOverridden } from "./check.ts";
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

describe("overrides: a target names exactly one record (am-s64j)", () => {
  const entry = {
    target: "text",
    rule: "overclaim",
    matchedText: "proves",
    reason: "reviewed",
    reviewer: "pane31",
    date: "2026-09-20",
  } as unknown as VoiceOverrideEntry;

  it("an override does not travel to every record path ending in its target", () => {
    // Before am-s64j the predicate also accepted target.endsWith(o.target), so an override
    // declared for "text" suppressed readings.margin[0].text and every other record ending in it.
    for (const recordId of ["readings.margin[0].text", "notes[6].explanation.text", "other.text"]) {
      assert.equal(isOverridden([entry], recordId, "overclaim", "this proves it"), false);
    }
  });

  it("an override still applies to the record id it names exactly", () => {
    assert.equal(isOverridden([entry], "text", "overclaim", "this proves it"), true);
  });

  /**
   * The arm that was missing, and the reason am-s64j's repair did not hold where it mattered.
   *
   * scripts/lint-voice.ts carried its OWN copy of isOverridden, and that copy still had the
   * bidirectional endsWith disjuncts this suite removed from check.ts. The unit tests above
   * passed the whole time, because they exercise the repaired copy, while the corpus scan that
   * produces the numbers everyone quotes ran the vulnerable one. Measured on 2026-09-22 before
   * the duplicate was deleted: a single override entry with
   *
   *     target: tsx
   *
   * three characters, took the lint run from 11 flags to 6 - every status-enum-leak finding in
   * every .tsx file, suppressed by a suffix. After the deletion the same entry changes nothing
   * and an exact path target still works, 11 -> 10.
   *
   * This assertion is deliberately about the SOURCE of the runner rather than its behaviour.
   * The behavioural half is the four tests above; this is the half that notices a second copy
   * appearing again, which is the failure those four cannot see from inside check.ts.
   */
  it("the lint runner uses this predicate and does not define its own", () => {
    const runner = readFileSync(
      join(
        // Five levels: voice -> checks -> content -> src -> repository root.
        dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))))),
        "scripts/lint-voice.ts",
      ),
      "utf8",
    );
    assert.ok(
      /import \{[^}]*\bisOverridden\b[^}]*\} from "\.\.\/src\/content\/checks\/voice\/check\.ts"/.test(
        runner,
      ),
      "scripts/lint-voice.ts must import isOverridden from check.ts",
    );
    assert.ok(
      !/function isOverridden\s*\(/.test(runner),
      "scripts/lint-voice.ts declares its own isOverridden again; am-s64j's repair lives in check.ts and a second copy will not receive the next one either",
    );
  });
});
