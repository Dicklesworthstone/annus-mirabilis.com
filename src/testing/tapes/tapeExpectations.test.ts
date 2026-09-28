/**
 * EVERY NUMBER A TEACHING TAPE RECORDS, AGAINST THE INSTRUMENT THAT PRODUCES IT (am-2rl9).
 *
 * The bead's last open clause: "The 21 tapes' recorded expectations are checked against what the
 * instruments actually produce. The present test asserts the records are readable and would pass on a
 * tape whose every number was wrong." This is that check. The rules deciding the population, who
 * computes the comparison value, which checkpoint state is replayed and why the tolerance is what it
 * is are all in tapeExpectations.ts.
 *
 * MEASURED HERE 2026-09-28, and the clause was written when there were 21 records: there are now 22,
 * carrying 30 checkpoints, of which 19 carry `expectedDisplayValues`, holding 29 expectations across
 * 14 tapes. So "the 21 tapes' expectations" is really 29 numbers on 14 of 22 tapes, and that is the
 * denominator this file prints on every run.
 *
 * WHAT IT FOUND: nothing wrong, after first finding three things that were not wrong. Of the 29, five
 * are judged and all five agree with their instrument. The first run reported three disagreements, two
 * of them off by exactly a factor of two; all three were this check driving the replay from the
 * checkpoint's array position instead of its own `actionIndex`, and the records were right. That
 * correction is written into tapeExpectations.ts beside the rule it produced, because the shape of the
 * error, a plausible finding re-derived from my own instrument, is the thing worth remembering.
 *
 * THE OTHER 24 ARE NOT PASSES. Ten name an instrument with no permalink binding (bm-01, bm-07, bm-08,
 * sr-03), four sit on records that cannot convert to a wire tape because their digest is a
 * placeholder, and ten carry a label that is not a quantity id the instrument produces. Each is
 * counted and named, and the last group is reported with the ids the instrument DID produce, which is
 * the list of bindings that would widen this check.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { loadWireTeachingTapes } from "../../content/teachingTapes.ts";
import { replayTape } from "../../experiments/permalink/replay.ts";
import {
  createSessionReplayRunner,
  type LabTapeBinding,
  tapeForSettings,
} from "../../experiments/permalink/sessionTape.ts";
import { createTeachingTapeResolver } from "../../experiments/permalink/teachingTapeResolver.ts";
import { validateControlTape } from "../../experiments/tapes/schema.ts";
import {
  type ExpectationVerdict,
  FLOAT_SLACK,
  judgeExpectation,
  type ProducedOutput,
  significantDigitsOf,
  specFor,
  stepIndexForActionIndex,
  summarizeTally,
  type TapeExpectation,
  toleranceFor,
} from "./tapeExpectations.ts";

const ROOT = process.cwd();
const TAPE_DIR = resolve(ROOT, "content/experiments/tapes");

/**
 * Rule 1's population: every permalink binding in the tree, keyed by the experiment id it declares.
 * Discovered by walking, so a new instrument's binding joins without an edit here.
 */
async function bindingsByExperiment(): Promise<Map<string, LabTapeBinding>> {
  const out = new Map<string, LabTapeBinding>();
  for (const dir of readdirSync(resolve(ROOT, "src/experiments")).sort()) {
    const file = resolve(ROOT, "src/experiments", dir, "tape.ts");
    if (!existsSync(file)) continue;
    const mod = (await import(file)) as Record<string, unknown>;
    for (const [name, value] of Object.entries(mod))
      if (/^[A-Z0-9]+_TAPE$/.test(name)) {
        const binding = value as LabTapeBinding;
        out.set(binding.environment.experimentId, binding);
      }
  }
  return out;
}

type Row = Readonly<{
  tapeId: string;
  experimentId: string;
  checkpointIndex: number;
  checkpointLabel: string;
  expectation: TapeExpectation;
  verdict: ExpectationVerdict | Readonly<{ kind: "excluded"; reason: string }>;
}>;

