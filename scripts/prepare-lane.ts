#!/usr/bin/env bun
/**
 * The prepare lane (am-w6sn).
 *
 * `typecheck`, `test` and `build` all began with the same prelude:
 *
 *     bun run prepare:content && bun run prepare:lab && bun run prepare:offline && <the real command>
 *
 * Thirty-five generators in one `&&` chain, and a throw in any of them stops it. So an authored
 * data fault made "does this tree compile" unanswerable: the chain exited 1 having never reached
 * the typechecker, and exit 1 is also what a type error looks like. The orchestrator read exactly
 * that exit 1 as a broken HEAD and reported it as one, while `tsc --noEmit` alone exited 0 with
 * zero errors and the real cause was a peer's in-flight registry entry.
 *
 * THIS LANE DOES NOT REMOVE THE PRELUDE. The generators exist because generated content has to be
 * present, and repo law requires `prepare:content` before committing anything under `content/`.
 * What was missing is attribution and a distinguishable outcome, so that is what this adds:
 *
 *   - the failing STEP is named, with its phase and its position in the chain
 *   - the error MESSAGE is printed without its stack frames, the way build-content.ts already
 *     reports its validated failures
 *   - the exit code is PREPARE_FAILED_EXIT, which is neither code the type path produces, so a
 *     caller can tell "the chain broke" from "the types broke"
 *
 * ONE BOUNDARY RATHER THAN TWENTY-THREE. The bead offers either a main-path boundary in each of the
 * 23 uncaught throwers or a recorded reason. A single boundary here is chosen deliberately: it
 * attributes every step including the ten with no throw sites at all (a generator can fail by
 * exiting non-zero without throwing), it cannot drift out of step with the chain because it reads
 * the chain itself, and it does not require edits to 23 files that other panes are working in -
 * am-14js is being held for exactly that reason. A local boundary in a specific script is still
 * worth adding where that script can say something this one cannot, such as naming the record and
 * the file; this lane is what makes the failure legible in the meantime.
 *
 * THE STEP LIST IS DERIVED, NEVER COPIED. It is read from the same `package.json` scripts the chain
 * is defined in. The bead counted 34 steps and there are 35 today, which is precisely what a second
 * hand-maintained copy would have got wrong.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Nine, because the type path uses 1 and 2 and which one it uses depends on how tsc is invoked.
 * Measured on this tree with one planted TS2322, same compiler version (5.7.3) both ways:
 *
 *     ./node_modules/.bin/tsc --noEmit   exit 2   <- what `bun run typecheck` actually runs
 *     bunx tsc --noEmit                  exit 1
 *
 * `bun run` itself propagates faithfully (probed: a script exiting 1 gives 1, one exiting 9 gives
 * 9), so the difference is in the tsc wrapper rather than the runner. Avoiding BOTH is what makes
 * the code meaningful; picking 1 would have collided with one invocation and 2 with the other.
 */
export const PREPARE_FAILED_EXIT = 9;

/**
 * A typed refusal, in the form am-p465 adopted: the kebab code is the FIRST argument.
 *
 * This file shipped with a bare `throw new Error` and the bare-throw ratchet caught it on the
 * commit that introduced it. Coding it rather than baselining it, because a baseline records debt
 * you inherited and this debt was one tick old - a new file should not open a baseline entry on
 * its first commit.
 */
export class PrepareLaneError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PrepareLaneError";
    this.code = code;
  }
}

export const PREPARE_PHASES = ["prepare:content", "prepare:lab", "prepare:offline"] as const;
export type PreparePhase = (typeof PREPARE_PHASES)[number];

export interface PrepareStep {
  readonly phase: PreparePhase;
  readonly command: string;
  readonly index: number;
  readonly total: number;
}

export interface PrepareFailure {
  readonly step: PrepareStep;
  readonly exitCode: number;
  readonly message: string;
  readonly rawStderr: string;
}

