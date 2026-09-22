import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assessRelativity, LIGHT_ONLY_ORDER, LONGITUDINAL_ORDER, RELATIVITY_CARDS,
  RELATIVITY_MEASUREMENTS, relativityCard, relativityMeasurement, WORKED_RELATIVITY_ORDER,
} from "./specialRelativityInvestigation.ts";
import {
  decodeRelativityLink, emptyRelativitySession, encodeRelativityLink,
  exportRelativitySession, importRelativitySession, parseRelativitySession,
  RELATIVITY_IMPORT_LIMIT, RELATIVITY_LINK_LIMIT, RELATIVITY_NOTE_LIMIT,
  replayRelativitySession,
} from "./specialRelativitySession.ts";

function session(overrides = {}) {
  return { ...emptyRelativitySession(), order: [...WORKED_RELATIVITY_ORDER], ...overrides };
}
function payload(overrides = {}) {
  return { ...JSON.parse(exportRelativitySession(session())), ...overrides };
}

test("empty and premise-only routes make no derived-map claim", () => {
  assert.equal(assessRelativity([]).outcome, "empty");
  assert.equal(assessRelativity(["clocks", "linear-map"]).outcome, "premises-only");
});

test("both light directions establish a family, not gamma or transverse equations", () => {
  assert.equal(assessRelativity(LIGHT_ONLY_ORDER).outcome, "scale-free");
  assert.equal(assessRelativity(LIGHT_ONLY_ORDER).hasBlockedSteps, false);
  assert.equal(assessRelativity(LONGITUDINAL_ORDER).outcome, "longitudinal");
});

test("the full worked reconstruction supports every step", () => {
  const result = assessRelativity(WORKED_RELATIVITY_ORDER);
  assert.equal(result.outcome, "aligned-map");
  assert.ok(result.trace.length > 0);
  assert.ok(result.trace.every((step) => step.status === "supported"));
  assert.equal(result.hasBlockedSteps, false);
});

for (const missing of ["forward-ray", "backward-ray", "inverse", "isotropy", "identity", "transverse-form"]) {
  test(`removing ${missing} prevents a complete aligned-map claim`, () => {
    const result = assessRelativity(WORKED_RELATIVITY_ORDER.filter((id) => id !== missing));
    assert.notEqual(result.outcome, "aligned-map");
    assert.equal(result.hasBlockedSteps, true);
    assert.equal(result.trace.find((entry) => entry.id === "transverse-light").status, "blocked");
  });
}

test("an unsupported predecessor cannot launder support to downstream steps", () => {
  const result = assessRelativity(["normalize", "transverse-form", "transverse-light", "clocks", "linear-map"]);
  assert.equal(result.outcome, "premises-only");
  assert.ok(result.trace.find((entry) => entry.id === "transverse-light").missing.includes("normalize"));
});

test("moving a premise AFTER its use leaves the step blocked until reordered", () => {
  const wrong = ["linear-map", "clocks", ...WORKED_RELATIVITY_ORDER.filter((id) => !["linear-map", "clocks"].includes(id))];
  assert.notEqual(assessRelativity(wrong).outcome, "aligned-map");
  assert.equal(assessRelativity(WORKED_RELATIVITY_ORDER).outcome, "aligned-map");
});

test("independent ray checks can be ordered either way", () => {
  const order = [...WORKED_RELATIVITY_ORDER];
  const forward = order.indexOf("forward-ray");
  const backward = order.indexOf("backward-ray");
  [order[forward], order[backward]] = [order[backward], order[forward]];
  assert.equal(assessRelativity(order).outcome, "aligned-map");
});

test("unknown and duplicate runtime IDs fail instead of pretending to be valid steps", () => {
  assert.throws(() => assessRelativity(["clocks", "clocks"]));
  assert.throws(() => assessRelativity(["toString"]));
  assert.throws(() => relativityCard("__proto__"));
  assert.throws(() => relativityMeasurement("missing"));
});

test("every declared dependency resolves to an earlier card in the worked route", () => {
  for (const card of RELATIVITY_CARDS) {
    for (const needed of card.needs) {
      assert.ok(WORKED_RELATIVITY_ORDER.indexOf(needed) >= 0);
      assert.ok(WORKED_RELATIVITY_ORDER.indexOf(needed) < WORKED_RELATIVITY_ORDER.indexOf(card.id));
    }
  }
});

test("the length trap selects different events on the SAME rest-frame rod", () => {
  const first = relativityMeasurement("same-platform-time");
  const second = relativityMeasurement("same-moving-time");
  assert.equal(first.eventB.x, second.eventB.x);
  assert.equal(first.eventB.x, "10");
  assert.notEqual(first.eventB.t, second.eventB.t);
  assert.equal(first.movingLength, false);
  assert.equal(second.movingLength, true);
  assert.equal(first.eventB.xp, "12.5");
  assert.equal(second.eventB.xp, "8");
});

test("independent arithmetic checks ALL authored event values without a production evaluator", () => {
  // An independent test oracle for the explicitly fixed v/c=0.6, c=1 fixture.
  // The production browser only selects authored records, never runs these laws.
  const beta = 0.6;
  const gamma = 1 / Math.sqrt(1 - beta ** 2);
  assert.equal(gamma, 1.25);
  for (const item of RELATIVITY_MEASUREMENTS) {
    for (const event of [item.eventA, item.eventB]) {
      const { x, t, xp, tp } = Object.fromEntries(Object.entries(event).map(([key, value]) => [key, Number(value)]));
      assert.ok(Math.abs(xp - gamma * (x - beta * t)) < 1e-12, `${item.id}: x'`);
      assert.ok(Math.abs(tp - gamma * (t - beta * x)) < 1e-12, `${item.id}: t'`);
      assert.ok(Math.abs((t * t - x * x) - (tp * tp - xp * xp)) < 1e-12, `${item.id}: interval`);
      assert.ok(Math.abs(x - gamma * (xp + beta * tp)) < 1e-12, `${item.id}: inverse x`);
      assert.ok(Math.abs(t - gamma * (tp + beta * xp)) < 1e-12, `${item.id}: inverse t`);
    }
  }
});

