import assert from "node:assert/strict";
import test from "node:test";
import { type AddressableUnit, nearestStableAnchor } from "./nearestStableAnchor.ts";

const VIEWPORT = 1000; // band = [0, 400)

test("an empty list returns undefined when no URL anchor is given", () => {
  assert.equal(nearestStableAnchor([], VIEWPORT), undefined);
});

test("a URL anchor wins over the computed value even with an empty list", () => {
  assert.equal(nearestStableAnchor([], VIEWPORT, "p-3"), "p-3");
});

test("a URL anchor wins over the computed value even with a non-empty, intersecting list", () => {
  const units: AddressableUnit[] = [{ id: "p-1", top: 0, height: 50 }];
  assert.equal(nearestStableAnchor(units, VIEWPORT, "p-9"), "p-9");
});

test("returns undefined when no unit intersects the top 40 percent", () => {
  const units: AddressableUnit[] = [
    { id: "above", top: -500, height: 50 }, // fully above the viewport
    { id: "below", top: 401, height: 50 }, // fully below the band
  ];
  assert.equal(nearestStableAnchor(units, VIEWPORT), undefined);
});

test("returns the deepest unit intersecting the band, not merely the first", () => {
  const units: AddressableUnit[] = [
    { id: "p-1", top: 0, height: 50 },
    { id: "p-2", top: 100, height: 50 },
    { id: "p-3", top: 350, height: 50 }, // deepest: greatest top still within [0, 400)
  ];
  assert.equal(nearestStableAnchor(units, VIEWPORT), "p-3");
});

test("a unit that only partially overlaps the band's far edge still counts", () => {
  const units: AddressableUnit[] = [
    { id: "p-1", top: 0, height: 50 },
    { id: "p-2", top: 390, height: 100 }, // starts inside the band, extends past it
  ];
  assert.equal(nearestStableAnchor(units, VIEWPORT), "p-2");
});

test("a unit whose rectangle straddles the viewport top counts as intersecting", () => {
  const units: AddressableUnit[] = [{ id: "p-0", top: -20, height: 40 }];
  assert.equal(nearestStableAnchor(units, VIEWPORT), "p-0");
});

test("ties on top resolve to the earlier unit in document order", () => {
  const units: AddressableUnit[] = [
    { id: "first", top: 100, height: 0 },
    { id: "second", top: 100, height: 20 },
  ];
  assert.equal(nearestStableAnchor(units, VIEWPORT), "first");
});

test("document order, not array order by top, decides ties: a later-indexed equal-top unit never wins", () => {
  const units: AddressableUnit[] = [
    { id: "earlier-in-list", top: 200, height: 10 },
    { id: "later-in-list-same-top", top: 200, height: 10 },
    { id: "actually-deepest", top: 250, height: 10 },
  ];
  assert.equal(nearestStableAnchor(units, VIEWPORT), "actually-deepest");
});
