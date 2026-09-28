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
 * `initialConditions` and computes the quantity from them; the recorded value is the thing being
 * tested, never an input to the computation.
 *
 * WHAT IS NOT CHECKED HERE, said rather than left to be assumed. Of the 17 recorded numbers, this
 * file checks 6. Two are semantic-kind codes rather than quantities (coin-to-bell, perrins-count);
 * nine need the instrument's own evaluator or a context the tape does not carry (camera-bias's
 * naive expectation, ionization-bounds' incident power, lq-07's Stokes frequency, lq-06's n,
 * lq-05-journey-stage-e's W, the-1906-box's zero shift, me-02's limiting coefficient). Those are
 * unverified, and a reader is looking at them.
 */
import { describe, expect, test } from "bun:test";
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

  test("Einstein's 0.8 micron: the two displacements are one diffusivity, and it names an Avogadro number", () => {
    const t = tape("einstein-0-8-micron");
    const got = expectations(t);
    const oneSecond = got.get("lambda_x at 1 s");
    const sixtySeconds = got.get("lambda_x at 60 s");
    expect(oneSecond).toBeDefined();
    expect(sixtySeconds).toBeDefined();
    if (oneSecond === undefined || sixtySeconds === undefined) return;

    // CONSTANT-FREE: whatever D is, sqrt(2Dt) scales as sqrt(t). This catches a wrong second number
    // without needing to agree about any constant, and it is the relation the paper rests on.
    expect(sixtySeconds / oneSecond).toBeCloseTo(Math.sqrt(60), 6);

    // What the first number MEANS under the tape's own inputs. D = lambda^2 / 2t, and Einstein's
    // relation D = RT / (6 pi eta a N) then names an N. Reported as an implication rather than
    // assumed: the constant set einstein-1905-brownian-printed is not registered in
    // constants.ts, so the site cannot evaluate it, and this says what the recorded number is
    // consistent with instead of pretending to read it from a set that is not there.
    const T = num(t, "T");
    const eta = num(t, "eta");
    const a = num(t, "a");
    const R = 8.31; // J/(mol K), the gas constant to the precision Einstein prints
    const D = (oneSecond * 1e-6) ** 2 / 2; // metres squared per second, at t = 1 s
    const impliedN = (R * T) / (6 * Math.PI * eta * a * D);
    console.log(
      `[tape numbers] einstein-0-8-micron implies D = ${D.toExponential(6)} m2/s and, with R = ${R}, ` +
        `T = ${T}, eta = ${eta}, a = ${a}, an Avogadro number of ${impliedN.toExponential(4)} per mole`,
    );
    // Within a per cent of 6.0e23, which is the round figure this tape was authored against.
    expect(impliedN / 6.0e23).toBeGreaterThan(0.99);
    expect(impliedN / 6.0e23).toBeLessThan(1.01);
    // AGENTS.md records the historical fixture as about 0.79 um at 1 s and 6.15 to 6.16 at 60 s.
    expect(oneSecond).toBeGreaterThan(0.78);
    expect(oneSecond).toBeLessThan(0.8);
    expect(sixtySeconds).toBeGreaterThan(6.15);
    expect(sixtySeconds).toBeLessThan(6.17);
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