test("full JSON round-trip preserves note and predictions tied to their measurement", () => {
  const original = session({ note: "Private reasoning: α\nDo not put this in a URL.", predictions: { "same-platform-time": "no", "same-moving-time": "yes" } });
  const decoded = importRelativitySession(exportRelativitySession(original));
  assert.equal(decoded.kind, "session");
  assert.deepEqual(decoded.session, original);
  assert.equal(replayRelativitySession(decoded.session).assessment.outcome, "aligned-map");
});

test("a blocked route survives round-trip as blocked rather than being auto-repaired", () => {
  const original = session({ order: ["normalize", "clocks"] });
  const decoded = importRelativitySession(exportRelativitySession(original));
  assert.deepEqual(decoded.session.order, original.order);
  assert.equal(replayRelativitySession(decoded.session).assessment.hasBlockedSteps, true);
});

test("parsed data is copied instead of retaining mutable aliases", () => {
  const original = payload({ predictions: { "same-platform-time": "no" } });
  const result = parseRelativitySession(original);
  original.order.length = 0;
  original.predictions["same-platform-time"] = "yes";
  assert.deepEqual(result.session.order, WORKED_RELATIVITY_ORDER);
  assert.equal(result.session.predictions["same-platform-time"], "no");
});

for (const [label, changes] of [
  ["wrong format", { format: "mass-energy-argument" }],
  ["future version", { version: 2 }],
  ["string version", { version: "1" }],
  ["duplicate cards", { order: ["clocks", "clocks"] }],
  ["unknown card", { order: ["new-card"] }],
  ["not an array", { order: "clocks" }],
  ["unknown measurement", { measurement: "other" }],
  ["wrong prediction value", { predictions: { "same-platform-time": true } }],
  ["unknown prediction key", { predictions: { other: "no" } }],
  ["prediction array", { predictions: [] }],
  ["non-text note", { note: null }],
  ["oversized note", { note: "x".repeat(RELATIVITY_NOTE_LIMIT + 1) }],
  ["forged assessment", { assessment: { outcome: "aligned-map" } }],
]) {
  test(`reject ${label} atomically`, () => assert.equal(parseRelativitySession(payload(changes)).kind, "invalid"));
}

test("reject invalid JSON, overlong input and prototype-shaped keys", () => {
  assert.equal(importRelativitySession("{").kind, "invalid");
  assert.equal(importRelativitySession(" ".repeat(RELATIVITY_IMPORT_LIMIT + 1)).kind, "invalid");
  assert.equal(importRelativitySession(JSON.stringify(payload()).replace('"predictions":{}', '"predictions":{"__proto__":"yes"}')).kind, "invalid");
});

test("accept a note exactly at the limit and an empty argument", () => {
  const original = session({ order: [], note: "x".repeat(RELATIVITY_NOTE_LIMIT) });
  assert.deepEqual(importRelativitySession(exportRelativitySession(original)).session, original);
});

test("public links round-trip choices but exclude ALL private notes and predictions", () => {
  const original = session({ measurement: "one-clock", note: "secret", predictions: { "one-clock": "no" } });
  const encoded = encodeRelativityLink(original);
  assert.ok(!encoded.includes("secret"));
  assert.deepEqual([...new URLSearchParams(encoded).keys()].sort(), ["cards", "example", "sr"]);
  const decoded = decodeRelativityLink(`?${encoded}`);
  assert.deepEqual(decoded.session.order, original.order);
  assert.equal(decoded.session.measurement, original.measurement);
  assert.equal(decoded.session.note, "");
  assert.deepEqual(decoded.session.predictions, {});
});

test("the empty argument has an unambiguous share representation", () => {
  const original = emptyRelativitySession();
  assert.deepEqual(decodeRelativityLink(encodeRelativityLink(original)).session, original);
});

for (const search of [
  "?sr=1", "?cards=clocks", "?sr=2&cards=clocks&example=one-clock",
  "?sr=1&sr=1&cards=clocks&example=one-clock",
  "?sr=1&cards=clocks&cards=&example=one-clock",
  "?sr=1&cards=clocks,clocks&example=one-clock",
  "?sr=1&cards=clocks,&example=one-clock",
  "?sr=1&cards=__proto__&example=one-clock",
  "?sr=1&cards=&example=unknown",
]) {
  test(`reject malformed shared state ${search}`, () => assert.equal(decodeRelativityLink(search).kind, "invalid"));
}

test("an ordinary visit is distinct from an invalid share", () => {
  assert.equal(decodeRelativityLink("").kind, "absent");
  assert.equal(decodeRelativityLink("?utm_source=example").kind, "absent");
  assert.equal(decodeRelativityLink("x".repeat(RELATIVITY_LINK_LIMIT + 1)).kind, "invalid");
});

test("unrelated URL parameters cannot supply private state", () => {
  const decoded = decodeRelativityLink(`${encodeRelativityLink(emptyRelativitySession())}&note=secret&predictions=yes`);
  assert.equal(decoded.kind, "session");
  assert.equal(decoded.session.note, "");
  assert.deepEqual(decoded.session.predictions, {});
});
