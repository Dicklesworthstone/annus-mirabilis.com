import assert from "node:assert/strict";
import { test } from "node:test";
import { GUIDED_TOURS, getGuidedTour, getTourStop } from "./catalogue.ts";
import {
  adjacentTourPosition, decodeTourPosition, leaveTourHref, resolveTourPosition,
  TOUR_LINK_LIMIT, tourDestination, tourMatchesPath, tourOutline, tourPosition,
} from "./navigation.ts";

const tour = getGuidedTour("special-relativity");
const first = tourPosition(tour, tour.stops[0]);

test("tour identities are unique, and every route has a usable beginning and end", () => {
  assert.ok(GUIDED_TOURS.length > 0);
  assert.equal(new Set(GUIDED_TOURS.map((item) => item.id)).size, GUIDED_TOURS.length);
  for (const item of GUIDED_TOURS) {
    assert.ok(item.stops.length > 1);
    assert.ok(Number.isSafeInteger(item.revision) && item.revision > 0);
    assert.equal(item.stops.at(-1).href, `/papers/${item.paper}/`);
    assert.equal(item.stops[0].href, `/papers/${item.paper}/#entry-${item.paper}`);
    assert.equal(new Set(item.stops.map((stop) => stop.id)).size, item.stops.length);
    for (const stop of item.stops) {
      assert.match(stop.id, /^[a-z]+(?:-[a-z]+)*$/);
      assert.ok(stop.task.trim() && stop.question.endsWith("?") && stop.explanation.trim());
      assert.ok(["read", "experiment", "reconstruct"].includes(stop.activity));
      assert.match(stop.href, /^\/(?:papers|lab|discover)\/[a-z0-9/-]+(?:#[a-z0-9-]+)?$/);
    }
  }
});

for (const item of GUIDED_TOURS) {
  test(`${item.id}: every stop has a reversible public position and retains its anchor`, () => {
    for (const stop of item.stops) {
      const position = tourPosition(item, stop);
      const url = new URL(tourDestination(position), "https://example.test");
      assert.deepEqual(decodeTourPosition(url.search), { kind: "position", position });
      assert.equal(url.hash, new URL(stop.href, url).hash);
      assert.equal(url.pathname, new URL(stop.href, url).pathname);
      assert.equal(tourOutline(position), `/tours/${item.id}/#tour-stop-${stop.id}`);
      assert.equal(resolveTourPosition(position).stop, stop);
      assert.deepEqual([...url.searchParams.keys()].sort(), ["tour", "tourRevision", "tourStop"]);
    }
  });
  test(`${item.id}: next/back are exact inverses, and traversal ends rather than wrapping`, () => {
    let position = tourPosition(item, item.stops[0]);
    assert.equal(adjacentTourPosition(position, -1), null);
    const seen = [];
    while (position) {
      const selected = resolveTourPosition(position);
      assert.ok(!seen.includes(selected.stop.id), "Navigation must not cycle.");
      seen.push(selected.stop.id);
      const next = adjacentTourPosition(position, 1);
      if (next) assert.deepEqual(adjacentTourPosition(next, -1), position);
      position = next;
    }
    assert.deepEqual(seen, item.stops.map((stop) => stop.id));
  });
}

test("a normal URL is not a malformed tour", () => {
  assert.deepEqual(decodeTourPosition(""), { kind: "absent" });
  assert.deepEqual(decodeTourPosition("?view=german&beta=0.6"), { kind: "absent" });
});

for (const query of [
  "?tour=special-relativity",
  "?tourStop=flash",
  "?tourRevision=1",
  "?tour=special-relativity&tourStop=flash",
  "?tour=special-relativity&tourStop=flash&tourRevision=01",
  "?tour=special-relativity&tourStop=flash&tourRevision=2",
  "?tour=special-relativity&tourStop=flash&tourRevision=1.0",
  "?tour=__proto__&tourStop=flash&tourRevision=1",
  "?tour=special-relativity&tourStop=__proto__&tourRevision=1",
  "?tour=mass-energy&tourStop=flash&tourRevision=1",
  "?tour=special-relativity&tour=special-relativity&tourStop=flash&tourRevision=1",
  "?tour=special-relativity&tourStop=flash&tourStop=flash&tourRevision=1",
  "?tour=special-relativity&tourStop=flash&tourRevision=1&tourRevision=1",
  "?tour=special-relativity&tourStop=%00flash&tourRevision=1",
]) {
  test(`malformed public position refuses atomically: ${query}`, () => {
    assert.equal(decodeTourPosition(query).kind, "invalid");
  });
}

test("overlong query refuses before decoding", () => {
  assert.equal(decodeTourPosition("x".repeat(TOUR_LINK_LIMIT + 1)).kind, "invalid");
});

test("no free-form URL, note, prediction or completion assertion can affect navigation", () => {
  const query = new URL(tourDestination(first), "https://example.test").search;
  const parsed = decodeTourPosition(`${query}&redirect=https://evil.test&note=private&completed=true`);
  assert.deepEqual(parsed, { kind: "position", position: first });
  assert.ok(!tourDestination(parsed.position).includes("evil"));
  assert.ok(!tourDestination(parsed.position).includes("private"));
});

test("a guide never describes a different laboratory", () => {
  const position = tourPosition(tour, getTourStop(tour, "construct"));
  assert.equal(tourMatchesPath(position, "/lab/sr-04/"), true);
  assert.equal(tourMatchesPath(position, "/lab/sr-04"), true);
  assert.equal(tourMatchesPath(position, "/lab/sr-03/"), false);
  assert.equal(tourMatchesPath(position, "/lab/sr-04-extra/"), false);
});

test("leaving preserves unrelated repeated parameters and the exact source anchor", () => {
  const result = leaveTourHref("/papers/special-relativity/", "?tour=special-relativity&view=german&open=x&open=y&tourStop=flash&tourRevision=1", "#entry-special-relativity");
  const url = new URL(result, "https://example.test");
  assert.equal(url.searchParams.get("view"), "german");
  assert.deepEqual(url.searchParams.getAll("open"), ["x", "y"]);
  for (const key of ["tour", "tourStop", "tourRevision"]) assert.equal(url.searchParams.has(key), false);
  assert.equal(url.hash, "#entry-special-relativity");
});

test("leaving an otherwise bare URL does not add a question mark", () => {
  assert.equal(leaveTourHref("/lab/me-01/", "?tour=mass-energy&tourStop=ledgers&tourRevision=1", ""), "/lab/me-01/");
});

for (const path of ["https://evil.test/", "//evil.test/", "/\\evil.test/", "/lab/?x=1", "/lab/#x", "/lab/\n"]) {
  test(`leaving refuses a non-local or ambiguous path ${JSON.stringify(path)}`, () => {
    assert.throws(() => leaveTourHref(path, "", ""));
  });
}

test("unknown positions cannot produce navigation destinations", () => {
  for (const position of [
    { ...first, tourId: "unknown" }, { ...first, stopId: "unknown" }, { ...first, revision: 2 },
  ]) {
    assert.equal(resolveTourPosition(position), null);
    assert.equal(adjacentTourPosition(position, 1), null);
    assert.equal(tourMatchesPath(position, "/papers/special-relativity/"), false);
    assert.equal(tourOutline(position), "/tours/");
    assert.throws(() => tourDestination(position));
  }
  assert.equal(getGuidedTour("constructor"), null);
  assert.equal(getTourStop(tour, "constructor"), null);
});
