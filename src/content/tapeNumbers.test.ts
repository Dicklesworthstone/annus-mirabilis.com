/**
 * The numbers a reader now sees on /tapes/<id>/, recomputed from the tape's own stated inputs
 * (am-2rl9).
 *
 * WHY THIS IS NOT OPTIONAL ANY MORE. Until 2026-09-27 the 21 teaching tapes reached no reader, so a
 * wrong expectation cost nothing. They are now pages, and 17 recorded numbers are on them. The
 * reader-facing test that shipped with those pages asserts the records are READABLE and says in its
 * own docblock that it would pass on a tape whose every number was wrong. This closes that, for the
 * ones arithmetic can close.
 *
 * THE METHOD IS TO REDO THE LINE, never to restate the answer. Each check takes the tape's own
 * `initialConditions`, or the registered constant set the tape names, and computes the quantity
 * from them; the recorded value is the thing being tested, never an input to the computation.
 *
 * A CORRECTION THIS FILE CARRIES. Its first version hard-coded R = 8.31 and said that
 * einstein-1905-brownian-printed "is not registered in constants.ts, so the site cannot evaluate
 * it". That was false, and I had it from the tape's own comment of 2026-09-16, which named the bead
 * that would register the set and which I did not check had since closed. getConstantSet resolves
 * it: era 1905, six entries, each sourced to Ann. Phys. (4) 17 (1905), p. 559, §5, and among them
 * the very displacement the tape records. Reading the set makes the check stronger than the literal
 * did and removes a hedge that was not true.
 *
 * WHAT IS NOT CHECKED HERE, said rather than left to be assumed. Of the 17 recorded numbers, this
 * file checks 6. Two are semantic-kind codes rather than quantities (coin-to-bell, perrins-count);
 * nine need the instrument's own evaluator or a context the tape does not carry (camera-bias's
 * naive expectation, ionization-bounds' incident power, lq-07's Stokes frequency, lq-06's n,
 * lq-05-journey-stage-e's W, the-1906-box's zero shift, me-02's limiting coefficient). Those are
 * unverified, and a reader is looking at them.
 */
import { describe, expect, test } from "bun:test";
import { getConstantSet } from "../physics/reference/constants.ts";
import { loadTeachingTapes, type TeachingTape } from "./teachingTapes.ts";

const tapes = new Map(loadTeachingTapes().tapes.map((t) => [t.tapeId, t]));

function tape(id: string): TeachingTape {
  const found = tapes.get(id);
  if (!found) throw new Error(`no tape ${id}`);
  return found;
}

/** Every recorded expectation of a tape, by label. */
function expectations(t: TeachingTape): Map<string, number> {
  const out = new Map<string, number>();
  for (const step of t.steps) for (const v of step.expected) out.set(v.label, v.value);
  return out;
}

const num = (t: TeachingTape, key: string): number => {
  const raw = t.initialConditions[key];
  if (typeof raw !== "number") throw new Error(`${t.tapeId} has no numeric ${key}`);
  return raw;
};

