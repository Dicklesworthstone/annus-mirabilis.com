/**
 * EVERY TEACHING TAPE WHOSE LABORATORY CAN BE DRIVEN CARRIES A DIGEST THE REPLAY REPRODUCES.
 *
 * The defect this guards against was live for three weeks and was invisible in every count. Ten of
 * the twenty-two authored tapes carried a DESCRIPTIVE checkpoint digest -- `host:sha256:sr12-
 * evaluateSr12` and the like -- where the permalink schema requires hex, so each was refused by the
 * converter and reached no reader through a link. Nothing was red. `loadWireTeachingTapes` reported
 * the ten as problems, faithfully, and the only assertion over that list required it to be
 * NON-EMPTY, so the debt was the thing being checked rather than the repair.
 *
 * WHY A DIGEST CANNOT BE AUTHORED, which is why this test drives the laboratory rather than reading
 * a field. a1cf2d23a established it: the digest is a 64-bit FNV-1a over the LABORATORY'S whole
 * accepted parameter set, which for ME-01 includes offsetDisplay, premise, step, cancelAngleFactors,
 * cancelInternalEnergies, cancelAdditiveConstant and notation -- none of which any walkthrough
 * mentions. So the only honest check is to replay and compare, and a check that merely asserted the
 * field matches a regex would have passed all five of the fabricated digests below.
 *
 * THE POPULATION IS DERIVED, NEVER LISTED. A tape is judged when `src/experiments/<lab>/tape.ts`
 * exports a `_TAPE` binding, because that is exactly the condition under which a host replay can
 * reach an accepted state. The five tapes whose laboratories export only a `DraftTapeBinding` --
 * camera-bias, coin-to-bell, einstein-0-8-micron, perrins-count, the-boost-to-0.6c -- are EXCLUDED
 * and NAMED, with the count asserted so the exclusion cannot quietly grow. That is a deliberate
 * architecture rather than an oversight: a worker laboratory's shared link "loads settings only;
 * they never start a calculation" (src/experiments/permalink/draftTape.ts), so no host session
 * stands behind a digest for them. Each of those five currently carries 64 repeated hex digits,
 * which satisfies the schema's digest pattern exactly, and that is reported here rather than
 * asserted, because whether such a record should convert at all is the bead owner's call.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseYaml } from "../../content/provenance/yaml.ts";
import {
  createSessionReplayRunner,
  type LabTapeBinding,
} from "../../experiments/permalink/sessionTape.ts";

const ROOT = resolve(new URL("../../../", import.meta.url).pathname);
const DIR = join(ROOT, "content", "experiments", "tapes");

type TapeRecord = Readonly<{
  tapeId: string;
  experimentId: string;
  initialConditions?: Readonly<Record<string, number | string>>;
  events?: readonly { actionIndex: number; parameterId?: string; value?: number | string }[];
  checkpoints?: readonly { actionIndex: number; digest: string; label?: string }[];
}>;

const records: readonly TapeRecord[] = readdirSync(DIR)
  .filter((f) => f.endsWith(".yaml"))
  .sort()
  .map((f) => parseYaml(readFileSync(join(DIR, f), "utf8")) as TapeRecord);

/** `sr-12` -> `sr12`, the directory a laboratory's modules live in. */
const dirOf = (experimentId: string) => experimentId.replace("-", "");

/** The `_TAPE` binding, when the laboratory has one. A `_DRAFT_TAPE` is deliberately not one. */
async function labTapeBinding(experimentId: string): Promise<LabTapeBinding | undefined> {
  const path = join(ROOT, "src", "experiments", dirOf(experimentId), "tape.ts");
  if (!existsSync(path)) return undefined;
  const module = (await import(path)) as Record<string, unknown>;
  const entry = Object.entries(module).find(
    ([name]) => name.endsWith("_TAPE") && !name.endsWith("_DRAFT_TAPE"),
  );
  return entry?.[1] as LabTapeBinding | undefined;
}

/** The digest a fresh laboratory reaches after this record's conditions and events up to `upTo`. */
async function replayedDigest(
  binding: LabTapeBinding,
  record: TapeRecord,
  upTo: number,
): Promise<string> {
  const runner = createSessionReplayRunner(
    binding,
    binding.createSession(`${record.experimentId}-digest-check`),
  );
  runner.applyInitialConditions((record.initialConditions ?? {}) as never);
  for (const event of [...(record.events ?? [])].sort((a, b) => a.actionIndex - b.actionIndex)) {
    if (event.actionIndex > upTo) break;
    if (event.parameterId === undefined || event.value === undefined) continue;
    runner.applyEvent({
      actionIndex: event.actionIndex,
      paramId: event.parameterId,
      value: event.value,
    } as never);
  }
  return runner.getAcceptedCheckpoint().digest;
}

const drivable: TapeRecord[] = [];
const notDrivable: TapeRecord[] = [];
for (const record of records) {
  const binding = await labTapeBinding(record.experimentId);
  (binding ? drivable : notDrivable).push(record);
}

/**
 * The audit itself, over whatever records it is given, so the plant below reaches the same
 * predicate the corpus does rather than a second copy of it.
 */
