/**
 * CLI argument parsing for the harness entry point (am-test-e2e-harness-bqmh
 * requirement 12):
 *
 *   bun scripts/e2e-paper-vertical-slices.ts [--paper <slug> | --fixtures | --smoke] [--lane <name>] [--journey <id>]
 *
 * This is a distinct, smaller surface from `parsePaperE2EArgs` in
 * `scripts/e2e/paper-e2e-contract.ts` (am-scaf-extract-scripts-7jm), which
 * parses the donor-extracted infrastructure runner's own flags
 * (`--all`, `--changed`, `--base-url`, `--viewports`, ...). Wiring these
 * two flag sets into one CLI entry point belongs to whichever change first
 * connects the paper lanes to that runner; this module only owns parsing
 * the flags requirement 12 names.
 */

import { laneByName } from "./lanes.ts";

export type E2ECliMode =
  | { kind: "paper"; paperSlug: string }
  | { kind: "fixtures" }
  | { kind: "smoke" };

export interface E2ECliOptions {
  readonly mode: E2ECliMode;
  readonly lane: string | undefined;
  readonly journey: string | undefined;
}

function requireValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

/**
 * `knownPaperSlugs`, when supplied, rejects an unrecognized `--paper` slug
 * naming the known ones. With no list, only the flag grammar is checked —
 * this module must not import the compiled content registry to parse a CLI
 * flag, matching the same boundary `domContract.ts` draws for instrument
 * addresses.
 */
export function parseE2ECliArgs(
  argv: readonly string[],
  knownPaperSlugs?: readonly string[],
): E2ECliOptions {
  let mode: E2ECliMode | undefined;
  let lane: string | undefined;
  let journey: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--fixtures") {
      if (mode) throw new Error("select exactly one of --paper, --fixtures, or --smoke");
      mode = { kind: "fixtures" };
    } else if (argument === "--smoke") {
      if (mode) throw new Error("select exactly one of --paper, --fixtures, or --smoke");
      mode = { kind: "smoke" };
    } else if (argument === "--paper") {
      if (mode) throw new Error("select exactly one of --paper, --fixtures, or --smoke");
      const paperSlug = requireValue("--paper", value);
      if (knownPaperSlugs && !knownPaperSlugs.includes(paperSlug)) {
        throw new Error(
          `unknown paper slug "${paperSlug}"; known papers: ${knownPaperSlugs.join(", ") || "<none>"}`,
        );
      }
      mode = { kind: "paper", paperSlug };
      index += 1;
    } else if (argument === "--lane") {
      lane = requireValue("--lane", value);
      laneByName(lane); // throws naming the known lanes when unrecognized
      index += 1;
    } else if (argument === "--journey") {
      journey = requireValue("--journey", value);
      index += 1;
    } else {
      throw new Error(`unknown option "${argument}"`);
    }
  }

  if (!mode) throw new Error("select exactly one of --paper <slug>, --fixtures, or --smoke");
  return { mode, lane, journey };
}
