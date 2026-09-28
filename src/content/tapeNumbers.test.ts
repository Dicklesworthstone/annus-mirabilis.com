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
 * WHAT IS NOT CHECKED HERE, said rather than left to be assumed. The count is printed by the test
 * below rather than frozen here, because the corpus grows: on 2026-09-27 it was 28 recorded
 * numbers of which this file recomputes 15, the nine of them being "the two pulses", whose every
 * value came from evaluateMe01 and is compared back against it. Two are semantic-kind codes rather than quantities (coin-to-bell, perrins-count);
 * nine need the instrument's own evaluator or a context the tape does not carry (camera-bias's
 * naive expectation, ionization-bounds' incident power, lq-07's Stokes frequency, lq-06's n,
 * lq-05-journey-stage-e's W, the-1906-box's zero shift, me-02's limiting coefficient). Those are
 * unverified, and a reader is looking at them.
 */
import { describe, expect, test } from "bun:test";
import { LQ06_DEFAULTS } from "../experiments/lq06/definition.ts";
import { evaluateLq06 } from "../experiments/lq06/session.ts";
import { LQ07_DEFAULTS } from "../experiments/lq07/definition.ts";
import { evaluateLq07 } from "../experiments/lq07/session.ts";
import { LQ09_DEFAULTS } from "../experiments/lq09/definition.ts";
import { evaluateLq09 } from "../experiments/lq09/session.ts";
import { ME01_DEFAULTS } from "../experiments/me01/definition.ts";
import { ME02_DEFAULTS } from "../experiments/me02/definition.ts";
import { ME03_DEFAULTS } from "../experiments/me03/definition.ts";
import { getConstantSet } from "../physics/reference/constants.ts";
import { cameraMoments } from "../physics/reference/inference/observation.ts";
import {
  evaluateMe01,
  evaluateMe02,
  evaluateMe03,
  evaluatePhotonBox,
} from "../physics/reference/massEnergy.ts";
import { loadTeachingTapes, type TeachingTape } from "./teachingTapes.ts";

const tapes = new Map(loadTeachingTapes().tapes.map((t) => [t.tapeId, t]));

/**
 * The tapes whose every recorded number this file recomputes from its own inputs. Adding a check
 * means adding its id here, and the reported figure follows; the reporting test refuses an id
 * that names no tape, so the list cannot quietly describe a corpus it no longer matches.
 */
const RECOMPUTED = new Set([
  "camera-bias",
  "ionization-bounds",
  "lq-07-journey-stage-g",
  "einstein-0-8-micron",
  "the-1906-box",
  "the-boost-to-0.6c",
  "the-locked-positions",
  "the-move",
  "the-two-pulses",
  "toward-low-speed",
  "where-the-energy-went",
]);

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
    // DERIVED, NOT COUNTED BY HAND. This was the literal 20 and the true figure was 21: the
    // constant drifted the moment a check was added, which is the failure AGENTS.md describes
    // for a count used as evidence. Naming the tapes instead means adding a check updates the
    // number, and the assertion below refuses a name that is not a tape.
    const total = [...tapes.values()].reduce(
      (n, t) => n + t.steps.reduce((m, s) => m + s.expected.length, 0),
      0,
    );
    const unknown = [...RECOMPUTED].filter((id) => !tapes.has(id));
    expect(unknown, "a recomputed tape that does not exist").toEqual([]);
    const recomputed = [...RECOMPUTED].reduce(
      (n, id) => n + (tapes.get(id)?.steps.reduce((m, s) => m + s.expected.length, 0) ?? 0),
      0,
    );
    // DERIVED, AND THE THIRD TIME THIS LINE HAS GONE STALE TONIGHT. It described the remainder in
    // prose, and the remainder moved twice in an hour: three input echoes were replaced by real
    // quantities (am-wj6k) and two kernel codes left the records entirely (am-3xdx), each edit
    // leaving a sentence that named tapes no longer in the set. Naming them from the records
    // cannot drift.
    const remaining = [...tapes.values()]
      .filter((t) => !RECOMPUTED.has(t.tapeId))
      .flatMap((t) => t.steps.flatMap((s) => s.expected.map((e) => `${t.tapeId}'s ${e.label}`)));
    console.log(
      `[tape numbers] ${total} recorded numbers on the tape pages; ${recomputed} recomputed from ` +
        `their tape's own inputs across ${RECOMPUTED.size} tapes; ${total - recomputed} not ` +
        `recomputed, named rather than described: ${remaining.join("; ") || "none"}`,
    );
    // Non-vacuity, and a reminder: if the corpus grows, the unchecked remainder grows with it.
    expect(total).toBeGreaterThan(recomputed);
    expect(recomputed).toBeGreaterThan(15);
  });
});

