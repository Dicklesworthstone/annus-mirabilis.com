import assert from "node:assert/strict";
import test from "node:test";
import { findMislabeledPaint } from "./rafSampler.ts";

test("rAF sampler detects a planted intermediate value painted under a newer label", () => {
  const planted = findMislabeledPaint([
    { value: 1, labeledRevision: 1, acceptedRevision: 1 },
    { value: 1.5, labeledRevision: 3, acceptedRevision: 2 },
  ]);
  assert.ok(planted);
  assert.equal(planted.value, 1.5);
});

test("rAF sampler accepts paints whose label matches the accepted revision", () => {
  assert.equal(
    findMislabeledPaint([{ value: 2, labeledRevision: 2, acceptedRevision: 2 }]),
    undefined,
  );
});