const bindings = await bindingsByExperiment();
const { tapes, problems } = loadWireTeachingTapes(ROOT);
const resolver = createTeachingTapeResolver(tapes);
const conversionProblem = new Map<string, string>();
for (const problem of problems) {
  const match = /tapes\/([a-z0-9-]+)\.yaml/.exec(problem);
  if (match?.[1]) conversionProblem.set(match[1], problem);
}

/** The outputs the instrument holds after replaying this tape to this checkpoint. */
function replayOutputs(
  binding: LabTapeBinding,
  tapeId: string,
  authoredInitial: Record<string, unknown>,
  checkpoint: Readonly<{ actionIndex: number; digest: string }>,
  checkpointIndex: number,
): { outputs: readonly ProducedOutput[]; problem: string } {
  const opening = tapeForSettings(binding, { ...binding.defaults, ...authoredInitial });
  if (!opening)
    return { outputs: [], problem: "the instrument refused the walkthrough's opening settings" };
  const session = binding.createSession(`tape-expectations-${tapeId}-${checkpointIndex}`);
  const runner = createSessionReplayRunner(binding, session);
  const stepIndex = stepIndexForActionIndex(checkpoint.actionIndex);
  const result = replayTape(
    {
      ...opening,
      acceptedCheckpoint: {
        acceptedActionIndex: checkpoint.actionIndex,
        acceptedInputRevision: 0,
        digest: checkpoint.digest,
      },
      ...(stepIndex === null ? {} : { teachingTapeRef: { tapeId, stepIndex } }),
    },
    { ...runner, resolveTeachingTape: resolver },
  );
  const snapshot = session.getSnapshot() as {
    accepted?: { outputs?: readonly ProducedOutput[] } | null;
  };
  const outputs = snapshot.accepted?.outputs ?? [];
  if (result.kind !== "success" && outputs.length === 0)
    return { outputs: [], problem: `the replay did not reach the checkpoint (${result.kind})` };
  return { outputs, problem: "" };
}

const rows: Row[] = [];
for (const file of readdirSync(TAPE_DIR)
  .filter((f) => f.endsWith(".yaml"))
  .sort()) {
  const record = validateControlTape(
    strictParse(readFileSync(resolve(TAPE_DIR, file), "utf8"), "yaml"),
  ) as unknown as {
    tapeId: string;
    experimentId: string;
    checkpoints: readonly {
      actionIndex: number;
      digest: string;
      label?: string;
      expectedDisplayValues?: readonly TapeExpectation[];
    }[];
  };
  const authored = tapes.get(record.tapeId);
  const binding = bindings.get(record.experimentId);
  for (const [index, checkpoint] of record.checkpoints.entries()) {
    const expectations = checkpoint.expectedDisplayValues ?? [];
    if (expectations.length === 0) continue;
    const common = {
      tapeId: record.tapeId,
      experimentId: record.experimentId,
      checkpointIndex: index,
      checkpointLabel: checkpoint.label ?? `checkpoint ${index}`,
    };
    // Rule 1, then rule 2. Both are structural: nothing about the number is examined.
    const excluded = !binding
      ? `no permalink binding for ${record.experimentId}, so there is no instrument to replay into`
      : !authored
        ? `the record does not convert to a wire tape: ${conversionProblem.get(record.tapeId) ?? "reason not reported"}`
        : "";
    if (excluded) {
      for (const expectation of expectations)
        rows.push({ ...common, expectation, verdict: { kind: "excluded", reason: excluded } });
      continue;
    }
    const { outputs, problem } = replayOutputs(
      binding as LabTapeBinding,
      record.tapeId,
      (authored as { initialConditions?: Record<string, unknown> }).initialConditions ?? {},
      checkpoint,
      index,
    );
    for (const expectation of expectations)
      rows.push({
        ...common,
        expectation,
        verdict: problem
          ? { kind: "excluded", reason: problem }
          : judgeExpectation(expectation, outputs),
      });
  }
}

const judgedRows = rows.filter((r) => r.verdict.kind === "judged");
const tally = {
  population: rows.length,
  judged: judgedRows.length,
  disagreed: judgedRows.filter((r) => r.verdict.kind === "judged" && !r.verdict.agrees).length,
  excluded: rows.filter((r) => r.verdict.kind === "excluded").length,
  unjudged: rows.filter((r) => r.verdict.kind === "unjudged").length,
};

