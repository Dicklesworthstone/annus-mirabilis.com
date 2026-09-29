import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { type ControlTapeV2, validateControlTape } from "../tapes/schema.ts";
import { createSessionReplayRunner, type LabTapeBinding } from "./sessionTape.ts";

/**
 * A RECORDED NUMBER IS ANSWERABLE TO THE INSTRUMENT THAT PRODUCED IT (am-2rl9).
 *
 * The criterion this closes said so plainly: "The present test asserts the records are readable and
 * would pass on a tape whose every number was wrong." It was right. The only test reading
 * `expectedDisplayValues` is bm07.presets.test.ts, which checks each value's `constantSetId` and
 * never compares a number to anything.
 *
 * So each recorded value is matched to a quantity the laboratory computes at the state the record's
 * own events reach, and compared. The state is reached by REPLAYING the record, not by trusting its
 * parameters: the checkpoint digests already prove the state (recordedCheckpoints.test.ts), and this
 * asks the next question, whether the numbers a walkthrough claims a reader will see are the numbers
 * the instrument produces there.
 *
 * COMPARISON KIND: tolerance, through src/units/tolerance.ts, relative 1e-9 and no absolute floor.
 * Not `formatted`, because a record stores a full-precision double (0.005037815259212077) and not a
 * rendering, so formatting both sides would compare strings neither side holds. Not `bitwise`,
 * because the replay reaches its state by applying events one at a time while the recorded number
 * was computed directly, and promising bit equality across those two paths is a promise AGENTS.md
 * declines to make. Relative only, with no absolute term, because the recorded values span
 * 1.9e-22 to 5.2e11: an absolute floor large enough to matter at the top would pass anything at the
 * bottom, which is the trap AGENTS.md names as "an absolute tolerance alone is unsuitable across
 * orders of magnitude". `withinTolerance` refuses a relative-only spec at a reference of zero, so a
 * future recorded zero fails loudly here rather than passing silently.
 *
 * A VALUE THE INSTRUMENT DOES NOT PRODUCE IS NOT A FAILURE OF THE TAPE. Some labels are a
 * laboratory's own quantity names and some are reader labels with a qualifier ("W (locked)"). An
 * unmatched value is counted and printed with its reason, and neither forced into a comparison nor
 * deleted from the record.
 */

const ROOT = process.cwd();
const TAPES = join(ROOT, "content/experiments/tapes");

/**
 * The laboratories a recorded value can be checked against: a live session to replay into, and the
 * evaluator whose numbers the laboratory shows a reader. A form-only laboratory cannot be replayed
 * into at all, so its records are named as out of reach rather than skipped silently.
 */
const LIVE = ["lq-05", "lq-06", "lq-07", "lq-09", "me-01"] as const;

type Produced = Readonly<{
  unit: string;
  status: string;
  value?: unknown;
}>;

async function instrumentOf(lab: string): Promise<
  Readonly<{
    binding: LabTapeBinding;
    /** Every quantity the laboratory computes at these parameters, by the names it knows it under. */
    produce(parameters: object): ReadonlyMap<string, Produced>;
  }>
> {
  const dir = lab.replace("-", "");
  const tape = (await import(`../${dir}/tape.ts`)) as Record<string, unknown>;
  const binding = Object.values(tape).find(
    (value) => value && typeof value === "object" && "createSession" in value,
  ) as LabTapeBinding | undefined;
  if (!binding) throw new Error(`${lab} has no live tape binding`);
  const session = (await import(`../${dir}/session.ts`)) as Record<string, unknown>;
  const evaluate = Object.entries(session).find(([name]) => /^evaluate/u.test(name))?.[1] as
    | ((parameters: object) => unknown)
    | undefined;
  if (!evaluate) throw new Error(`${lab} has no evaluator`);
  return {
    binding,
    produce(parameters) {
      const out = evaluate(parameters);
      const found = new Map<string, Produced>();
      // Two names for the same quantity, because the records use both: the evaluator's own key, as
      // ME-01's labels do, and the quantityId, as lq-06's gasEntropy and lq-09's ionizationCount do.
      const add = (name: string, result: unknown) => {
        if (!result || typeof result !== "object") return;
        const r = result as Produced & { quantityId?: unknown };
        if (typeof r.unit !== "string" || typeof r.status !== "string") return;
        if (!found.has(name)) found.set(name, r);
        if (typeof r.quantityId === "string" && !found.has(r.quantityId))
          found.set(r.quantityId, r);
      };
      if (Array.isArray(out)) for (const result of out) add("", result);
      else for (const [key, result] of Object.entries(out as object)) add(key, result);
      found.delete("");
      return found;
    },
  };
}

