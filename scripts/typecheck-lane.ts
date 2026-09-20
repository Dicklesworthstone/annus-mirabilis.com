#!/usr/bin/env bun
/**
 * The typecheck lane (am-14js criterion 5).
 *
 * Two outages in one hour survived every lane green. Neither test lane typechecks - bun strips
 * types and the node lane runs `node --experimental-strip-types`, which also strips them - and the
 * only gate that does, `bun run typecheck`, runs 34 generators first:
 *
 *     prepare:content && prepare:lab && prepare:offline && tsc --noEmit
 *
 * So its exit code cannot tell "the chain broke" from "the types broke". In the light-thread outage
 * it exited 1 with ZERO `error TS` lines, because tsc never ran.
 *
 * This lane runs the two checks SEPARATELY and names which failed. Both historical outages turn it
 * red, for different stated reasons:
 *
 *     ad92ef0b  light-thread registered with no search-paper mapping -> REGISTRY
 *     dacd28fd  TS7053 in avogadro/session.ts                        -> TYPES
 *
 * Cost, measured: `tsc --noEmit` alone takes about 2 seconds on this machine. The expense was never
 * the typechecker; it was the 34 generators in front of it.
 */

import { spawnSync } from "node:child_process";
import { CATALOGUE_IDS, CATALOGUE_STATUS } from "../src/experiments/catalogue.ts";
import { familyPaper } from "../src/search/documents.ts";

export interface LaneCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

/**
 * Every registered instrument must map to a search paper.
 *
 * This is the assertion documentsFromCompiled makes by throwing. Asserting it here costs a map over
 * the catalogue and needs no generator, no content compile and no build.
 */
export function checkInstrumentPaperMapping(
  ids: readonly string[] = CATALOGUE_IDS,
  statusOf: (id: string) => string | undefined = (id) =>
    CATALOGUE_STATUS[id as keyof typeof CATALOGUE_STATUS],
): LaneCheck {
  const registered = ids.filter((id) => statusOf(id) === "registered");
  const unmapped = registered.filter((id) => familyPaper(id) === null);
  return {
    name: "registry",
    ok: unmapped.length === 0,
    detail:
      unmapped.length === 0
        ? `${registered.length} of ${ids.length} catalogue ids are registered; all map to a search paper.`
        : `${unmapped.length} registered instrument(s) map to no search paper, which makes the search index build throw: ${unmapped.join(", ")}. Add the id to the paper map in src/search/documents.ts, or register it under an id the instrument-id grammar accepts.`,
  };
}

/** Count the compiler's own error lines, so "exit 1" is never reported as a type error on its own. */
export function countTypeErrors(tscOutput: string): number {
  return tscOutput.split("\n").filter((line) => /\berror TS\d+:/.test(line)).length;
}

export function checkTypes(runner: () => { status: number | null; output: string }): LaneCheck {
  const { status, output } = runner();
  const errors = countTypeErrors(output);
  if (status === 0 && errors === 0)
    return { name: "types", ok: true, detail: "tsc --noEmit reported no errors." };
  // An exit code with no error line is not a type failure; saying so is the whole point of the lane.
  if (errors === 0)
    return {
      name: "types",
      ok: false,
      detail: `tsc exited ${status} and printed no "error TS" line. That is the compiler failing to RUN, not the types failing. First lines: ${output.split("\n").slice(0, 3).join(" | ")}`,
    };
  return {
    name: "types",
    ok: false,
    detail: `${errors} type error(s):\n${output
      .split("\n")
      .filter((l) => /\berror TS\d+:/.test(l))
      .slice(0, 20)
      .join("\n")}`,
  };
}

export function runTsc(): { status: number | null; output: string } {
  const result = spawnSync("bunx", ["tsc", "--noEmit"], { encoding: "utf8" });
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

export function formatLane(checks: readonly LaneCheck[]): string {
  const failed = checks.filter((c) => !c.ok);
  const lines = checks.map((c) => `  ${c.ok ? "ok  " : "FAIL"} ${c.name.padEnd(9)} ${c.detail}`);
  lines.unshift(
    failed.length === 0
      ? `typecheck lane: ${checks.length} of ${checks.length} checks passed.`
      : `typecheck lane: ${failed.length} of ${checks.length} checks FAILED (${failed.map((c) => c.name).join(", ")}).`,
  );
  return lines.join("\n");
}

if (process.argv[1]?.endsWith("typecheck-lane.ts")) {
  const checks = [checkInstrumentPaperMapping(), checkTypes(runTsc)];
  console.log(formatLane(checks));
  process.exit(checks.every((c) => c.ok) ? 0 : 1);
}
