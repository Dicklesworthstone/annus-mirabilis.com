import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { type ControlTapeV2, validateControlTape } from "../tapes/schema.ts";
import { createSessionReplayRunner, type LabTapeBinding } from "./sessionTape.ts";

/**
 * A WALKTHROUGH'S RECORDED CHECKPOINT DIGEST IS A MEASUREMENT, AND THIS RE-DERIVES IT (am-2rl9).
 *
 * WHAT A CORRECT DIGEST IS. `tapeStateDigestV2` is a 64-bit FNV-1a over the laboratory's whole
 * accepted parameter set, sorted, each number to twelve significant digits, then the action index,
 * written `host:` and sixteen hex digits. The state it covers is the LABORATORY'S, not the record's:
 * for ME-01 it includes offsetDisplay, premise, step, cancelAngleFactors, cancelInternalEnergies,
 * cancelAdditiveConstant and notation, none of which any walkthrough mentions. So a correct digest is
 * the one a fresh session reaches after applying the record's initial conditions and the events up to
 * that checkpoint's action index.
 *
 * WHETHER A RECORD CAN LEGITIMATELY CARRY ONE. It can carry a RECORDED one and cannot carry an
 * AUTHORED one. No author can evaluate that hash over a parameter set their record does not mention,
 * and six of the seven records proved it: they carried placeholders of one repeated digit
 * (host:sha256:1111…, 2222…, 3333…, 4444…, 5555…, 6666…, 7777…, 8888…). The seventh, the-two-pulses,
 * carried four checkpoints of which THREE were already exactly right to sixteen hex digits, which is
 * not chance: those were derived. Only its last was wrong, and no state that could be constructed
 * reproduced it.
 *
 * WHICH MAKES THIS FILE THE OTHER HALF OF THE ARRANGEMENT. A derived value in a hand-authored file
 * goes stale silently: the digest covers the laboratory's defaults, so adding one presentation
 * parameter to a laboratory changes every digest of every walkthrough on it. That is the checkpoint
 * doing its job, and it is a maintenance obligation rather than a surprise only if something
 * re-derives the value. This does, for every record whose laboratory has a live session, and prints
 * the value to write when it disagrees.
 *
 * The population is named rather than filtered silently: a laboratory with only a draft binding fills
 * a form and starts nothing, so no replay can reach a digest for it, and those records are listed
 * below rather than skipped by an empty loop.
 */

const ROOT = process.cwd();
const TAPES = join(ROOT, "content/experiments/tapes");

/** Laboratories with a live session. A draft-binding laboratory cannot be replayed into. */
const LIVE_BINDINGS: Readonly<Record<string, string>> = {
  "lq-05": "lq05",
  "lq-06": "lq06",
  "lq-07": "lq07",
  "lq-09": "lq09",
  "me-01": "me01",
};

const records = readdirSync(TAPES)
  .filter((file) => file.endsWith(".yaml"))
  .sort()
  .map((file) => ({
    file,
    // strictParse's second argument is the FORMAT, not a label; the label is third.
    record: validateControlTape(
      strictParse(readFileSync(join(TAPES, file), "utf8"), "yaml", file),
      file,
    ) as ControlTapeV2,
  }));

const live = records.filter(({ record }) => LIVE_BINDINGS[record.experimentId] !== undefined);
const formOnly = records.filter(({ record }) => LIVE_BINDINGS[record.experimentId] === undefined);

async function bindingOf(lab: string): Promise<LabTapeBinding> {
  const mod = (await import(`../${LIVE_BINDINGS[lab]}/tape.ts`)) as Record<string, unknown>;
  const found = Object.values(mod).find(
    (value) => value && typeof value === "object" && "createSession" in value,
  );
  if (!found) throw new Error(`${lab} has no live tape binding`);
  return found as LabTapeBinding;
}

/** The digest a fresh session reaches at one checkpoint's action index. */
async function derive(record: ControlTapeV2, actionIndex: number): Promise<string> {
  const binding = await bindingOf(record.experimentId);
  const runner = createSessionReplayRunner(
    binding,
    binding.createSession(`checkpoint-${record.tapeId}-${actionIndex}`),
  );
  runner.applyInitialConditions(record.initialConditions);
  for (const event of record.events) {
    if (!("parameterId" in event) || event.actionIndex > actionIndex) continue;
    runner.applyEvent({
      actionIndex: event.actionIndex,
      commandClass: event.commandClass,
      paramId: (event as unknown as { parameterId: string }).parameterId,
      value: event.value,
    });
  }
  return runner.getAcceptedCheckpoint().digest;
}

describe("every recorded checkpoint digest is one a replay reaches", () => {
  test("the population is not empty, and says which records it cannot judge", () => {
    expect(records.length).toBeGreaterThan(0);
    expect(live.length).toBeGreaterThan(0);
    // Named, not silently dropped: these laboratories have no live session to replay into.
    expect(formOnly.map(({ record }) => record.experimentId).sort()).toEqual([
      "bm-01",
      "bm-05",
      "bm-07",
      "bm-08",
      "me-02",
      "me-03",
      "me-03",
      "sr-02",
      "sr-03",
      "sr-08",
      "sr-09",
      "sr-10",
      "sr-11",
      "sr-12",
      "sr-13",
    ]);
  });

  for (const { file, record } of live) {
    test(`${file}: ${record.checkpoints.length} checkpoint(s)`, async () => {
      expect(record.checkpoints.length).toBeGreaterThan(0);
      for (const checkpoint of record.checkpoints) {
        const reached = await derive(record, checkpoint.actionIndex);
        // On disagreement the message carries the value to write, so re-deriving is running this.
        expect({
          at: checkpoint.actionIndex,
          digest: checkpoint.digest,
        }).toEqual({ at: checkpoint.actionIndex, digest: reached });
        // A digest is `host:` and sixteen hex digits; a placeholder of one repeated digit is not one.
        expect(checkpoint.digest).toMatch(/^host:[0-9a-f]{16}$/u);
        expect(/^host:(\d)\1{15}$/u.test(checkpoint.digest)).toBe(false);
      }
    });
  }
});
