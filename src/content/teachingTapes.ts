/**
 * THE AUTHORED TEACHING TAPES, READ FOR A READER (am-2rl9).
 *
 * `content/experiments/tapes/` holds 21 tapes, schema-shaped and checked by nothing, and until this
 * module no reader could reach one. AGENTS.md names five of them as a feature ("Einstein's 0.8
 * micron", "Perrin's count", "the boost to 0.6c", "the two pulses", "the locked positions") and the
 * machinery to replay one has been complete for some time: a permalink tape may carry a
 * `teachingTapeRef`, `replayTape` resolves it through `runner.resolveTeachingTape`, and the only
 * implementation of that hook in the repository is a test fixture. So the tapes were authored, the
 * player was built, and the wire between them was never run.
 *
 * WHAT A TAPE ALREADY CARRIES, which is why a page is worth writing rather than a button: a title, a
 * description, the instrument and mode it belongs to, its initial conditions, its events with the
 * command class each one belongs to, and checkpoints carrying a label, a teaching note and the
 * numbers a reader should expect on screen, each with its unit and the constant set it was computed
 * under. That is a worked walkthrough, and it reads as one on a page with no JavaScript at all.
 *
 * This module only READS and shapes. It renders nothing, and it computes no physical quantity: every
 * number it passes on is the number the author wrote in the record.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "./provenance/yaml.ts";

export const TAPES_DIR = join("content", "experiments", "tapes");

/** One thing the reader should see on screen at a checkpoint, as the author recorded it. */
export type TapeExpectedValue = Readonly<{
  label: string;
  value: number;
  unit?: string | undefined;
  constantSetId?: string | undefined;
}>;

/** A step of the walkthrough: what the tape changed, and what the author says to expect. */
export type TapeStep = Readonly<{
  actionIndex: number;
  commandClass?: string | undefined;
  parameterId?: string | undefined;
  value?: number | undefined;
  label?: string | undefined;
  teachingNote?: string | undefined;
  expected: readonly TapeExpectedValue[];
}>;

export type TeachingTape = Readonly<{
  tapeId: string;
  experimentId: string;
  title: string;
  description?: string | undefined;
  mode?: string | undefined;
  constantSetId?: string | undefined;
  seed?: string | undefined;
  initialConditions: Readonly<Record<string, number | string>>;
  steps: readonly TapeStep[];
  /** Named in AGENTS.md's teaching-tape list, so the page can say so. */
  named: boolean;
}>;

/** The five tapes AGENTS.md names by id. */
export const NAMED_IN_AGENTS: readonly string[] = [
  "einstein-0-8-micron",
  "perrins-count",
  "the-boost-to-0.6c",
  "the-two-pulses",
  "the-locked-positions",
];

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function list(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function expectedOf(raw: unknown): TapeExpectedValue[] {
  return list(raw).flatMap((e) => {
    const o = (e ?? {}) as Record<string, unknown>;
    const label = str(o.label);
    const value = num(o.value);
    if (label === undefined || value === undefined) return [];
    return [
      {
        label,
        value,
        ...(str(o.unit) ? { unit: str(o.unit) } : {}),
        ...(str(o.constantSetId) ? { constantSetId: str(o.constantSetId) } : {}),
      },
    ];
  });
}

/**
 * The walkthrough: each control event joined to the checkpoint recorded at the same actionIndex, so
 * a step says both what changed and what to expect. An event with no checkpoint keeps its change and
 * carries no expectations, which is the honest shape: the author recorded none.
 */
export function stepsOf(raw: Record<string, unknown>): TapeStep[] {
  const checkpointAt = new Map<number, Record<string, unknown>>();
  for (const c of list(raw.checkpoints)) {
    const o = (c ?? {}) as Record<string, unknown>;
    const at = num(o.actionIndex);
    if (at !== undefined) checkpointAt.set(at, o);
  }
  const steps: TapeStep[] = [];
  for (const e of list(raw.events)) {
    const o = (e ?? {}) as Record<string, unknown>;
    const actionIndex = num(o.actionIndex);
    if (actionIndex === undefined) continue;
    const c = checkpointAt.get(actionIndex) ?? {};
    steps.push({
      actionIndex,
      ...(str(o.commandClass) ? { commandClass: str(o.commandClass) } : {}),
      ...(str(o.parameterId) ? { parameterId: str(o.parameterId) } : {}),
      ...(num(o.value) !== undefined ? { value: num(o.value) } : {}),
      ...(str(c.label) ? { label: str(c.label) } : {}),
      ...(str(c.teachingNote) ? { teachingNote: str(c.teachingNote) } : {}),
      expected: expectedOf(c.expectedDisplayValues),
    });
  }
  return steps.sort((a, b) => a.actionIndex - b.actionIndex);
}

/** Every authored teaching tape, by id, in id order. A tape with no title is a problem, not a tape. */
export function loadTeachingTapes(root: string = process.cwd()): {
  tapes: TeachingTape[];
  problems: string[];
} {
  const dir = join(root, TAPES_DIR);
  const problems: string[] = [];
  const tapes: TeachingTape[] = [];
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()) {
    const raw = parseYaml(readFileSync(join(dir, file), "utf8")) as Record<string, unknown>;
    const tapeId = str(raw.tapeId);
    const experimentId = str(raw.experimentId);
    const title = str(raw.title);
    const at = `${TAPES_DIR}/${file}`;
    if (!tapeId) {
      problems.push(`tape-no-id: ${at} declares no tapeId`);
      continue;
    }
    if (tapeId !== file.replace(/\.yaml$/, ""))
      problems.push(`tape-id-not-filename: ${at} declares tapeId ${tapeId}`);
    if (!experimentId) problems.push(`tape-no-experiment: ${at} names no experimentId`);
    if (!title)
      problems.push(`tape-no-title: ${at} has no title, so a reader has nothing to call it`);
    const steps = stepsOf(raw);
    if (steps.length === 0)
      problems.push(`tape-no-steps: ${at} records no control event, so there is nothing to walk`);
    tapes.push({
      tapeId,
      experimentId: experimentId ?? "",
      title: title ?? tapeId,
      ...(str(raw.description) ? { description: str(raw.description) } : {}),
      ...(str(raw.mode) ? { mode: str(raw.mode) } : {}),
      ...(str(raw.constantSetId) ? { constantSetId: str(raw.constantSetId) } : {}),
      ...(str(raw.seed) ? { seed: str(raw.seed) } : {}),
      initialConditions: (raw.initialConditions ?? {}) as Record<string, number | string>,
      steps,
      named: NAMED_IN_AGENTS.includes(tapeId),
    });
  }
  return { tapes, problems };
}

/** The tapes of one instrument, for its page to list. */
export function tapesForExperiment(
  experimentId: string,
  root: string = process.cwd(),
): TeachingTape[] {
  return loadTeachingTapes(root).tapes.filter((t) => t.experimentId === experimentId);
}