describe("a recorded number agrees with the parameters in force where it was recorded", () => {
  /**
   * The parameter values at an actionIndex: the initial conditions, then every earlier event.
   * A value may be the name of an enumerated setting as well as a number (am-3xdx), and it has
   * to pass through as one: merging a kernel name into a laboratory's defaults is the whole
   * point of reading the state a number is filed under.
   */
  function inForce(t: TeachingTape, at: number): Record<string, number | string> {
    const values: Record<string, number | string> = {};
    for (const [k, v] of Object.entries(t.initialConditions))
      if (typeof v === "number" || typeof v === "string") values[k] = v;
    for (const step of t.steps)
      if (step.actionIndex <= at && step.parameterId && step.value !== undefined)
        values[step.parameterId] = step.value;
    return values;
  }

  test("the two pulses: every number is ME-01's own evaluator at the step's settings", () => {
    // This tape was authored on 2026-09-27 and its nine numbers came from evaluateMe01 at these
    // very settings, so this is the check that keeps them honest: if ME-01's physics moves, the
    // record goes red instead of quietly disagreeing with the instrument it walks a reader
    // through. Each label is the snapshot field it names, which is why the comparison is direct.
    const t = tape("the-two-pulses");
    let compared = 0;
    for (const step of t.steps) {
      if (step.expected.length === 0) continue;
      const snapshot = evaluateMe01({
        ...ME01_DEFAULTS,
        ...inForce(t, step.actionIndex),
      }) as unknown as Record<string, { status?: string; value?: number } | undefined>;
      for (const recorded of step.expected) {
        const output = snapshot[recorded.label];
        expect(output, `${recorded.label} is not an ME-01 output`).toBeDefined();
        expect(output?.status, `${recorded.label} at action ${step.actionIndex}`).toBe("value");
        expect(output?.value, `${recorded.label} at action ${step.actionIndex}`).toBeCloseTo(
          recorded.value,
          12,
        );
        compared += 1;
      }
    }
    expect(compared).toBe(9);
    // The teaching point, asserted as a property rather than left to the three equal numbers
    // above: turning the pair changes each pulse's share and never their sum.
    const shares = t.steps.flatMap((step) =>
      step.expected.filter((e) => e.label === "pulseEnergyRatio").map((e) => e.value),
    );
    expect(new Set(shares).size).toBe(shares.length);
    expect(shares.length).toBeGreaterThan(2);
  });

  test("where the energy went: the two zeros are a cancellation, not a stuck zero", () => {
    const t = tape("where-the-energy-went");
    const step = t.steps.find((s) => s.expected.length > 0);
    expect(step).toBeDefined();
    if (!step) return;
    const snapshot = evaluateMe03({
      ...ME03_DEFAULTS,
      ...inForce(t, step.actionIndex),
    }) as never as Record<string, { status?: string; value?: number } | undefined>;
    const named: Record<string, string> = {
      "system energy change": "systemEnergyChange",
      "system mass change": "systemMassChange",
    };
    let compared = 0;
    for (const recorded of step.expected) {
      const field = named[recorded.label];
      expect(field, `${recorded.label} has no ME-03 output named for it`).toBeDefined();
      const output = snapshot[field as string];
      expect(output?.status, recorded.label).toBe("value");
      expect(output?.value, recorded.label).toBe(recorded.value);
      compared += 1;
    }
    expect(compared).toBe(2);
    // NON-VACUITY, and it is the whole reason a recorded zero needs checking: an evaluator that
    // returned zero for everything would satisfy the two assertions above. At this same state the
    // BODY's own ledger is not zero, and it is not zero by the paper's own amount: the body loses
    // the energy it emitted, and mass E/c^2 with it. The system zero is those two cancelling.
    const emitted = inForce(t, step.actionIndex).emittedEnergy;
    expect(emitted).toBeGreaterThan(0);
    expect(snapshot.energyChange?.value).toBe(-(emitted as number));
    const c = (snapshot.speedOfLight as unknown as number) ?? 0;
    expect(c).toBeGreaterThan(1e8);
    expect(snapshot.massChange?.value).toBeCloseTo(-(emitted as number) / (c * c), 30);
  });

  test("the 1906 box: the centre of mass stays put only because the light carries mass", () => {
    const t = tape("the-1906-box");
    const step = t.steps.find((s) => s.expected.some((e) => e.label === "center of mass shift"));
    expect(step).toBeDefined();
    if (!step) return;
    const at = inForce(t, step.actionIndex);
    // The box's own settings, read from the tape rather than written here.
    const box = {
      M: at.boxMass as number,
      ell: at.boxLength as number,
      E: at.pulseEnergy as number,
      assignLightMass: at.assignLightMass === 1,
    };
    expect(box.assignLightMass).toBe(true);
    const withMass = evaluatePhotonBox(box) as never as Record<
      string,
      { status?: string; value?: number } | undefined
    >;
    const recorded = step.expected.find((e) => e.label === "center of mass shift");
    expect(withMass.centerOfMassShift?.value).toBe(recorded?.value);
    // THE NEGATIVE CONTROL IS THE TEACHING POINT. Deny the light its mass and the same box moves
    // the same distance while the centre of mass no longer stays put, which is the contradiction
    // the 1906 argument exists to resolve. Without this, "0" is a number no computation defends.
    const withoutMass = evaluatePhotonBox({ ...box, assignLightMass: false }) as never as Record<
      string,
      { status?: string; value?: number } | undefined
    >;
    expect(withoutMass.centerOfMassShift?.value).not.toBe(0);
    expect(withoutMass.centerOfMassShift?.value).toBe(withMass.boxDisplacement?.value);
  });

  test("camera bias: the naive expectation is what the camera model gives, and it is not D", () => {
    // THIS RECORD WAS WRONG ON THE LIVE SITE until 2026-09-28: it recorded the input D itself,
    // 0.42944e-12, as the naive estimator's expectation, which says the estimator recovers D
    // exactly and is the opposite of what BM-08 exists to show. cameraMoments gives
    // 3.9786666666666666e-13 at these settings.
    const t = tape("camera-bias");
    const step = t.steps.find((s) => s.expected.some((e) => e.label === "naive expectation"));
    expect(step).toBeDefined();
    if (!step) return;
    const at = inForce(t, step.actionIndex);
    const model = {
      D: at.D as number,
      dt: at.dt as number,
      exposure: at.exposure as number,
      sigma: at.sigma as number,
      drift: (at.stageDrift as number) ?? 0,
      d: at.d as number,
    };
    // `Computation` is {kind, data}, not {status, value}: my first probe accepted either
    // shape through a `??` chain and so told me the number without telling me the contract.
    const moments = cameraMoments(model) as {
      kind: string;
      data?: { naiveExpectation: number };
    };
    expect(moments.kind).toBe("accepted");
    const recorded = step.expected.find((e) => e.label === "naive expectation");
    expect(moments.data?.naiveExpectation).toBe(recorded?.value);
    // THE NON-VACUITY IS THE TEACHING POINT: the expectation must NOT be the true D, and the gap
    // must be the exposure blur minus what the localization noise adds, each read from the model's
    // own parameters rather than written here.
    expect(moments.data?.naiveExpectation).not.toBe(model.D);
    const blur = (model.D * model.exposure) / (3 * model.dt);
    const noise = model.sigma ** 2 / model.dt;
    expect(blur).toBeGreaterThan(noise);
    expect(moments.data?.naiveExpectation).toBeCloseTo(model.D - blur + noise, 20);
  });

  test("toward low speed: the limiting mass decrease is exactly L over c squared", () => {
    const t = tape("toward-low-speed");
    const step = t.steps.find((s) => s.expected.length > 0);
    expect(step).toBeDefined();
    if (!step) return;
    const at = inForce(t, step.actionIndex);
    const snapshot = evaluateMe02({ ...ME02_DEFAULTS, ...at }) as never as Record<string, unknown>;
    const c = snapshot.speedOfLight as number;
    const decrease = (snapshot.inertialMassDecrease as { value?: number } | undefined)?.value;
    expect(c).toBeGreaterThan(1e8);
    expect(decrease).toBeDefined();
    // The recorded number is that coefficient in units of L/c^2, where Einstein's conclusion makes
    // it exactly 1. Normalising here rather than comparing kilograms is what the record says.
    const normalised = ((decrease as number) * c * c) / (at.emittedEnergy as number);
    const recorded = step.expected[0];
    expect(normalised).toBe(recorded?.value);
    // Non-vacuity: the tape walks beta down to 0, and the exact difference at its OPENING speed is
    // not the limit, which is the whole reason the walk exists.
    const opening = evaluateMe02({ ...ME02_DEFAULTS, ...t.initialConditions }) as never as Record<
      string,
      { value?: number } | undefined
    >;
    expect(opening.exactDifference?.value).not.toBe(snapshot.exactDifference as never);
  });

  /** A value out of an evaluator that returns a list of results, by the quantity it names. */
  function resultValue(rows: unknown, quantityId: string): number | undefined {
    for (const row of Array.isArray(rows) ? rows : []) {
      const r = row as { quantityId?: string; status?: string; value?: number };
      if (r.quantityId === quantityId && r.status === "value") return r.value;
    }
    return undefined;
  }

  test("ionization bounds: doubling the power doubles the count, which is what the step records", () => {
    // The record used to expect "incidentPower = 2e-06 W", the setting the step had just made
    // (am-wj6k). It records LQ-09's ionization count now, and the note's claim is the assertion:
    // doubling the absorbed light energy doubles the count.
    const t = tape("ionization-bounds");
    const step = t.steps.find((s) => s.expected.length > 0);
    expect(step).toBeDefined();
    if (!step) return;
    const at = inForce(t, step.actionIndex);
    const after = evaluateLq09({ ...LQ09_DEFAULTS, ...at });
    const recorded = step.expected[0];
    expect(recorded?.label).toBe("ionizationCount");
    expect(resultValue(after, "ionizationCount")).toBe(recorded?.value);
    const before = evaluateLq09({ ...LQ09_DEFAULTS, ...t.initialConditions });
    const opening = resultValue(before, "ionizationCount");
    expect(opening).toBeGreaterThan(0);
    expect(recorded?.value).toBeCloseTo((opening as number) * 2, 6);
  });

  test("the move: doubling the points doubles the gas entropy, which is what the step records", () => {
    const t = tape("the-move");
    const step = t.steps.find((s) => s.expected.length > 0);
    expect(step).toBeDefined();
    if (!step) return;
    const after = evaluateLq06({ ...LQ06_DEFAULTS, ...inForce(t, step.actionIndex) });
    const recorded = step.expected[0];
    expect(recorded?.label).toBe("gasEntropy");
    expect(resultValue(after, "gasEntropy")).toBe(recorded?.value);
    const before = evaluateLq06({ ...LQ06_DEFAULTS, ...t.initialConditions });
    const opening = resultValue(before, "gasEntropy");
    expect(opening).toBeLessThan(0);
    expect(recorded?.value).toBeCloseTo((opening as number) * 2, 30);
  });

  test("the fluorescence ledger: at this step it cannot balance, and by how much", () => {
    const t = tape("lq-07-journey-stage-g");
    const step = t.steps.find((s) => s.expected.length > 0);
    expect(step).toBeDefined();
    if (!step) return;
    const at = inForce(t, step.actionIndex);
    const snapshot = evaluateLq07({ ...LQ07_DEFAULTS, ...at }) as {
      budget?: { allowed?: boolean; energyDeficitEv?: number; nu2MaxHz?: number };
    };
    const recorded = step.expected[0];
    expect(recorded?.label).toBe("energyDeficitEv");
    expect(snapshot.budget?.energyDeficitEv).toBe(recorded?.value);
    // Non-vacuity, and the teaching point: a deficit only means something because the single
    // quantum assumption REFUSES this step, and the ceiling it refuses against is nu1 itself.
    expect(snapshot.budget?.allowed).toBe(false);
    expect(snapshot.budget?.nu2MaxHz).toBe((at.nu1 as number) * 1e12);
  });

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
          // Both are numeric parameters of LQ-05; the guard is what makes that a checked fact
          // rather than an assumption now that a setting may also be a name (am-3xdx).
          if (typeof n !== "number" || typeof f !== "number") continue;
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
