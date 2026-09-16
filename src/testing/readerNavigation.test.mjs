import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { READER_PREPAINT } from "../reader/detail/prepaint.ts";
import {
  DETAIL_STORAGE_KEY,
  MAX_CLARIFICATION_DEPTH,
  openFoundation,
  parseReaderLocation,
  passageHref,
  readerHref,
  restoreReaderState,
} from "../reader/navigation/state.ts";

const registry = {
  paperId: "brownian-motion",
  anchors: ["arg-bm-observable", "arg-bm-independent-steps"],
  foundations: ["mean-variance-rms", "bridge-sum-average"],
};
test("reader URL parsing respects valid explicit detail before storage and ignores duplicate or unknown values", () => {
  assert.equal(
    parseReaderLocation("?detail=steps", "#arg-bm-independent-steps", registry, "0").detail,
    2,
  );
  assert.equal(parseReaderLocation("?detail=2&detail=0", "#%zz", registry, "0").detail, 0);
  assert.equal(parseReaderLocation("?view=evil&open=term:evil", "", registry).view, "reading");
  assert.equal(
    parseReaderLocation("?open=foundation:mean-variance-rms", "", registry).frames.length,
    1,
  );
  assert.equal(parseReaderLocation("?open=foundation:absent", "", registry).frames.length, 0);
});
test("prepaint uses the same aliases and storage key, including blocked storage and prototype-shaped input", () => {
  for (const [search, stored, want] of [
    ["?detail=steps", "0", "2"],
    ["?detail=0", "2", "0"],
    ["?detail=constructor", "2", "2"],
    ["?detail=bad", null, "1"],
    ["?detail=2&detail=0", "1", "1"],
    ["?detail=steps&pad=" + "x".repeat(4096), "0", "0"],
  ]) {
    const document = { documentElement: { dataset: {} } };
    vm.runInNewContext(READER_PREPAINT, {
      URLSearchParams,
      location: { search },
      document,
      localStorage: {
        getItem(key) {
          assert.equal(key, DETAIL_STORAGE_KEY);
          if (stored === null) throw Error("blocked");
          return stored;
        },
      },
    });
    assert.equal(document.documentElement.dataset.detail, want);
  }
});
test("prepaint sets data-view (not data-readerView) and knows the full eight-face set", () => {
  for (const [search, want] of [
    ["?view=split", "split"],
    ["?view=facsimile", "facsimile"],
    ["?view=bogus", "reading"],
    ["", "reading"],
  ]) {
    const document = { documentElement: { dataset: {} } };
    vm.runInNewContext(READER_PREPAINT, {
      URLSearchParams,
      location: { search },
      document,
      localStorage: { getItem: () => null },
    });
    assert.equal(document.documentElement.dataset.view, want);
    assert.equal(document.documentElement.dataset.readerView, undefined);
  }
});
test("passage links use only public axes while clarification links expose only their last level", () => {
  const s = parseReaderLocation(
    "?detail=2&view=results&lens=modern&note=secret&tape=private",
    "#arg-bm-observable",
    registry,
  );
  assert.equal(
    passageHref(registry, s),
    "/papers/brownian-motion/?view=results&detail=2&lens=modern#arg-bm-observable",
  );
  const next = openFoundation(
    s,
    { foundationId: "mean-variance-rms", triggerId: "private-focus-id", relativeY: 0.3 },
    registry,
  );
  assert.match(readerHref(registry, next), /open=foundation%3Amean-variance-rms/);
  assert.ok(!readerHref(registry, next).includes("private"));
});
test("clarifications are immutable, bounded and never accept unregistered content", () => {
  let s = parseReaderLocation("", "", registry);
  const first = s;
  for (let i = 0; i < 20; i++)
    s = openFoundation(
      s,
      { foundationId: "mean-variance-rms", triggerId: String(i), relativeY: 0 },
      registry,
    );
  assert.equal(s.frames.length, MAX_CLARIFICATION_DEPTH);
  assert.equal(s.frames.at(-1).triggerId, "19");
  assert.equal(first.frames.length, 0);
  assert.throws(() =>
    openFoundation(s, { foundationId: "unknown", triggerId: "x", relativeY: 0 }, registry),
  );
});
test("history restoration validates frame identity, budgets and coordinates", () => {
  const s = parseReaderLocation("?open=foundation:mean-variance-rms", "", registry);
  assert.deepEqual(restoreReaderState(s, registry), s);
  for (const x of [
    { ...s, anchor: "missing" },
    { ...s, frames: [{ foundationId: "missing" }] },
    { ...s, frames: Array(13).fill(s.frames[0]) },
    { ...s, frames: [{ ...s.frames[0], relativeY: NaN }] },
  ])
    assert.equal(restoreReaderState(x, registry), null);
});