/**
 * The chain, in order, read from the scripts map rather than restated.
 *
 * A phase that is absent is a fault, not an empty phase: silently running zero generators and
 * reporting success is the shape of a check that passed on an empty set.
 */
export function prepareSteps(scripts: Readonly<Record<string, string>>): readonly PrepareStep[] {
  const commands: { phase: PreparePhase; command: string }[] = [];
  for (const phase of PREPARE_PHASES) {
    const chain = scripts[phase];
    if (chain === undefined || chain.trim() === "") {
      throw new PrepareLaneError(
        "prepare-phase-missing",
        `package.json has no "${phase}" script, so the prepare lane would run fewer generators than the build does and report success for work it never did.`,
      );
    }
    for (const raw of chain.split("&&")) {
      const command = raw.trim();
      if (command !== "") commands.push({ phase, command });
    }
  }
  return Object.freeze(commands.map((c, i) => ({ ...c, index: i + 1, total: commands.length })));
}

/**
 * The error line a reader has to act on, with the stack thrown away.
 *
 * A generator that throws prints `TypeError: <message>` followed by `at ...` frames naming files
 * inside the generator, which is the wrong place to look: the fault is in authored data. The frames
 * are dropped and the message is kept. Anything that is not a recognisable error line falls back to
 * the last non-empty line, because a script that fails by writing a plain diagnostic and exiting
 * non-zero is a legitimate failure shape too and must not come back empty.
 */
export function firstErrorLine(stderr: string): string {
  const lines = stderr.split("\n").map((l) => l.trimEnd());
  for (const line of lines) {
    const t = line.trim();
    if (t === "" || t.startsWith("at ")) continue;
    if (/^[A-Za-z_$][\w$]*(Error|Exception):/.test(t) || t.startsWith("error:")) {
      return t;
    }
  }
  const meaningful = lines.filter((l) => l.trim() !== "" && !l.trim().startsWith("at "));
  return meaningful.at(-1) ?? "";
}

/** The diagnostic. Names the step, the phase and the message, and carries no stack frame. */
export function formatFailure(failure: PrepareFailure): string {
  const { step } = failure;
  return [
    "",
    `PREPARE FAILED. This is a generator fault, NOT a type error.`,
    `  phase   : ${step.phase}`,
    `  step    : ${step.index} of ${step.total}`,
    `  command : ${step.command}`,
    `  exit    : ${failure.exitCode}`,
    `  message : ${failure.message}`,
    "",
    `The typechecker, test runner and build never ran, so this exit says nothing about whether the`,
    `tree compiles. Run "bun run check:types" to answer that separately.`,
    "",
  ].join("\n");
}

export type StepExecutor = (command: string) => { status: number; stderr: string };

/** Runs the chain in order and stops at the first failing step, which is the `&&` semantics. */
export function runPrepare(
  steps: readonly PrepareStep[],
  exec: StepExecutor,
): PrepareFailure | null {
  for (const step of steps) {
    const result = exec(step.command);
    if (result.status !== 0) {
      return {
        step,
        exitCode: result.status,
        message: firstErrorLine(result.stderr),
        rawStderr: result.stderr,
      };
    }
  }
  return null;
}

function main(): void {
  const root = process.cwd();
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const steps = prepareSteps(pkg.scripts ?? {});
  const failure = runPrepare(steps, (command) => {
    const [file, ...args] = command.split(/\s+/);
    const run = spawnSync(file ?? "", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "inherit", "pipe"],
    });
    if (run.stderr) process.stderr.write(run.stderr);
    return { status: run.status ?? 1, stderr: run.stderr ?? "" };
  });

  if (failure) {
    process.stderr.write(formatFailure(failure));
    process.exit(PREPARE_FAILED_EXIT);
  }
  process.stdout.write(`prepare lane: ${steps.length} generators ran, all clean.\n`);
}

if (import.meta.main) main();