/**
 * Judged when this check was written, measured by its own first run: 29 expectations, 14 excluded by
 * rule, 5 judged, 10 unjudged. A floor, not an allowlist: binding a label to a produced quantity id,
 * giving an instrument a permalink binding, or replacing a placeholder digest raises it, and a
 * regression that stops judging one of the five takes the count below it and names the tape.
 */
const JUDGED_FLOOR = 5;

describe("teaching tapes' recorded expectations against their instruments (am-2rl9)", () => {
  test("the counts are reported with their denominator, and the population is not empty", () => {
    for (const row of rows) {
      const where = `${row.tapeId} cp${row.checkpointIndex} "${row.expectation.label}"`;
      if (row.verdict.kind === "judged")
        console.log(
          `[tape expectations] judged   ${where}: recorded ${row.expectation.value}, ` +
            `${row.verdict.ownerId} produced ${row.verdict.produced}, within ${row.verdict.allowed} ` +
            `(${row.verdict.agrees ? "agrees" : "DISAGREES"})`,
        );
      else if (row.verdict.kind === "unjudged")
        console.log(
          `[tape expectations] unjudged ${where}: ${row.verdict.reason}; produced [${row.verdict.available.join(", ")}]`,
        );
      else console.log(`[tape expectations] excluded ${where}: ${row.verdict.reason}`);
    }
    const files = readdirSync(TAPE_DIR).filter((f) => f.endsWith(".yaml")).length;
    console.log(
      `[tape expectations] ${summarizeTally(`${files} tape records`, tally)}; ` +
        `${bindings.size} instruments have a permalink binding, ${tapes.size} of ${files} records convert`,
    );
    // Non-vacuity, on purpose: a run that read no record would report zero of everything and be
    // indistinguishable from a clean one.
    expect(tally.population).toBeGreaterThan(0);
    expect(tally.judged).toBeGreaterThan(0);
    expect(tally.population).toBe(tally.judged + tally.excluded + tally.unjudged);
    expect(bindings.size).toBeGreaterThan(10);
  });

  test("every judged expectation agrees with the instrument that produces it", () => {
    const disagreeing = judgedRows
      .filter((r) => r.verdict.kind === "judged" && !r.verdict.agrees)
      .map((r) =>
        r.verdict.kind === "judged"
          ? `${r.tapeId} (${r.experimentId}) checkpoint "${r.checkpointLabel}" ${r.expectation.label}: ` +
            `recorded ${r.expectation.value}, instrument produced ${r.verdict.produced}, ` +
            `allowed ${r.verdict.allowed}`
          : "",
      );
    expect(disagreeing).toEqual([]);
  });

  test("no fewer expectations are judged than when this check was written", () => {
    expect(tally.judged).toBeGreaterThanOrEqual(JUDGED_FLOOR);
  });

  test("a recorded expectation altered by one digit fails, naming the tape and the quantity", () => {
    // PLANT, in memory against the real corpus rather than by editing a record, so nothing has to be
    // restored. The judged row is real; only the recorded number moves, by one digit in its last
    // place, which is the smallest change the tolerance rule must still refuse.
    const sample = judgedRows[0];
    if (sample === undefined || sample.verdict.kind !== "judged")
      throw new Error("no judged expectation to plant against");
    const digits = significantDigitsOf(sample.expectation.value);
    const step = 2.2 * sample.verdict.allowed;
    const altered: TapeExpectation = {
      ...sample.expectation,
      value: sample.expectation.value + step,
    };
    const produced: ProducedOutput[] = [
      {
        quantityId: sample.expectation.label,
        status: "value",
        value: sample.verdict.produced,
        ownerId: sample.verdict.ownerId,
      },
    ];
    const verdict = judgeExpectation(altered, produced);
    expect(verdict.kind).toBe("judged");
    if (verdict.kind !== "judged") throw new Error("unreachable");
    expect(verdict.agrees).toBe(false);
    // The unaltered value still agrees, so the plant proves the comparison and not a broken call.
    const control = judgeExpectation(sample.expectation, produced);
    expect(control.kind === "judged" && control.agrees).toBe(true);
    // And a failing run can name the tape, the quantity and the criterion it applied.
    const message =
      `${sample.tapeId} (${sample.experimentId}) checkpoint "${sample.checkpointLabel}" ` +
      `${altered.label}: recorded ${altered.value}, instrument produced ${verdict.produced}, ` +
      `allowed ${verdict.allowed}`;
    expect(message).toContain(sample.tapeId);
    expect(message).toContain(sample.expectation.label);
    expect(digits).toBeGreaterThan(0);
  });

  test("an expectation the instrument does not produce is reported unjudged, never passed", () => {
    // The other direction. A label no output carries must not be silently counted as agreement, and
    // must not be counted as a failure either: it is reported with what the instrument did produce.
    const produced: ProducedOutput[] = [
      { quantityId: "someQuantityTheInstrumentHas", status: "value", value: 1.25 },
      // A quantity the instrument holds WITHOUT a value cannot be compared either, even when its id
      // matches, which is why the rule requires `status: "value"`.
      { quantityId: "aSymbolicQuantity", status: "symbolic" },
    ];
    for (const label of ["noSuchQuantity", "aSymbolicQuantity"]) {
      const verdict = judgeExpectation({ label, value: 1.25 }, produced);
      expect([label, verdict.kind]).toEqual([label, "unjudged"]);
      if (verdict.kind !== "unjudged") throw new Error("unreachable");
      expect(verdict.available).toEqual(["someQuantityTheInstrumentHas"]);
      expect(verdict.reason).toContain(label);
    }
    // Positive control: the same shape with a matching id and a value IS judged, so the assertion
    // above is about the label and not about a judge that never judges.
    expect(
      judgeExpectation({ label: "someQuantityTheInstrumentHas", value: 1.25 }, produced).kind,
    ).toBe("judged");
  });

  test("the tolerance is the recorded value's own precision, and zero is handled separately", () => {
    expect(significantDigitsOf(0.7947833)).toBe(7);
    expect(significantDigitsOf(1.25)).toBe(3);
    expect(significantDigitsOf(8)).toBe(1);
    // Half a unit in the last printed digit, at the value's own magnitude.
    expect(toleranceFor(1.25)).toBeCloseTo(0.005, 12);
    expect(toleranceFor(0.7947833)).toBeCloseTo(5e-8, 15);
    // The spec pairs that absolute with a relative companion, except at an exact zero.
    expect(specFor(1.25)).toEqual({ absolute: toleranceFor(1.25), relative: FLOAT_SLACK });
    expect(specFor(0)).toEqual({ absolute: 1e-12 });
    // A full-double record at a large magnitude would be refused as a spec on its absolute alone,
    // which is the defect the relative companion exists to prevent; here it is judged, not refused.
    const large = judgeExpectation({ label: "q", value: 520125234661.7378 }, [
      { quantityId: "q", status: "value", value: 520125234661.7378 },
    ]);
    expect(large).toMatchObject({ agrees: true, kindOfComparison: "within" });
    // A record written to seven digits is held to seven: the eighth may differ, the seventh may not.
    expect(
      judgeExpectation({ label: "q", value: 0.7947833 }, [
        { quantityId: "q", status: "value", value: 0.79478334 },
      ]),
    ).toMatchObject({ agrees: true });
    expect(
      judgeExpectation({ label: "q", value: 0.7947833 }, [
        { quantityId: "q", status: "value", value: 0.7947845 },
      ]),
    ).toMatchObject({ agrees: false });
    // An exact zero has no significant digit to derive a bound from, so it gets an absolute floor.
    expect(toleranceFor(0)).toBe(1e-12);
    expect(
      judgeExpectation({ label: "q", value: 0 }, [
        { quantityId: "q", status: "value", value: 1e-15 },
      ]),
    ).toMatchObject({ agrees: true });
    expect(
      judgeExpectation({ label: "q", value: 0 }, [
        { quantityId: "q", status: "value", value: 1e-6 },
      ]),
    ).toMatchObject({ agrees: false });
  });
});
