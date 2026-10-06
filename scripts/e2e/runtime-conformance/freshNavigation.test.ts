/**
 * THE LANE-INDEPENDENT HALF OF THE ISOLATION FIX (am-xyxk).
 *
 * The property this guards - each conformance assertion starts from a new document - can only be
 * observed end to end in Chromium, which is the lane the fix is for. AGENTS.md: "when you write or
 * repair a gate, keep a version of its proof in a DIFFERENT lane from the one it controls", because a
 * proof that lives only downstream of the break disappears exactly when the break happens.
 *
 * So this half runs with no browser and asks the coarser question the helper can be held to: that it
 * performs a document-level navigation and not merely a goto, and that it waits for readiness AFTER
 * that navigation rather than before it. The browser half is the live run, where
 * observer-change-preserves-world is the assertion that notices.
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "playwright";
import { openRuntimeFixture } from "./freshNavigation.ts";

type Call = Readonly<{ name: string; arg?: string }>;

function recordingPage(calls: Call[]): Page {
  return {
    async goto(url: string) {
      calls.push({ name: "goto", arg: url });
      return null;
    },
    async reload() {
      calls.push({ name: "reload" });
      return null;
    },
    async waitForSelector(selector: string) {
      calls.push({ name: "waitForSelector", arg: selector });
      return null;
    },
  } as unknown as Page;
}

test("the helper reloads, so the document is new even when only the fragment changed", async () => {
  const calls: Call[] = [];
  await openRuntimeFixture(recordingPage(calls), "http://127.0.0.1:1/runtime.html#/runtime");
  assert.deepEqual(
    calls.map((c) => c.name),
    ["goto", "reload", "waitForSelector"],
  );
  assert.equal(calls[0]?.arg, "http://127.0.0.1:1/runtime.html#/runtime");
});

test("readiness is awaited after the reload, not before it", async () => {
  // The ordering is the whole point: waiting first would see the PREVIOUS document's ready flag,
  // which is the mechanism that made the old code look like it was isolating checks.
  const calls: Call[] = [];
  await openRuntimeFixture(recordingPage(calls), "http://127.0.0.1:1/runtime.html#/runtime");
  const reloadAt = calls.findIndex((c) => c.name === "reload");
  const waitAt = calls.findIndex((c) => c.name === "waitForSelector");
  assert.ok(reloadAt >= 0 && waitAt >= 0);
  assert.ok(reloadAt < waitAt, "reload must precede the readiness wait");
});

test("the readiness selector is the fixture's ready flag, and is overridable", async () => {
  const calls: Call[] = [];
  await openRuntimeFixture(recordingPage(calls), "u");
  assert.equal(calls.at(-1)?.arg, '[data-reader-root][data-ready="true"]');
  const other: Call[] = [];
  await openRuntimeFixture(recordingPage(other), "u", { readySelector: "#x" });
  assert.equal(other.at(-1)?.arg, "#x");
});

test("PLANTED: a helper that only gotos fails the ordering assertion above", async () => {
  // The negative control. Without it the three tests above would also pass against a helper that
  // never reloaded, provided it happened to call reload for some other reason - and more importantly
  // this records what the broken shape looked like, which was a bare goto followed by a wait.
  const calls: Call[] = [];
  const page = recordingPage(calls);
  await page.goto("http://127.0.0.1:1/runtime.html#/runtime");
  await page.waitForSelector('[data-reader-root][data-ready="true"]');
  assert.equal(
    calls.some((c) => c.name === "reload"),
    false,
  );
  assert.throws(() => {
    const reloadAt = calls.findIndex((c) => c.name === "reload");
    const waitAt = calls.findIndex((c) => c.name === "waitForSelector");
    assert.ok(reloadAt >= 0 && waitAt >= 0);
  });
});
