/**
 * THE GATE CENSUS (am-rc1001-bridge-plan-pcjk.9).
 *
 *   bun scripts/gate-census.ts --list      # no gate is executed; coverage and routes
 *   bun scripts/gate-census.ts             # runs each recorded gate and reads what it printed
 *   bun scripts/gate-census.ts --plants    # also applies each recorded plant and requires a red
 *
 * AGENTS.md states one proposition four times - "A Tool's Exit Code Is Not Evidence Until You Know What
 * It Examined", "A Gate's Own Test Must Not Live Only In The Lane That Gate Controls", "A Check Inherits
 * The Silence Of Whatever It Reads", "A gate that forbids a construct must read code, not text" - and it
 * was enforced nowhere, so every new gate was a fresh chance to forget it. Fourteen gates were measured
 * examining an empty population, a fixture, or the wrong population on 2026-10-01, six on 2026-09-27.
 * Fixing them one at a time has not converged, because the defect is in how gates are made.
 *
 * IT READS, IT DOES NOT TRUST. A gate's examined count and its declared minimum come from the
 * `[census] <gate> examined N <noun> (minimum M)` line that gate printed in THIS run. Nothing is taken
 * from a number written in a census record, because a census that copied a gate's own claim would
 * inherit its silence. The record supplies only what the line cannot: the noun the gate is supposed to
 * examine, how it reads it, and the plant that proves it bites.
 *
 * NOT REGISTERED IN A GATE FAMILY YET, deliberately. The census is designed to start red - it reports 7
 * of 48 steps covered - and registering a red step in the `fast` family would redden every pane's chain
 * and refuse every release while the other 41 gates adopt the line. Registering it is the last step of
 * this bead, after coverage is complete, and it is the owner's call rather than a side effect of this
 * file existing.
 *
 * A PLANT NEVER TOUCHES THE SHARED CHECKOUT. A dozen agents edit this one tree, so planting a violation
 * in it risks a peer staging the planted file in the window between. `--plants` instead makes a DETACHED
 * WORKTREE at HEAD under the session scratchpad, symlinks node_modules into it, and plants there. The
 * worktree is created once and REUSED, and it is never removed: removing a directory is not this
 * script's decision to make (AGENTS.md RULE 1), so the path is printed instead. Measured 2026-10-06:
 * 114 MB, and a gate run inside it reports 3969 tracked files against the main tree's 4085, the
 * difference being the main tree's uncommitted and untracked work - which is the point, since a plant
 * should be judged against a committed state.
 *
 * The planted file is copied beside itself first and the copy is put back afterwards, with the digest
 * printed before, after and on return. A plant whose anchor moved is reported as NOT APPLIED rather than
 * passing as green. And a plant counts only when the gate's own failing output names the text its record
 * says it must: a gate going red on a parse error while the plant is present proves nothing (AGENTS.md,
 * "red plant for the wrong reason").
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { type Finding, judgeGate, judgePlant } from "./gate-census/judge.ts";
import { parsePopulationLines } from "./gate-census/population.ts";
import { allRoutes, reachedBy } from "./gate-census/reach.ts";
import { type GatePlant, recordFor } from "./gate-census/records.ts";
import { QUALITY_GATE_STEPS } from "./quality-gates/registry.ts";

const ROOT = process.cwd();

const digest = (file: string): string =>
  createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 16);

/** Run a gate's command and return its combined output and exit code. Never throws on a non-zero exit. */
function runGate(
  command: readonly string[],
  cwd: string = ROOT,
): { output: string; exitCode: number } {
  const [bin, ...args] = command;
  if (bin === undefined) return { output: "", exitCode: -1 };
  try {
    const output = execFileSync(bin, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
    return { output, exitCode: 0 };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; status?: number };
    return {
      output: `${err.stdout ?? ""}${err.stderr ?? ""}`,
      exitCode: typeof err.status === "number" ? err.status : 1,
    };
  }
}

