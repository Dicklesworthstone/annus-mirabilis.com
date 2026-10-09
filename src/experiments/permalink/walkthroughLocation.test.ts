import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildCheckpointLaunches } from "./checkpointLaunches.ts";
import type { WalkthroughCatalogue } from "./walkthroughCheckpoints.ts";
import {
  readWalkthroughLocation,
  resolveWalkthroughLocation,
  WALKTHROUGH_URL_LIMIT,
  withWalkthroughSelection,
} from "./walkthroughLocation.ts";

const catalogue: WalkthroughCatalogue = {
  walkthroughs: [
    {
      tapeId: "the-boost-to-0.6c",
      experimentId: "sr-03",
      title: "A boost",
      checkpoints: [
        { actionIndex: 0, label: "Start", settings: { v: 0 }, tape: null },
        { actionIndex: 7, label: "Boost", settings: { v: 0.6 }, tape: null },
        { actionIndex: 12, label: "Return", settings: { v: 0 }, tape: null },
      ],
    },
  ],
  problems: [],
};

test("unrelated laboratory links do not request a walkthrough", () => {
  assert.deepEqual(readWalkthroughLocation("?tape=old-link&fromCapstone=mass-energy"), {
    kind: "absent",
  });
});
test("public selection retains the authored nonconsecutive action index", () => {
  const request = readWalkthroughLocation("?walkthrough=the-boost-to-0.6c&stop=7");
  assert.equal(request.kind, "selected");
  if (request.kind !== "selected") return;
  const selected = resolveWalkthroughLocation(request.selection, "sr-03", catalogue);
  assert.equal(selected.kind, "selected");
  if (selected.kind === "selected") assert.equal(selected.index, 1);
});
test("opening instructions can select a walkthrough without applying or requiring a stop", () => {
  assert.deepEqual(readWalkthroughLocation("?walkthrough=the-boost-to-0.6c"), {
    kind: "selected",
    selection: { tapeId: "the-boost-to-0.6c", actionIndex: null },
  });
});
test("malformed, duplicate and unbounded selectors never become a default selection", () => {
  for (const query of [
    "?stop=0",
    "?walkthrough=",
    "?walkthrough=a&walkthrough=a",
    "?walkthrough=a&stop=0&stop=0",
    "?walkthrough=__proto__",
    "?walkthrough=a&stop=01",
    "?walkthrough=a&stop=-1",
    "?walkthrough=a&stop=1e2",
    "?walkthrough=a&stop=1.5",
    "?walkthrough=a&stop=9007199254740992",
    "?walkthrough=a&stop=",
    `?x=${"a".repeat(2048)}`,
  ]) {
    assert.equal(readWalkthroughLocation(query).kind, "invalid", query);
  }
});
test("missing stops, wrong labs and duplicate authored ids refuse instead of choosing first", () => {
  for (const [selection, lab, data] of [
    [{ tapeId: "missing", actionIndex: null }, "sr-03", catalogue],
    [{ tapeId: "the-boost-to-0.6c", actionIndex: 1 }, "sr-03", catalogue],
    [{ tapeId: "the-boost-to-0.6c", actionIndex: 7 }, "me-01", catalogue],
    [
      { tapeId: "the-boost-to-0.6c", actionIndex: 7 },
      "sr-03",
      { ...catalogue, walkthroughs: [...catalogue.walkthroughs, ...catalogue.walkthroughs] },
    ],
  ] as const)
    assert.equal(resolveWalkthroughLocation(selection, lab, data).kind, "invalid");
});
test("encoded settings, source anchors and return context are byte-for-byte preserved", () => {
  const base = "/lab/sr-03/?tape=a%2Fb%2B%3D&x=a+b&fromCapstone=special-relativity#results";
  const linked = withWalkthroughSelection(base, "sr-03", "the-boost-to-0.6c", 7);
  assert.equal(
    linked,
    "/lab/sr-03/?tape=a%2Fb%2B%3D&x=a+b&fromCapstone=special-relativity&walkthrough=the-boost-to-0.6c&stop=7#results",
  );
  assert.equal(withWalkthroughSelection(linked!, "sr-03", "the-boost-to-0.6c", 7), linked);
});
test("a conflicting selection is not replaced or appended", () => {
  const base = "/lab/sr-03/?walkthrough=other&stop=7";
  assert.equal(withWalkthroughSelection(base, "sr-03", "the-boost-to-0.6c", 7), null);
});
test("external and noncanonical paths cannot be turned into laboratory launch links", () => {
  for (const href of [
    "https://evil.test/lab/sr-03/",
    "//evil.test/lab/sr-03/",
    "/lab/me-01/",
    "/lab/sr-03/../me-01/",
    "/lab/sr-03/?x=bad\n",
    "/lab/sr-03/?x=\\bad",
  ]) {
    assert.equal(withWalkthroughSelection(href, "sr-03", "walk"), null, href);
  }
});
test("combined links fit the cap exactly, and an oversize result is not silently downgraded", () => {
  const suffix = "&walkthrough=walk&stop=7";
  const head = "/lab/sr-03/?tape=";
  const href = head + "a".repeat(WALKTHROUGH_URL_LIMIT - head.length - suffix.length);
  assert.equal(withWalkthroughSelection(href, "sr-03", "walk", 7)?.length, WALKTHROUGH_URL_LIMIT);
  assert.equal(withWalkthroughSelection(href + "a", "sr-03", "walk", 7), null);
});
test("every stop is independently rebuilt, so seeking backwards never keeps later settings", () => {
  const before = JSON.stringify(catalogue);
  const observed: unknown[] = [];
  const result = buildCheckpointLaunches(catalogue, (instrumentId, settings) => {
    observed.push(settings.v);
    return {
      status: "ready",
      instrumentId,
      href: `/lab/${instrumentId}/?v=${settings.v}`,
      kind: "form",
    };
  });
  assert.deepEqual(observed, [0, 0.6, 0]);
  assert.equal(result.walkthroughs[0]?.stops[2]?.launch.status, "ready");
  assert.equal(JSON.stringify(catalogue), before, "do not rewrite recorded checkpoints or notes");
  assert.equal(
    JSON.stringify(result).includes('"tape"'),
    false,
    "no historical replay payload gets relabelled",
  );
});
test("an owner refusal remains a named stop rather than disappearing", () => {
  const result = buildCheckpointLaunches(catalogue, (instrumentId, settings) =>
    settings.v === 0.6
      ? { status: "unavailable", instrumentId, reason: "Owner refused this state" }
      : { status: "ready", instrumentId, href: `/lab/${instrumentId}/`, kind: "session" },
  );
  assert.deepEqual(
    result.walkthroughs[0]?.stops.map((stop) => stop.launch.status),
    ["ready", "unavailable", "ready"],
  );
  assert.equal(result.walkthroughs[0]?.stops[1]?.label, "Boost");
});
test("a wrong-owner builder or oversized complete URL cannot earn a ready launch", () => {
  for (const build of [
    () => ({
      status: "ready" as const,
      instrumentId: "me-01",
      href: "/lab/me-01/",
      kind: "session" as const,
    }),
    () => ({
      status: "ready" as const,
      instrumentId: "sr-03",
      href: `/lab/sr-03/?tape=${"a".repeat(2020)}`,
      kind: "form" as const,
    }),
  ])
    assert.ok(
      buildCheckpointLaunches(catalogue, build).walkthroughs.every((entry) =>
        entry.stops.every((stop) => stop.launch.status === "unavailable"),
      ),
    );
});
