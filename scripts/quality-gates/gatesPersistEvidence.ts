/**
 * DOES A REGISTERED GATE LEAVE ANYTHING BEHIND? (am-uxh9)
 *
 * The bead's defect class is a gate whose report has no row for the thing it is registered to
 * enforce, and its sharpest form is a gate with no report at all: the run's findings exist until the
 * terminal scrolls, so a refusal cannot be compared with yesterday's and a pass cannot be told apart
 * from a gate that never executed.
 *
 * WHY THIS IS A FUNCTION AND NOT A SWEEP. The bead was answered once, by hand, against 27 registry
 * steps. The registry now holds 48. The twenty-one that landed afterwards were never asked, and five
 * of them were silent - including the OCR guard, which enforces the one rule AGENTS.md grants no
 * exception. A measurement that has to be repeated by hand goes stale at exactly the rate the thing
 * it measures grows.
 *
 * THE METHOD IS THE ONE THE BEAD'S VERIFIER WROTE DOWN AND NOBODY RAN. Grepping a gate's own script
 * for a write call is a false-negative generator, because a gate can persist through a helper:
 * verify-facsimile-pins.ts contains no fs write anywhere in its 965 lines and every write happens
 * inside TestLogger. The verifier's conclusion was "a persistence audit must follow local imports
 * one hop, minimum", and that is what `followsOneHop` does.
 *
 * AND IT READS CODE, NOT TEXT. Comments are blanked before matching, for the reason AGENTS.md states
 * under "A gate that forbids a construct must read code, not text": the densest prose about
 * persistence is the docblock of a gate explaining how it persists, and crediting that prose would
 * mark a silent gate as healthy. The planted case in the test covers both directions.
 *
 * WHAT IT CANNOT TELL YOU. This answers whether a gate persists, not whether what it persisted is
 * true. The bead recorded that limit in its own words: verify-wasm-artifacts had a healthy report
 * while reading a field the vectors file never had, and "a check that reads a nonexistent field
 * emits a perfectly well-formed PASS row". Report shape and check validity are different properties
 * and this module settles only the first.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { blankComments } from "../../src/testing/source/comments.ts";

export interface GateLike {
  readonly id: string;
  readonly availability: { readonly scriptPath?: string | undefined };
}

export interface PersistenceReport {
  /** Gates with a script of their own that persists, with where the evidence was found. */
  readonly persists: readonly { readonly id: string; readonly via: string }[];
  /** Gates with a script of their own that persists nothing. The set this gate drives to empty. */
  readonly silent: readonly { readonly id: string; readonly scriptPath: string }[];
  /** Steps that delegate to an external tool or a config file, so they have no report of their own. */
  readonly delegates: readonly { readonly id: string; readonly scriptPath: string }[];
  readonly stepsExamined: number;
}

/**
 * The calls that actually write an artifact, directly or through this repository's logger.
 *
 * `new TestLogger(` and `getLogger(` are the repository's own writers; the rest are the raw and
 * scaffold forms the older gates use. A gate that invents a sixth way to persist will read as silent
 * here, which is the safe direction: a false alarm costs a line in this list, while a missing pattern
 * would quietly excuse a gate that writes nothing.
 */
const PERSISTS =
  /new TestLogger\(|getLogger\(|appendLogLine\(|logPathFor\(|writePerfReport\(|appendFileSync\(|writeFileSync\(|appendFile\(/;

/** A scriptPath that is a config file rather than a program names a delegating step, not a gate. */
const CONFIG_FILE = /\.(json|mjs|cjs)$/;

function persistsInSource(code: string): boolean {
  return PERSISTS.test(blankComments(code));
}

/** The relative imports of one module, resolved against the filesystem. One hop, no transitive walk. */
export function localImportsOf(absPath: string, code: string): string[] {
  const found: string[] = [];
  for (const match of code.matchAll(/from\s+"(\.[^"]+)"/g)) {
    const target = resolve(dirname(absPath), match[1] as string);
    if (existsSync(target)) found.push(target);
  }
  return found;
}

export function auditGatePersistence(steps: readonly GateLike[], root: string): PersistenceReport {
  const persists: { id: string; via: string }[] = [];
  const silent: { id: string; scriptPath: string }[] = [];
  const delegates: { id: string; scriptPath: string }[] = [];

  for (const step of steps) {
    const scriptPath = step.availability.scriptPath;
    if (scriptPath === undefined || CONFIG_FILE.test(scriptPath)) {
      delegates.push({ id: step.id, scriptPath: scriptPath ?? "(no script)" });
      continue;
    }
    const abs = resolve(root, scriptPath);
    if (!existsSync(abs)) {
      // A registered gate whose script is missing cannot persist, and saying "delegate" would hide it.
      silent.push({ id: step.id, scriptPath: `${scriptPath} (missing)` });
      continue;
    }
    const code = readFileSync(abs, "utf8");
    if (persistsInSource(code)) {
      persists.push({ id: step.id, via: "self" });
      continue;
    }
    let via = "";
    for (const dep of localImportsOf(abs, blankComments(code))) {
      if (persistsInSource(readFileSync(dep, "utf8"))) {
        via = `one-hop:${dep.startsWith(root) ? dep.slice(root.length + 1) : dep}`;
        break;
      }
    }
    if (via) persists.push({ id: step.id, via });
    else silent.push({ id: step.id, scriptPath });
  }

  return { persists, silent, delegates, stepsExamined: steps.length };
}
