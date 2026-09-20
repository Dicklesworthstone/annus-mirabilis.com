import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  type AcknowledgedStash,
  ageInDays,
  parseStashList,
  reviewStashes,
} from "./stashInventory.ts";

/**
 * These tests feed SYNTHETIC inventories rather than creating real stashes, and that is a
 * constraint rather than a convenience: making a stash to test the gate would mean dropping it
 * afterwards, and dropping is the owner's decision under AGENTS.md Rule 1. Separating the parse
 * and compare from the git call is what makes the check testable without touching the stash list.
 */
describe("am-70ig: the stash inventory ratchet", () => {
  const HERE = new URL(".", import.meta.url).pathname;
  const baseline = JSON.parse(
    readFileSync(join(HERE, "acknowledgedStashes.json"), "utf8"),
  ) as AcknowledgedStash[];

  // The real format, verbatim from `git stash list --format=%H|%cI|%gs`.
  const line = (sha: string, when: string, subject: string) => `${sha}|${when}|${subject}`;

  it("parses the real git stash list format, including a subject containing a pipe", () => {
    const entries = parseStashList(
      [
        line("a".repeat(40), "2026-09-16T01:58:34-04:00", "On main: autostash"),
        line("b".repeat(40), "2026-09-17T08:48:34-04:00", "WIP on main: a|piped subject"),
        "",
      ].join("\n"),
    );
    assert.equal(entries.length, 2);
    assert.equal(entries[0]?.subject, "On main: autostash");
    // A stash subject can contain the delimiter; the rest of the line is the subject.
    assert.equal(entries[1]?.subject, "WIP on main: a|piped subject");
  });

  it("is silent when there are no stashes at all, which is every machine but the one that made them", () => {
    const report = reviewStashes([], baseline);
    assert.deepEqual(report.unacknowledged, []);
    assert.equal(report.acknowledgedPresent, 0);
    // Every baseline entry is stale on a clean machine, and that must not be an error: a stash
    // ref is local, so a second machine legitimately has none of them.
    assert.equal(report.stale.length, baseline.length);
  });

  it("the five reviewed stashes do not fail the gate", () => {
    const entries = baseline.map((b) => ({
      sha: b.sha,
      committedAt: `${b.date}T00:00:00Z`,
      subject: "reviewed under am-8wv8",
    }));
    const report = reviewStashes(entries, baseline);
    assert.deepEqual(report.unacknowledged, []);
    assert.deepEqual(report.stale, []);
    assert.equal(report.acknowledgedPresent, 5);
  });

  it("PLANTED NEGATIVE: a sixth, unreviewed stash fails on the day it is made", () => {
    // Without this the ratchet would be indistinguishable from a check that always passes, which
    // is what the repository had before: nothing looked at the stash list at all.
    const entries = [
      ...baseline.map((b) => ({
        sha: b.sha,
        committedAt: `${b.date}T00:00:00Z`,
        subject: "known",
      })),
      {
        sha: "f".repeat(40),
        committedAt: "2026-09-20T03:00:00Z",
        subject: "WIP on main: new work",
      },
    ];
    const report = reviewStashes(entries, baseline);
    assert.equal(report.unacknowledged.length, 1);
    assert.equal(report.unacknowledged[0]?.sha, "f".repeat(40));
    assert.equal(report.unacknowledged[0]?.subject, "WIP on main: new work");
  });

  it("PLANTED NEGATIVE: acknowledging by SHA, not by count, so a swap is still caught", () => {
    // A count-based ratchet would pass this: five before, five after. The sixth stash replaced a
    // reviewed one, and its content has never been looked at.
    const swapped = [
      ...baseline.slice(1).map((b) => ({
        sha: b.sha,
        committedAt: `${b.date}T00:00:00Z`,
        subject: "known",
      })),
      { sha: "c".repeat(40), committedAt: "2026-09-20T03:00:00Z", subject: "WIP on main: swapped" },
    ];
    assert.equal(swapped.length, baseline.length);
    const report = reviewStashes(swapped, baseline);
    assert.equal(report.unacknowledged.length, 1, "the unreviewed entry is reported");
    assert.equal(report.stale.length, 1, "and the dropped one is reported as stale");
  });

  it("reports the age in whole days, so a four-day-old leftover reads differently from a fresh one", () => {
    const now = new Date("2026-09-20T03:00:00Z");
    // 2026-09-16T01:58:34-04:00 is 05:58:34Z, so the span to 03:00Z on the 20th is 3 days and
    // 21 hours. floor() gives 3, not 4 - my first assertion said 4 and this test caught it.
    assert.equal(ageInDays("2026-09-16T01:58:34-04:00", now), 3);
    assert.equal(ageInDays("2026-09-20T02:00:00Z", now), 0);
    assert.ok(Number.isNaN(ageInDays("not a date", now)));
  });

  it("every acknowledged entry records what the review concluded and under which bead", () => {
    // An acknowledgement without a verdict is an exemption, not a review. Same reason
    // voice-overrides.yaml refuses an entry with no reason or reviewer.
    for (const entry of baseline) {
      assert.match(entry.sha, /^[0-9a-f]{40}$/, "a full commit id, so the entry survives a drop");
      assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(entry.verdict.length > 40, `verdict too short to be a review: ${entry.sha}`);
      assert.match(entry.reviewedUnder, /^am-/);
    }
  });
});
