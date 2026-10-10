/**
 * ROW 9: "Changing observer means starting a new experiment" (am-ver-adversarial-audit-1ef).
 *
 * The owner is `checkCommandInvariants`, which is pure TypeScript, so this row needs no browser. An
 * earlier note on the bead assumed it did; the invariant checker takes a pre-state, a post-state and
 * a command, and the whole of the observer-change contract is decidable from those three.
 *
 * WHAT THE ROW CLAIMS, AND WHAT IT FOUND. The claim is that re-describing the world restarts it, and
 * the checker refuses that on `runId`. Writing the fixture turned up something sharper, which the
 * last three tests carry: the clause that is actually hard to get right is `digests.eventSetDigest`,
 * because there are TWO ways to recompute it and the careful one is the dangerous one.
 *
 *   (a) digest the events as described in the new frame -- the digest changes wholesale;
 *   (b) digest a mathematically INVARIANT quantity, recomputed in the new frame -- the digest
 *       changes in the last bits, while the physics agrees to about 1e-15.
 *
 * (b) is correct physics and a wrong digest. Its symptom is an invariant violation on a command that
 * really was an observer change, and the tempting repair is to compare digests with a tolerance,
 * which a hash cannot do. The runtime contract already rules on it: bitwise identity is not promised
 * across architectures, and every comparison must say whether it is bitwise or tolerance-based. So an
 * observer change CARRIES the digest forward and never recomputes it. The last test asserts that the
 * carried-forward digest is what passes.
 *
 * WHERE THE FIXTURE CANNOT DISCRIMINATE, stated rather than discovered later, as in rows 7 and 11:
 *
 *   - at beta = 0 the boost is the identity, so every field set survives it and no digest choice is
 *     wrong. A fixture built at rest proves nothing about any of this.
 *   - a pure origin offset is exact in binary64 for these coordinates, so the recomputed invariant
 *     digest survives it bitwise. Having watched (b) pass under a translation licenses nothing about
 *     a boost, and that is precisely how (b) gets written.
 *   - with zero draws consumed and no digests recorded, the pre-state and the post-state of the WRONG
 *     implementation agree on both clauses, and the checker accepts it. `drawCounters: { latent: 0 }`
 *     is therefore not a fixture, and `src/testing/adversarialObserver.test.ts` is built that way.
 */
import { describe, expect, test } from "bun:test";
import {
  checkCommandInvariants,
  type ExecutionStateSnapshot,
  InvariantViolationError,
} from "../../experiments/commands/invariants.ts";
import type { TypedCommand } from "../../experiments/commands/types.ts";
import { eventSetDigest } from "../../experiments/digest/scientificDigest.ts";
import { lorentzBoost, type SpacetimeEvent } from "../runtime-fixtures/eventLedgerFixture.ts";
import {
  type DescribedEvent,
  type ObserverStateLike,
  wrongFrameDependentEventFields,
  wrongObserverChangeAsSetup,
  wrongRecomputedInvariantEventFields,
} from "./wrongComputations.ts";

/** The ledger the runtime fixture describes, in its own rest frame. */
const REST_EVENTS: readonly SpacetimeEvent[] = Object.freeze([
  Object.freeze({ id: "event-origin-emission", t: 0, x: 0, y: 0, z: 0 }),
  Object.freeze({ id: "event-sensor-trigger", t: 1, x: 0.5, y: 0, z: 0 }),
  Object.freeze({ id: "event-absorber-impact", t: 2, x: 0.8, y: 0, z: 0 }),
  Object.freeze({ id: "event-echo-detection", t: 3, x: 0.2, y: 0, z: 0 }),
]);

const BOOST = 0.6;

/** An origin offset: the other kind of observer change the runtime contract names. */
function translate(
  events: readonly DescribedEvent[],
  [dt, dx, dy, dz]: readonly [number, number, number, number],
): DescribedEvent[] {
  return events.map((e) => ({ id: e.id, t: e.t + dt, x: e.x + dx, y: e.y + dy, z: e.z + dz }));
}

const digestOf = async (fields: Record<string, unknown>) =>
  (await eventSetDigest(fields as Parameters<typeof eventSetDigest>[0])).digest;

/** A pre-state that can actually discriminate: real digests, and draws already consumed. */
async function restingState(): Promise<ExecutionStateSnapshot> {
  return {
    instanceId: "inst-sr-03-row09",
    runId: "inst-sr-03-row09/run/1",
    parentRunId: null,
    actionIndex: 1,
    stepIndex: 50,
    simulatedTime: 5,
    revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
    digests: {
      eventSetDigest: await digestOf(wrongFrameDependentEventFields(REST_EVENTS)),
      worldlineDigest: "host:sha256:worldlines-of-run-1",
    },
    // Not zero. See the header: zero draws make the zero-draw clause undecidable.
    drawCounters: { latent: 4096, measurement: 512 },
  };
}

const observerChange: TypedCommand = Object.freeze({
  commandId: "cmd-sr-03-frame-slider",
  instanceId: "inst-sr-03-row09",
  actionIndex: 2,
  class: "observer-change" as const,
  payload: Object.freeze({ velocityRatio: BOOST }),
});