async function auditDigests(
  subjects: readonly TapeRecord[],
): Promise<{ checked: number; mismatches: string[] }> {
  const mismatches: string[] = [];
  let checked = 0;
  for (const record of subjects) {
    const binding = await labTapeBinding(record.experimentId);
    if (!binding) continue;
    for (const checkpoint of record.checkpoints ?? []) {
      let replayed: string;
      try {
        replayed = await replayedDigest(binding, record, checkpoint.actionIndex);
      } catch (error) {
        mismatches.push(
          `${record.tapeId} @${checkpoint.actionIndex}: replay refused: ${String(error).slice(0, 120)}`,
        );
        continue;
      }
      checked++;
      if (replayed !== checkpoint.digest) {
        mismatches.push(
          `${record.tapeId} @${checkpoint.actionIndex} (${record.experimentId}): record ${checkpoint.digest}, replay ${replayed}`,
        );
      }
    }
  }
  return { checked, mismatches };
}

describe("recorded checkpoint digests", () => {
  test("the corpus is non-vacuous, and the two populations are named", () => {
    // Denominators, reported. A pass over zero drivable tapes is what this test exists to refuse.
    console.log(
      `[census] teaching tapes: ${records.length} record(s); ${drivable.length} with a lab _TAPE binding, ` +
        `${notDrivable.length} with only a draft binding (${notDrivable.map((r) => r.tapeId).join(", ")})`,
    );
    expect(records.length).toBeGreaterThanOrEqual(22);
    expect(drivable.length).toBeGreaterThanOrEqual(17);
    // The exclusion cannot quietly grow: five worker laboratories, by the architecture above.
    expect(notDrivable.length).toBeLessThanOrEqual(5);
  });

  test("every checkpoint of a drivable tape reproduces under replay", async () => {
    const { checked, mismatches } = await auditDigests(drivable);
    console.log(
      `[census] checkpoint digests replayed: ${checked}, mismatched: ${mismatches.length}`,
    );
    // Non-vacuity before the verdict: 26 checkpoints across 17 tapes, measured 2026-10-20. A
    // binding that stopped importing would otherwise take this to zero checked and still pass.
    expect(checked).toBeGreaterThanOrEqual(26);
    expect(mismatches, mismatches.join("\n")).toEqual([]);
  });

  test("PLANTED: a corrupted digest on a real record is caught, and the finding names it", async () => {
    /*
     * WHICH HALF OF THE QUESTION THIS ANSWERS. The predicate is driven with a real laboratory, a
     * real record and a real replay; what it does NOT exercise is reading the YAML off disk, because
     * planting a bad digest into `content/` would put a defect in a checkout several agents share.
     * So the record is mutated in memory and the same `auditDigests` runs over it.
     *
     * The plant is a single hex digit flipped in an otherwise correct digest, which is the shape a
     * real regression takes: a laboratory's defaults change, the recorded digest no longer matches,
     * and nothing else about the record looks wrong.
     */
    const subject = drivable.find((r) => (r.checkpoints ?? []).length > 0);
    expect(subject, "no drivable record carries a checkpoint to corrupt").toBeDefined();
    if (!subject) return;
    const authentic = subject.checkpoints?.[0]?.digest ?? "";
    expect(authentic).toMatch(/^host:[0-9a-f]{16}$/);

    const flipped = `${authentic.slice(0, -1)}${authentic.endsWith("0") ? "1" : "0"}`;
    expect(flipped).not.toBe(authentic);
    const planted: TapeRecord = {
      ...subject,
      checkpoints: (subject.checkpoints ?? []).map((c, i) =>
        i === 0 ? { ...c, digest: flipped } : c,
      ),
    };
    // WHAT LANDED, before the verdict is read.
    expect(planted.checkpoints?.[0]?.digest).toBe(flipped);

    const { checked, mismatches } = await auditDigests([planted]);
    expect(checked).toBeGreaterThan(0);
    expect(mismatches.length, "the planted corruption was not caught").toBeGreaterThan(0);
    // The finding is actionable: it names the tape, the action index and both digests.
    expect(mismatches[0]).toContain(subject.tapeId);
    expect(mismatches[0]).toContain(flipped);
    expect(mismatches[0]).toContain(authentic);

    // AND THE CONTROL: the same record unmutated must produce no mismatch, or the red above is
    // about the fixture rather than about the flipped digit.
    const clean = await auditDigests([subject]);
    expect(clean.mismatches).toEqual([]);
    expect(clean.checked).toBeGreaterThan(0);
  });

  test("a tape with only a draft binding is excluded for the architecture, and says what it carries", () => {
    /*
     * Reported, not asserted. Each of these carries a run of one repeated hex digit, which the
     * permalink schema's digest pattern admits, so the record converts into a link whose checkpoint
     * can never verify. Whether that should convert is the owner's call; what this test refuses is
     * for the set to change silently.
     */
    const CONSTANT_RUN = /^host:sha256:([0-9a-f])\1{63}$/;
    for (const record of notDrivable) {
      const digests = (record.checkpoints ?? []).map((c) => c.digest);
      console.log(
        `[census] ${record.tapeId} (${record.experimentId}): ${digests.length} checkpoint(s), ` +
          `${digests.filter((d) => CONSTANT_RUN.test(d)).length} a run of one repeated digit`,
      );
      // The one thing asserted: such a record still declares checkpoints, so the day its lab gains
      // a `_TAPE` binding the test above picks it up rather than finding nothing to judge.
      expect(digests.length, `${record.tapeId} declares no checkpoint`).toBeGreaterThan(0);
    }
  });
});