const records = readdirSync(TAPES)
  .filter((file) => file.endsWith(".yaml"))
  .sort()
  .map((file) => ({
    file,
    record: validateControlTape(
      strictParse(readFileSync(join(TAPES, file), "utf8"), "yaml", file),
      file,
    ) as ControlTapeV2,
  }))
  .filter(({ record }) =>
    record.checkpoints.some((checkpoint) => (checkpoint.expectedDisplayValues?.length ?? 0) > 0),
  );

const inReach = records.filter(({ record }) =>
  (LIVE as readonly string[]).includes(record.experimentId),
);
const outOfReach = records.filter(
  ({ record }) => !(LIVE as readonly string[]).includes(record.experimentId),
);

const TOLERANCE = { relative: 1e-9 } as const;

describe("recorded display values against the instrument that produces them", () => {
  test("the population, and what it cannot reach", () => {
    expect(records.length).toBeGreaterThan(0);
    expect(inReach.length).toBeGreaterThan(0);
    // Named rather than dropped: a form-only laboratory starts nothing, so no replay reaches a state
    // to evaluate, and a record that does not convert cannot be replayed at all.
    expect(outOfReach.map(({ record }) => record.tapeId).sort()).toEqual([
      "camera-bias",
      "einstein-0-8-micron",
      "perrins-count",
      "the-1906-box",
      "the-boost-to-0.6c",
      "toward-low-speed",
      "where-the-energy-went",
    ]);
  });

  test("every recorded value that names a quantity the laboratory computes agrees with it", async () => {
    let recorded = 0;
    let compared = 0;
    let agreed = 0;
    const unmatched: string[] = [];
    const disagreed: string[] = [];

    for (const { record } of inReach) {
      const instrument = await instrumentOf(record.experimentId);
      for (const checkpoint of record.checkpoints) {
        const expected = checkpoint.expectedDisplayValues ?? [];
        if (expected.length === 0) continue;
        const runner = createSessionReplayRunner(
          instrument.binding,
          instrument.binding.createSession(`values-${record.tapeId}-${checkpoint.actionIndex}`),
        );
        runner.applyInitialConditions(record.initialConditions);
        for (const event of record.events) {
          if (!("parameterId" in event) || event.actionIndex > checkpoint.actionIndex) continue;
          runner.applyEvent({
            actionIndex: event.actionIndex,
            commandClass: event.commandClass,
            paramId: (event as unknown as { parameterId: string }).parameterId,
            value: event.value,
          });
        }
        const produced = instrument.produce(runner.getCurrentState());
        for (const value of expected) {
          recorded += 1;
          const where = `${record.tapeId} @${checkpoint.actionIndex} "${value.label}"`;
          const match = produced.get(value.label);
          if (!match) {
            unmatched.push(`${where}: the laboratory computes no quantity by that name`);
            continue;
          }
          if (match.status !== "value" || typeof match.value !== "number") {
            unmatched.push(`${where}: the laboratory reports it as ${match.status}, not a number`);
            continue;
          }
          if (match.unit !== value.unit) {
            unmatched.push(`${where}: recorded in ${value.unit}, computed in ${match.unit}`);
            continue;
          }
          compared += 1;
          const verdict = withinTolerance(match.value, value.value, TOLERANCE);
          // The verdict's boolean is `ok` and its reason is `kind`; reading a field this type does
          // not have made thirteen identical numbers report as disagreements on the first run.
          if (verdict.ok) agreed += 1;
          else
            disagreed.push(
              `${where}: recorded ${value.value}, computed ${match.value} ` +
                `(${verdict.kind}, diff ${verdict.diff} allowed ${verdict.allowed}` +
                `${verdict.issues.length > 0 ? `, ${verdict.issues.map((i) => i.code).join(" ")}` : ""})`,
            );
        }
      }
    }

    // The denominator beside the verdict: a test that examined zero values reads exactly like a clean
    // one, and this file exists because the previous one looked clean while checking nothing numeric.
    console.log(
      `[recorded display values] ${recorded} recorded, ${compared} compared, ${agreed} agreed, ` +
        `${unmatched.length} unmatched, over ${inReach.length} records in reach of ${records.length}`,
    );
    for (const line of unmatched) console.log(`  unmatched: ${line}`);

    expect(recorded).toBeGreaterThan(0);
    // Measured after the run, not guessed before it: the floor is what this corpus actually reaches,
    // so a record that stops being comparable shows up here rather than thinning the check quietly.
    expect(compared).toBeGreaterThanOrEqual(10);
    expect(disagreed).toEqual([]);
    expect(agreed).toBe(compared);
  });
});