function scratchRoot(): string {
  const scratch = process.env.CLAUDE_SCRATCHPAD ?? "";
  const dir = scratch.length > 0 ? scratch : join(ROOT, "artifacts", "gate-census");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * A detached worktree at HEAD, reused and never removed. Returns its path, or null with the reason
 * printed when git refuses - in which case plants are SKIPPED rather than redirected into the shared
 * checkout, because a plant in a shared checkout is the thing this avoids.
 */
function gitHead(cwd: string): string {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function ensurePlantWorktree(): string | null {
  const path = join(scratchRoot(), "gate-census-worktree");
  if (existsSync(join(path, "package.json"))) {
    // MOVED TO THE CURRENT HEAD, because a reused worktree stays at the commit it was made from and a
    // plant's anchor is a string in a file at a particular revision. Found by the census's own
    // plant-anchor-missing finding: six plants reported "its anchor appears 0 time(s)" the first time
    // gates adopted the line in a commit newer than the worktree. The finding was right and the fix is
    // here rather than in the plants.
    const wanted = gitHead(ROOT);
    if (gitHead(path) !== wanted) {
      execFileSync("git", ["switch", "--detach", wanted], {
        cwd: path,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      console.log(`  plant worktree moved to ${wanted.slice(0, 8)}: ${path}`);
    } else {
      console.log(`  plant worktree (reused, at ${wanted.slice(0, 8)}): ${path}`);
    }
  } else {
    try {
      execFileSync("git", ["worktree", "add", "--detach", path, "HEAD"], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      console.log(
        `  plants SKIPPED: git worktree add failed (${String((error as Error).message).split("\n")[0]}).`,
      );
      return null;
    }
    console.log(`  plant worktree (new): ${path}`);
  }
  const modules = join(path, "node_modules");
  if (!existsSync(modules)) symlinkSync(join(ROOT, "node_modules"), modules);
  return path;
}

/** Apply one plant inside the throwaway worktree, run the gate there, put the file back, and judge. */
function runPlant(
  gate: string,
  command: readonly string[],
  plant: GatePlant,
  worktree: string,
): Finding[] {
  const target = resolve(worktree, plant.file);
  if (!existsSync(target)) {
    return [
      {
        gate,
        code: "plant-file-missing",
        message: `plant ${plant.id}: ${plant.file} is absent from the worktree at HEAD, so the plant names a file this commit does not have.`,
      },
    ];
  }
  const backup = `${target}.census-copy`;
  copyFileSync(target, backup);
  const digestBefore = digest(target);
  const source = readFileSync(target, "utf8");
  const anchorOccurrences = source.split(plant.find).length - 1;
  let digestAfterPlanting = digestBefore;
  let output = "";
  let exitCode = 0;
  if (anchorOccurrences === 1) {
    writeFileSync(target, source.replace(plant.find, plant.replace), "utf8");
    digestAfterPlanting = digest(target);
    console.log(`    plant ${plant.id}: ${plant.file} ${digestBefore} -> ${digestAfterPlanting}`);
    const run = runGate(command, worktree);
    output = run.output;
    exitCode = run.exitCode;
  }
  copyFileSync(backup, target);
  unlinkSync(backup);
  const digestAfterReverting = digest(target);
  return judgePlant({
    gate,
    plantId: plant.id,
    file: plant.file,
    anchorOccurrences,
    digestBefore,
    digestAfterPlanting,
    digestAfterReverting,
    output,
    exitCode,
    expectFailureNaming: plant.expectFailureNaming,
  });
}

function main(): number {
  const argv = process.argv.slice(2);
  const listOnly = argv.includes("--list");
  const withPlants = argv.includes("--plants");
  const routes = allRoutes(ROOT);
  const findings: Finding[] = [];
  const plantWorktree = withPlants ? ensurePlantWorktree() : null;

  const covered = QUALITY_GATE_STEPS.filter((s) => recordFor(s.id) !== undefined);
  console.log("=== Gate census (am-rc1001-bridge-plan-pcjk.9) ===");
  console.log(`registry steps: ${QUALITY_GATE_STEPS.length}, with census: ${covered.length}`);
  console.log(`routes parsed: ${routes.length}`);

  for (const step of QUALITY_GATE_STEPS) {
    const record = recordFor(step.id);
    const routesHere = reachedBy(routes, step);
    if (record === undefined || listOnly) {
      if (record !== undefined)
        console.log(`  ${step.id}: ${record.noun}; reached by ${routesHere.length} route(s)`);
      findings.push(
        ...judgeGate(step, record, { output: "", exitCode: 0, routes: routesHere }).filter(
          // In --list mode no gate is executed, so a missing line says nothing about the gate.
          (f) => record === undefined || f.code !== "no-population-printed",
        ),
      );
      continue;
    }
    console.log(`  ${step.id}: running ${step.command.join(" ")}`);
    const { output, exitCode } = runGate(step.command);
    findings.push(...judgeGate(step, record, { output, exitCode, routes: routesHere }));
    const line = parsePopulationLines(output).reports.find((r) => r.gate === step.id);
    if (line !== undefined)
      console.log(`    examined ${line.examined} ${line.noun} (minimum ${line.minimum})`);
    if (record.gateRefusesVacuous === false && record.plants.length === 0)
      console.log(
        "    note: this gate does not refuse a vacuous population and has no plant; the census is what notices.",
      );
    if (withPlants && plantWorktree !== null)
      for (const plant of record.plants)
        findings.push(...runPlant(step.id, step.command, plant, plantWorktree));
  }

  console.log(`\nfindings: ${findings.length}`);
  for (const f of findings) console.log(`  [${f.code}] ${f.gate}: ${f.message}`);
  if (covered.length < QUALITY_GATE_STEPS.length) {
    console.log(
      `\nThe census covers ${covered.length} of ${QUALITY_GATE_STEPS.length} steps and is EXPECTED to be red until it covers all of them. ` +
        "It is deliberately not registered in a gate family yet: a red step in the fast family would refuse every release while the rest adopt the line.",
    );
  }
  return findings.length === 0 ? 0 : 1;
}

process.exit(main());