/** What the frame control must produce: a new description of the same world. */
function correctObserverPost(pre: ExecutionStateSnapshot): ExecutionStateSnapshot {
  return {
    ...pre,
    actionIndex: pre.actionIndex + 1,
    revisions: { ...pre.revisions, observer: pre.revisions.observer + 1 },
  };
}

/** Production mode returns the violation instead of throwing, so each assertion is unconditional. */
const check = (pre: ExecutionStateSnapshot, post: ExecutionStateSnapshot) =>
  checkCommandInvariants(pre, post, observerChange, { isProduction: true });

describe("row 9: changing observer means starting a new experiment", () => {
  test("the paired half: a correct observer change is accepted", async () => {
    const pre = await restingState();
    expect(check(pre, correctObserverPost(pre)).ok).toBe(true);
  });

  test("the row's claim: the frame control dispatched as a setup-change is refused on runId", async () => {
    const pre = await restingState();
    const wrong = wrongObserverChangeAsSetup(pre) as ExecutionStateSnapshot;
    const result = check(pre, { ...wrong, instanceId: pre.instanceId });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable: asserted false above");
    expect(result.violation.commandClass).toBe("observer-change");
    // `runId` is the first clause in the observer-change case, so this field is deterministic.
    expect(result.violation.field).toBe("runId");
    expect(result.outcome.outcome).toBe("invariant-violation");
    // The wrong implementation really did fork, restart, re-draw and re-digest -- all four, so the
    // fixture is not relying on a single typo.
    expect(wrong.runId).not.toBe(pre.runId);
    expect(wrong.stepIndex).toBe(0);
    expect(wrong.revisions.input).toBe(pre.revisions.input + 1);
    expect(wrong.drawCounters.latent).toBe(8192);
    expect(wrong.digests.eventSetDigest).not.toBe(pre.digests.eventSetDigest);
  });

  test("in the development build the same defect throws, naming the class and the field", async () => {
    const pre = await restingState();
    const wrong = wrongObserverChangeAsSetup(pre) as ExecutionStateSnapshot;
    let thrown: unknown;
    try {
      checkCommandInvariants(pre, { ...wrong, instanceId: pre.instanceId }, observerChange);
    } catch (error) {
      thrown = error;
    }
    // Asserted outside the catch, so a checker that stopped throwing fails this test instead of
    // skipping it. The conditional-catch shape is how a regression here would go unnoticed.
    expect(thrown).toBeInstanceOf(InvariantViolationError);
    expect((thrown as InvariantViolationError).commandClass).toBe("observer-change");
    expect((thrown as InvariantViolationError).field).toBe("runId");
  });

  test("each clause of the observer contract is refused on its own field", async () => {
    const pre = await restingState();
    const ok = correctObserverPost(pre);
    const cases: readonly Readonly<{ field: string; post: ExecutionStateSnapshot }>[] = [
      { field: "runId", post: { ...ok, runId: `${pre.runId}-again` } },
      { field: "stepIndex", post: { ...ok, stepIndex: 0 } },
      {
        field: "revisions.observer",
        post: { ...ok, revisions: { ...pre.revisions } },
      },
      {
        field: "revisions.input",
        post: { ...ok, revisions: { ...ok.revisions, input: pre.revisions.input + 1 } },
      },
      {
        field: "revisions.measurement",
        post: { ...ok, revisions: { ...ok.revisions, measurement: pre.revisions.measurement + 1 } },
      },
      {
        field: "revisions.estimator",
        post: { ...ok, revisions: { ...ok.revisions, estimator: pre.revisions.estimator + 1 } },
      },
      {
        field: "digests.eventSetDigest",
        post: { ...ok, digests: { ...ok.digests, eventSetDigest: "host:sha256:recomputed" } },
      },
      {
        field: "digests.worldlineDigest",
        post: { ...ok, digests: { ...ok.digests, worldlineDigest: "host:sha256:recomputed" } },
      },
      {
        field: "drawCounters",
        post: { ...ok, drawCounters: { ...pre.drawCounters, latent: 8192 } },
      },
    ];

    for (const { field, post } of cases) {
      const result = check(pre, post);
      expect(result.ok, `${field} must be refused`).toBe(false);
      if (result.ok) continue;
      expect(result.violation.field, `the violation must name ${field}`).toBe(field);
    }
    expect(cases.length).toBe(9);
  });

  test("DEGENERATE: with no digests and no draws consumed, the same defect is accepted", async () => {
    // Not a defence of the checker, a warning about the fixture. Strip the two clauses of their
    // population and the wrong implementation's re-digest and re-draw become invisible, because
    // `undefined` digests are skipped and doubling zero is zero.
    const barePre: ExecutionStateSnapshot = {
      ...(await restingState()),
      digests: {},
      drawCounters: { latent: 0 },
    };
    const wrong = wrongObserverChangeAsSetup(barePre) as ObserverStateLike;
    const indistinguishable: ExecutionStateSnapshot = {
      ...barePre,
      // Only the two clauses under discussion, carried from the wrong implementation. Everything
      // else is the correct observer change, so nothing but those two can refuse it.
      actionIndex: barePre.actionIndex + 1,
      revisions: { ...barePre.revisions, observer: barePre.revisions.observer + 1 },
      digests: {},
      drawCounters: wrong.drawCounters,
    };
    expect(wrong.drawCounters.latent).toBe(0);
    expect(check(barePre, indistinguishable).ok).toBe(true);
  });

  test("wrong (a): a digest over the described coordinates changes under a boost and an offset", async () => {
    const rest = await digestOf(wrongFrameDependentEventFields(REST_EVENTS));
    const boosted = await digestOf(
      wrongFrameDependentEventFields(REST_EVENTS.map((e) => lorentzBoost(e, BOOST))),
    );
    const shifted = await digestOf(
      wrongFrameDependentEventFields(translate(REST_EVENTS, [2, -1, 0, 0])),
    );
    expect(boosted).not.toBe(rest);
    expect(shifted).not.toBe(rest);

    // The coincidence point: the identity boost is still an observer change, and it survives.
    const atRest = await digestOf(
      wrongFrameDependentEventFields(REST_EVENTS.map((e) => lorentzBoost(e, 0))),
    );
    expect(atRest).toBe(rest);
  });

  test("wrong (b): recomputing an INVARIANT quantity keeps the physics and loses the digest", async () => {
    const boostedEvents = REST_EVENTS.map((e) => lorentzBoost(e, BOOST));
    const stored = wrongRecomputedInvariantEventFields(REST_EVENTS);
    const recomputed = wrongRecomputedInvariantEventFields(boostedEvents);

    // THE PHYSICS HALF, and it is a TOLERANCE comparison, which is the whole point.
    expect(recomputed.intervals.length).toBe(6);
    expect(recomputed.ids).toEqual(stored.ids);
    const relative = recomputed.intervals.map((row, index) => {
      const was = (stored.intervals[index] as { intervalSq: number }).intervalSq;
      expect(row.pair).toBe((stored.intervals[index] as { pair: string }).pair);
      return Math.abs(row.intervalSq - was) / Math.abs(was);
    });
    const worst = Math.max(...relative);
    console.log(
      `[row 09] worst relative change in a pairwise invariant interval under a ${BOOST}c boost: ${worst.toExponential(2)}`,
    );
    expect(worst).toBeLessThan(1e-12);
    // Non-zero is the load-bearing half. If the boost happened to be exact for these coordinates the
    // next two assertions would pass for the wrong reason, and this row would prove nothing.
    expect(worst).toBeGreaterThan(0);

    // THE DIGEST HALF, and it is BITWISE, because a hash has no other mode. Same physics, different
    // bytes, so the digest is destroyed by a change that preserved every invariant it describes.
    const storedDigest = await digestOf(stored);
    const recomputedDigest = await digestOf(recomputed);
    expect(recomputedDigest).not.toBe(storedDigest);

    // COINCIDENCE POINT: a pure origin offset is exact in binary64 for these coordinates, so (b)
    // survives it bitwise. An author who tried the offset first would conclude the recomputation is
    // sound, and this is the measurement that says why that conclusion does not transfer.
    const shiftedDigest = await digestOf(
      wrongRecomputedInvariantEventFields(translate(REST_EVENTS, [2, -1, 0, 0])),
    );
    expect(shiftedDigest).toBe(storedDigest);

    // COINCIDENCE POINT: and at rest nothing discriminates at all.
    const atRestDigest = await digestOf(
      wrongRecomputedInvariantEventFields(REST_EVENTS.map((e) => lorentzBoost(e, 0))),
    );
    expect(atRestDigest).toBe(storedDigest);
  });

  test("the right answer: an observer change carries the digest forward, and passes", async () => {
    const pre = await restingState();
    const boostedEvents = REST_EVENTS.map((e) => lorentzBoost(e, BOOST));

    // Both recomputations are refused, for the two different reasons above.
    for (const [label, fields] of [
      ["described coordinates", wrongFrameDependentEventFields(boostedEvents)],
      ["recomputed invariants", wrongRecomputedInvariantEventFields(boostedEvents)],
    ] as const) {
      const post: ExecutionStateSnapshot = {
        ...correctObserverPost(pre),
        digests: { ...pre.digests, eventSetDigest: await digestOf(fields) },
      };
      const result = check(pre, post);
      expect(result.ok, `recomputing from ${label} must be refused`).toBe(false);
      if (result.ok) continue;
      expect(result.violation.field).toBe("digests.eventSetDigest");
    }

    // Carried forward, unchanged, and accepted. The description changed; the world did not.
    const carried = correctObserverPost(pre);
    expect(carried.digests.eventSetDigest).toBe(pre.digests.eventSetDigest);
    expect(check(pre, carried).ok).toBe(true);
    expect(carried.revisions.observer).toBe(pre.revisions.observer + 1);
    expect(carried.runId).toBe(pre.runId);
  });
});