describe("the numbers on a teaching tape's page, recomputed from its own inputs", () => {
  test("the boost to 0.6c: the measured length and the simultaneity offset", () => {
    const t = tape("the-boost-to-0.6c");
    const v = num(t, "v"); // as a fraction of c
    const L0 = num(t, "L0"); // light-seconds, proper
    const gamma = 1 / Math.sqrt(1 - v * v);
    const got = expectations(t);

    // A rod measured from the frame it moves in is shorter by exactly the factor gamma.
    expect(gamma).toBeCloseTo(1.25, 12);
    expect(got.get("measuredLength")).toBeCloseTo(L0 / gamma, 9);

    // The two ends are simultaneous in K and not in k: the offset is -gamma*v*L0/c^2, which in
    // light-seconds and c = 1 is -gamma*v*L0. The sign says which end the moving frame reads first.
    expect(got.get("dtk")).toBeCloseTo(-gamma * v * L0, 9);
    // And zero in the frame where they were set simultaneous, which is the whole point of the pair.
    expect(got.get("dtK")).toBe(0);
  });

  test("the locked positions: f^n when independent, f when locked", () => {
    const t = tape("the-locked-positions");
    const n = num(t, "n");
    const f = num(t, "f");
    const got = expectations(t);

    // n points each taking their own coin: the probability all land in the part is f^n.
    expect(got.get("W (independent)")).toBeCloseTo(f ** n, 15);
    // Locked together they are one coin, so it is f however many there are. AGENTS.md lists the
    // opposite reading, "the locked-position probability is f^n", as an adversarial fixture that
    // must fail, so the two numbers on this page are the whole teaching point.
    expect(got.get("W (locked)")).toBeCloseTo(f, 15);
    expect(got.get("W (independent)")).toBeLessThan(got.get("W (locked)") ?? 0);
  });

  test("Einstein's 0.8 micron: the recorded numbers are the registered 1905 set's own", () => {
    const t = tape("einstein-0-8-micron");
    const got = expectations(t);
    const oneSecond = got.get("lambda_x at 1 s");
    const sixtySeconds = got.get("lambda_x at 60 s");
    expect(oneSecond).toBeDefined();
    expect(sixtySeconds).toBeDefined();
    if (oneSecond === undefined || sixtySeconds === undefined) return;

    // CONSTANT-FREE: whatever D is, sqrt(2Dt) scales as sqrt(t). This catches a wrong second number
    // without agreeing about any constant, and it is the relation the paper rests on.
    expect(sixtySeconds / oneSecond).toBeCloseTo(Math.sqrt(60), 6);

    // THE SET IS REGISTERED, so read it rather than hard-coding anything. An earlier version of
    // this test carried R = 8.31 as a literal and said in its docblock that
    // einstein-1905-brownian-printed "is not registered in constants.ts, so the site cannot
    // evaluate it". That was false. I took it from the tape's own comment of 2026-09-16, which said
    // the set was not yet registered and named the bead that would register it, and I did not check
    // whether it still held. getConstantSet resolves it: era 1905, six entries, each sourced to
    // Ann. Phys. (4) 17 (1905), p. 559, §5.
    const set = getConstantSet("einstein-1905-brownian-printed");
    const value = (quantityId: string): number => {
      const entry = set.entries.find((e) => e.quantityId === quantityId);
      if (!entry) throw new Error(`the 1905 set has no ${quantityId}`);
      return entry.value;
    };

    // The tape starts from the set's own numbers, not from numbers that merely resemble them.
    expect(t.initialConditions.T).toBeCloseTo(value("temperature"), 12);
    expect(t.initialConditions.eta).toBeCloseTo(value("viscosity"), 15);
    expect(t.initialConditions.a).toBeCloseTo(value("particleRadius"), 18);

    // And the recorded displacement is the set's own printed figure, to the metre it states.
    expect(oneSecond * 1e-6).toBeCloseTo(value("rmsDisplacement1d"), 15);

    // Finally the relation itself, computed from the set: D = RT / (6 pi eta a N), lambda = sqrt(2Dt).
    const D =
      (value("molarGasConstant") * value("temperature")) /
      (6 * Math.PI * value("viscosity") * value("particleRadius") * value("avogadroConstant"));
    const lambda = Math.sqrt(2 * D * 1) * 1e6; // micrometres, at t = 1 s
    expect(lambda).toBeCloseTo(oneSecond, 6);
    expect(Math.sqrt(2 * D * 60) * 1e6).toBeCloseTo(sixtySeconds, 5);
  });

  test("the file says how much of the reader-facing set it leaves unchecked", () => {
    const total = [...tapes.values()].reduce(
      (n, t) => n + t.steps.reduce((m, s) => m + s.expected.length, 0),
      0,
    );
    const recomputed = 6; // the three tapes above, by name
    console.log(
      `[tape numbers] ${total} recorded numbers on the tape pages; ${recomputed} recomputed from ` +
        "their tape's own inputs, and the lq-05 W values additionally checked against the state " +
        `they are filed under; ${total - recomputed} not recomputed (2 are semantic-kind codes, ` +
        "the rest need the instrument's evaluator)",
    );
    // Non-vacuity, and a reminder: if the corpus grows, the unchecked remainder grows with it.
    expect(total).toBeGreaterThan(recomputed);
  });
});

describe("a recorded number agrees with the parameters in force where it was recorded", () => {
  /** The parameter values at an actionIndex: the initial conditions, then every earlier event. */
  function inForce(t: TeachingTape, at: number): Record<string, number> {
    const values: Record<string, number> = {};
    for (const [k, v] of Object.entries(t.initialConditions))
      if (typeof v === "number") values[k] = v;
    for (const step of t.steps)
      if (step.actionIndex <= at && step.parameterId && step.value !== undefined)
        values[step.parameterId] = step.value;
    return values;
  }

  test("lq-05: W is f to the power of the n that holds at that step, not some other n", () => {
    // THE DEFECT THIS CATCHES, and it was live. lq-05-journey-stage-e recorded W = 0.125 at the
    // actionIndex of the event that sets n to 60, while 0.125 is 0.5^3, the n it starts from. The
    // page read "Set n to 60 / Three particles in half volume / n = 3 gives W = 1/8 / W = 0.125".
    // The number was right and the index was wrong, and a check on the number alone would have
    // passed. This one asks whether it agrees with the state it is filed under.
    let judged = 0;
    for (const t of [...tapes.values()].filter((x) => x.experimentId === "lq-05"))
      for (const step of t.steps)
        for (const v of step.expected) {
          if (!v.label.startsWith("W")) continue;
          const { n, f } = inForce(t, step.actionIndex);
          if (n === undefined || f === undefined) continue;
          judged += 1;
          // "W (locked)" is the whole set moving together: one coin, so f whatever n is. Any other
          // W is the independent count, f^n.
          const expected = v.label.includes("locked") ? f : f ** n;
          expect(
            v.value,
            `${t.tapeId} step ${step.actionIndex} ${v.label} against n=${n}, f=${f}`,
          ).toBeCloseTo(expected, 12);
        }
    // Three W values across the two lq-05 tapes; a loop that judged none would prove nothing.
    expect(judged).toBeGreaterThan(2);
  });
});
