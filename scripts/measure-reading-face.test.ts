import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import {
  formatReadingFaceBudgetMessage,
  measureReadingFace,
  READING_FACE_BUDGET_BYTES,
} from "./measure-reading-face.ts";

test("a small, highly repetitive HTML fixture is well within budget", () => {
  const html = '<p data-reading="1">hello</p>'.repeat(50);
  const result = measureReadingFace(html);
  assert.equal(result.overBudget, false);
  assert.ok(result.gzipBytes < result.rawBytes, "repetitive text should compress");
  assert.equal(result.budgetBytes, READING_FACE_BUDGET_BYTES);
});

test("raw byte count is UTF-8 bytes, not UTF-16 code units", () => {
  const html = "über die Lichterzeugung"; // "ü" is one UTF-16 unit but two UTF-8 bytes
  const result = measureReadingFace(html);
  assert.equal(result.rawBytes, Buffer.byteLength(html, "utf8"));
  assert.notEqual(result.rawBytes, html.length);
});

test("a high-entropy fixture large enough to exceed the budget is reported over budget", () => {
  // Random bytes are effectively incompressible, so base64-encoding enough of
  // them reliably produces gzip output well past the budget regardless of
  // the exact compression ratio gzip achieves on any particular run.
  const html = randomBytes(300_000).toString("base64");
  const result = measureReadingFace(html);
  assert.equal(result.overBudget, true);
  assert.ok(result.gzipBytes > result.budgetBytes);
});

test("a custom budget is honored instead of the default", () => {
  const html = "x".repeat(1000);
  const result = measureReadingFace(html, 10);
  assert.equal(result.budgetBytes, 10);
  assert.equal(result.overBudget, true);
});

test("overBudget is strictly greater than, not greater-or-equal: a fixture at exactly the budget passes", () => {
  const html = "y";
  const gzipBytes = measureReadingFace(html).gzipBytes;
  const result = measureReadingFace(html, gzipBytes);
  assert.equal(result.overBudget, false);
});

test("measuring the same input twice is deterministic", () => {
  const html = '<p data-reading="2">some steps, spelled out</p>'.repeat(200);
  const first = measureReadingFace(html);
  const second = measureReadingFace(html);
  assert.deepEqual(first, second);
});

test("an empty document is within budget and reports zero bytes", () => {
  const result = measureReadingFace("");
  assert.equal(result.rawBytes, 0);
  assert.equal(result.overBudget, false);
});

test("formatReadingFaceBudgetMessage names the label and both byte counts when over budget", () => {
  const result = measureReadingFace("x".repeat(1000), 10);
  const message = formatReadingFaceBudgetMessage("papers/brownian-motion", result);
  assert.match(message, /papers\/brownian-motion/);
  assert.match(message, new RegExp(String(result.gzipBytes)));
  assert.match(message, /exceeds the 10 byte budget/);
});

test("formatReadingFaceBudgetMessage reports headroom, not a violation, when within budget", () => {
  const result = measureReadingFace("<p>fine</p>");
  const message = formatReadingFaceBudgetMessage("papers/mass-energy", result);
  assert.match(message, /within the/);
  assert.doesNotMatch(message, /exceeds/);
});
