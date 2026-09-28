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
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

/**
 * A teaching tape's identity against the instrument it belongs to (am-2rl9).
 *
 * WHY THIS EXISTS. Nothing replays a tape, so nothing had ever compared one with its instrument, and
 * measured 2026-09-27 the two had drifted in three independent directions at once:
 *
 * - 12 of 21 tapes recorded a model identity the instrument's manifest contradicts. Most were the
 *   version written as "1.0.0" where the manifest and the runtime binding both say 1, and five named
 *   a different model entirely (`sr03-rod-simultaneity-v1` where sr-03's manifest and its own
 *   draftTape both say `sr-03`). Every disputed case resolved the same way: the manifest and the
 *   runtime binding agreed and the hand-authored tape was the odd one out.
 * - 6 authored tapes were named by no manifest, among them `the-boost-to-0.6c`, which AGENTS.md
 *   names by id as a feature.
 * - 3 tape ids were declared by a manifest with no record behind them.
 *
 * The first two are fixed. The third is reported, not asserted away: a declared tape nobody has
 * written yet is a plan, and removing the declaration would erase it.
 *
 * WHAT A MISMATCH COSTS, which is why this is not bookkeeping. `checkTapeCompatibility` compares
 * modelId and modelVersion with `!==`, so a tape whose identity disagrees is REFUSED before a reader
 * sees anything. It is also strict across the string/number boundary: with the version quoted as
 * "1" against the runtime's 1 the refusal fires and its notice reads "Recorded under
 * brownian-motion-reference@v1; current is brownian-motion-reference@v1", naming two values that
 * look identical. That is a refusal that cannot explain itself, and it is filed separately.
 */
export type TapeIdentityReport = Readonly<{
  checked: number;
  modelMismatches: readonly string[];
  undeclared: readonly string[];
  declaredWithNoRecord: readonly string[];
}>;

/** Tape ids a manifest declares that nobody has written yet. A plan, not a defect. */
export const PLANNED_TAPES: readonly string[] = [
  "bm-04-balance-tape-01",
  "lq-06-the-move-walkthrough",
  "photoelectric-millikan-walkthrough",
];

function manifestBlock(text: string, key: string): string | undefined {
  const m = new RegExp(String.raw`^${key}:\s*\n((?:\s+.*\n)+)`, "m").exec(text);
  return m?.[1];
}

function scalar(text: string, key: string): string | undefined {
  const m = new RegExp(String.raw`^\s*${key}:\s*"?([^"\n]+)"?\s*$`, "m").exec(text);
  return m?.[1]?.trim();
}

export function tapeIdentityReport(root: string = process.cwd()): TapeIdentityReport {
  const manifestDir = join(root, "content", "experiments");
  const declared = new Set<string>();
  for (const file of readdirSync(manifestDir).filter((f) => f.endsWith(".yaml"))) {
    const block = manifestBlock(readFileSync(join(manifestDir, file), "utf8"), "teachingTapes");
    if (!block) continue;
    for (const m of block.matchAll(/^\s*-\s*tapeId:\s*"?([^"\n]+)"?\s*$/gm))
      declared.add((m[1] ?? "").trim());
  }

  const modelMismatches: string[] = [];
  const authored = new Set<string>();
  const dir = join(root, TAPES_DIR);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".yaml"))) {
    const text = readFileSync(join(dir, file), "utf8");
    const id = file.replace(/\.yaml$/, "");
    authored.add(id);
    const experimentId = scalar(text, "experimentId");
    const identity = manifestBlock(text, "modelIdentity");
    if (!experimentId || !identity) continue;
    const manifestPath = join(manifestDir, `${experimentId}.yaml`);
    if (!existsSync(manifestPath)) continue;
    const tapeModel = manifestBlock(readFileSync(manifestPath, "utf8"), "tapeModel");
    if (!tapeModel) continue;
    const want = `${scalar(tapeModel, "modelId")}@${scalar(tapeModel, "modelVersion")}`;
    const got = `${scalar(identity, "modelId")}@${scalar(identity, "modelVersion")}`;
    if (want !== got)
      modelMismatches.push(`${id}: records ${got}, ${experimentId} declares ${want}`);
  }

  return {
    checked: authored.size,
    modelMismatches,
    undeclared: [...authored].filter((id) => !declared.has(id)).sort(),
    declaredWithNoRecord: [...declared].filter((id) => !authored.has(id)).sort(),
  };
}
