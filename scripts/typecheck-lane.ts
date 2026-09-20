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
 * Every catalogue id must map to a search paper.
 *
 * This is the assertion documentsFromCompiled makes by throwing, and it is the one cross-check
 * nobody had: registryDispatch.test.ts checks the catalogue against OWNER_BINDINGS and
 * CATALOGUE_QUESTIONS - same population, different codomain - and the search-paper mapping went
 * unchecked until light-thread was added to the catalogue without being added to the id grammar.
 *
 * THE DIRECTION IS CATALOGUE -> GRAMMAR, and it is not symmetric. The catalogue
 * (src/experiments/catalogue.ts) is authoritative for which instruments exist; the grammar
 * (CORE_INSTRUMENT_PATTERN and NON_CORE_INSTRUMENT_IDS in src/content/ids.ts) is authoritative for
 * which id strings are well-formed. Deriving the grammar from the catalogue would make every id
 * anyone writes well-formed by construction, and parseInstrumentId could never reject a typo -
 * src/content/ids.test.ts asserts it rejects "shelf-fizaeu" and "LQ-01", and those assertions only
 * mean something while the grammar is independent.
 *
 * ALL 38 CATALOGUE IDS, NOT THE 34 REGISTERED ONES. The filter used to mirror
 * documentsFromCompiled, which skips non-registered instruments, but mirroring one consumer's slice
 * is the wrong denominator: an id is an id whether or not it is registered, well-formedness does not
 * depend on status, and src/content/anchors.ts parses ids without consulting it. Widening changed no
 * verdict on the day it was made - all 38 parse - which is what makes it safe to state.
 */
export function checkInstrumentPaperMapping(
  ids: readonly string[] = CATALOGUE_IDS,
  statusOf: (id: string) => string | undefined = (id) =>
    CATALOGUE_STATUS[id as keyof typeof CATALOGUE_STATUS],
): LaneCheck {
  // The vacuity guard, and it is the same one registryDispatch.test.ts needs for the same reason:
  // "every id maps" over an empty catalogue is true and establishes nothing. A catalogue that has
  // become empty is a loading fault, not a clean bill.
  if (ids.length === 0) {
    return {
      name: "registry",
      ok: false,
      detail:
        "the instrument catalogue is empty, so 'every id maps to a search paper' is vacuously true and establishes nothing. CATALOGUE_STATUS in src/experiments/catalogue.ts failed to load or was emptied.",
    };
  }
  const unmapped = ids.filter((id) => familyPaper(id) === null);
  const registered = ids.filter((id) => statusOf(id) === "registered").length;
  return {
    name: "registry",
    ok: unmapped.length === 0,
    detail:
      unmapped.length === 0
        ? `${ids.length} catalogue ids (${registered} registered); all map to a search paper.`
        : `${unmapped.length} of ${ids.length} catalogue id(s) map to no search paper, which makes the search index build throw: ${unmapped.join(", ")}. Add the id to the non-core list in src/content/ids.ts, or use an id the instrument-id grammar accepts.`,
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
