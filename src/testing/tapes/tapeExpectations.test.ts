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
 * FIVE OF THE NINE WERE UNJUDGED UNTIL THE CHECK READ THE CORPUS'S OWN BINDINGS (dispatch 380), and
 * the four it gained needed no content change at all. me-01's manifest already declares the kernel
 * identifier `pulseSumMoving` and the output field `movingBalanceLight` as one quantity, the light
 * complex's energy in the moving system; the check was comparing label strings against snapshot keys
 * and so could not see a claim the reader-facing tape page has been rendering all along. Route (b) in
 * tapeExpectations.ts is that claim read, not invented.
 *
 * THE OTHER 20 ARE NOT PASSES. Ten name an instrument with no permalink binding (bm-01, bm-07, bm-08,
 * sr-03), four sit on records that cannot convert to a wire tape because their digest is a
 * placeholder, and six remain unjudged for two stated reasons:
 *
 *   - `pulseEnergyRatio`, three times on the-two-pulses: me-01 declares no such output field, names no
 *     such kernel identifier, and produces no dimensionless output at all, its three value outputs all
 *     being in joules. There is no quantity to compare a ratio with, so binding it would need the
 *     instrument to expose the ratio rather than a label to change.
 *   - `W`, `W (independent)` and `W (locked)` on lq-05's two tapes: these are authored prose, and
 *     lq-05's kernel names its probability `value`, which the manifest already declares holds
 *     `configurationProbability`. Declaring `W` as a kernel identifier would be a false claim about the
 *     source, and a label carrying a space can never be one. What they would need is a `quantityId` on
 *     the expectation record itself, which `ExpectedDisplayValue` does not carry and whose validator
 *     drops unknown keys, so it is a schema change rather than a content edit.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveQuantityId } from "../../content/quantities/resolveQuantityId.ts";
import { validateExperiment } from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { loadTeachingTapes, loadWireTeachingTapes } from "../../content/teachingTapes.ts";
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

/**
 * What the corpus says each label holds, keyed by tape id, checkpoint action index and label. Read
 * from `loadTeachingTapes`, which is the projection the reader-facing tape page renders, so this
 * check and that page agree about a binding by construction rather than by a second lookup here.
 */
function declaredLabelQuantities(): Map<string, string> {
  const out = new Map<string, string>();
  const { tapes: reading } = loadTeachingTapes(ROOT);
  for (const tape of reading as unknown as readonly {
    tapeId: string;
    steps?: readonly {
      actionIndex: number;
      expected?: readonly { label: string; quantity?: { quantityId: string } }[];
    }[];
  }[])
    for (const step of tape.steps ?? [])
      for (const expected of step.expected ?? [])
        if (expected.quantity?.quantityId)
          out.set(
            `${tape.tapeId}|${step.actionIndex}|${expected.label}`,
            expected.quantity.quantityId,
          );
  return out;
}

/**
 * What each instrument's manifest declares its output FIELDS to hold, keyed by experiment id and
 * field id. The same `outputs[].quantityId` the page's own resolution uses.
 */
function declaredFieldQuantities(experimentId: string): Map<string, string> {
  const out = new Map<string, string>();
  const file = resolve(ROOT, "content/experiments", `${experimentId}.yaml`);
  if (!existsSync(file)) return out;
  const manifest = validateExperiment(
    strictParse(readFileSync(file, "utf8"), "yaml"),
  ) as unknown as {
    outputs?: readonly { id?: string; quantityId?: string }[];
  };
  for (const output of manifest.outputs ?? [])
    if (output.id && output.quantityId) out.set(output.id, output.quantityId);
  return out;
}

const labelQuantities = declaredLabelQuantities();
const fieldQuantities = new Map<string, Map<string, string>>();
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
    if (!fieldQuantities.has(record.experimentId))
      fieldQuantities.set(record.experimentId, declaredFieldQuantities(record.experimentId));
    const fields = fieldQuantities.get(record.experimentId) ?? new Map<string, string>();
    // WHAT A PRODUCED FIELD'S KEY IS depends on the laboratory, which is why both exact lookups are
    // tried and neither is a guess. me-01's snapshot keys its outputs by the CANONICAL quantity
    // (`lightComplexEnergyMoving`, with the manifest's field id `movingBalanceLight` in its ownerId),
    // while lq-05's keys them by the manifest FIELD id (`deltaSOverKb`, whose declared quantity is
    // `entropy`). So a key resolves through the manifest's outputs first, and otherwise stands for
    // itself only when the canonical registry knows it. A key neither knows carries no canonical
    // quantity and can only be matched by route (a).
    const annotated = outputs.map((output) => {
      const declaredForField = fields.get(output.quantityId);
      const canonical =
        declaredForField ??
        (resolveQuantityId(output.quantityId).ok ? output.quantityId : undefined);
      return { ...output, ...(canonical === undefined ? {} : { canonicalQuantityId: canonical }) };
    });
    for (const expectation of expectations) {
      const declared = labelQuantities.get(
        `${record.tapeId}|${checkpoint.actionIndex}|${expectation.label}`,
      );
      const withDeclaration: TapeExpectation = {
        ...expectation,
        ...(declared === undefined ? {} : { canonicalQuantityId: declared }),
      };
      rows.push({
        ...common,
        expectation: withDeclaration,
        verdict: problem
          ? { kind: "excluded", reason: problem }
          : judgeExpectation(withDeclaration, annotated),
      });
    }
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
 * Judged when this check last grew, measured by its own run: 29 expectations, 14 excluded by rule,
 * 9 judged, 6 unjudged. It stood at 5 until the check read the corpus's declared bindings
 * (dispatch 380). A floor, not an allowlist: exposing a missing output, giving an instrument a
 * permalink binding, or replacing a placeholder digest raises it, and a regression that stops judging
 * one of the nine takes the count below it and names the tape.
 */
const JUDGED_FLOOR = 9;

describe("teaching tapes' recorded expectations against their instruments (am-2rl9)", () => {
  test("the counts are reported with their denominator, and the population is not empty", () => {
    for (const row of rows) {
      const where = `${row.tapeId} cp${row.checkpointIndex} "${row.expectation.label}"`;
      if (row.verdict.kind === "judged")
        console.log(
          `[tape expectations] judged   ${where} -> ${row.verdict.field} (${row.verdict.via}): ` +
            `recorded ${row.expectation.value}, ${row.verdict.ownerId} produced ${row.verdict.produced}, ` +
            `within ${row.verdict.allowed} (${row.verdict.agrees ? "agrees" : "DISAGREES"})`,
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

  test("a declared canonical quantity binds one field, and refuses two", () => {
    // ROUTE (b), the one this unit added, with both of its outcomes. Neither is reachable from the
    // corpus today in its refusing form, so it is exercised here rather than left as a branch nobody
    // has seen work: lq-05 does declare two fields with one canonical quantity, but no label of its
    // tapes resolves to that quantity, so the ambiguity guard would otherwise never run.
    const declared: TapeExpectation = {
      label: "pulseSumMoving",
      value: 1.25,
      canonicalQuantityId: "lightComplexEnergyMoving",
    };
    const oneField: ProducedOutput[] = [
      {
        quantityId: "lightComplexEnergyMoving",
        status: "value",
        value: 1.25,
        canonicalQuantityId: "lightComplexEnergyMoving",
        ownerId: "massEnergy.movingBalanceLight",
      },
      {
        quantityId: "emittedEnergyRestFrame",
        status: "value",
        value: 1,
        canonicalQuantityId: "emittedEnergyRestFrame",
      },
    ];
    const judged = judgeExpectation(declared, oneField);
    expect(judged).toMatchObject({
      kind: "judged",
      agrees: true,
      field: "lightComplexEnergyMoving",
    });
    if (judged.kind === "judged")
      expect(judged.via).toBe("both are declared to hold lightComplexEnergyMoving");

    // Two fields declared to hold the same quantity, carrying DIFFERENT numbers, which is lq-05's
    // real shape: configurationProbability and lockedProbability both declare
    // `configurationProbability`, and on the-locked-positions they are 0.0009765625 and 0.5. A
    // canonical match against either would be a coin toss, so it is unjudged and names both.
    const twoFields: ProducedOutput[] = [
      {
        quantityId: "configurationProbability",
        status: "value",
        value: 0.0009765625,
        canonicalQuantityId: "configurationProbability",
      },
      {
        quantityId: "lockedProbability",
        status: "value",
        value: 0.5,
        canonicalQuantityId: "configurationProbability",
      },
    ];
    const ambiguous = judgeExpectation(
      { label: "W (locked)", value: 0.5, canonicalQuantityId: "configurationProbability" },
      twoFields,
    );
    expect(ambiguous.kind).toBe("unjudged");
    if (ambiguous.kind !== "unjudged") throw new Error("unreachable");
    expect(ambiguous.reason).toContain("ambiguous");
    expect(ambiguous.reason).toContain("configurationProbability");
    expect(ambiguous.reason).toContain("lockedProbability");
    // And it is refused even though one of the two carries exactly the recorded number: agreement of
    // a value is not identity of a quantity, which is the whole reason this route is by declaration.
    expect(twoFields.some((f) => f.value === 0.5)).toBe(true);
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
