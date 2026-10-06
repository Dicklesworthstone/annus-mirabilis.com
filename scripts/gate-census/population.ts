/**
 * THE PRINTED POPULATION: one line format, one printer, one parser (am-rc1001-bridge-plan-pcjk.9).
 *
 * AGENTS.md states the proposition four times - "A Tool's Exit Code Is Not Evidence Until You Know
 * What It Examined", "A Gate's Own Test Must Not Live Only In The Lane That Gate Controls", "A Check
 * Inherits The Silence Of Whatever It Reads", "A gate that forbids a construct must read code, not
 * text" - and until now it was enforced nowhere, so every new gate was a fresh chance to forget it.
 * Fourteen gates were measured examining an empty population, a fixture, or the wrong population on
 * 2026-10-01, up from six on 2026-09-27. Repairing them one at a time has not converged because the
 * defect is in how gates are made.
 *
 * SO A GATE SAYS WHAT IT LOOKED AT, in a line a reader and a machine can both use:
 *
 *   [census] verify-content examined 323 content records (minimum 100)
 *   [census] ocr-guard examined 4017 files (minimum 1000)
 *   [census] facsimile-config examined 0 facsimile configs (minimum 1) VACUOUS
 *
 * THE PARSER IS NOT THE PRINTER'S MIRROR, deliberately. A parser proven only against the output of
 * the printer beside it is a closed loop: both can be wrong about the format and they will always
 * agree. `population.test.ts` therefore drives the parser with hand-written specimens, including the
 * malformed ones, and separately checks that the printer's output round-trips.
 *
 * AND A LINE THAT LOOKS LIKE A CENSUS LINE BUT DOES NOT PARSE IS REPORTED, never dropped. A parser
 * that silently skipped `[census] foo examined many files` would make a gate that printed nonsense
 * indistinguishable from a gate that printed nothing, which is the same silence this module exists to
 * break.
 */

/** One population a gate examined, as the gate printed it. */
export type PopulationReport = Readonly<{
  /** The registry step id, so the census can attribute the line without guessing. */
  gate: string;
  /** How many of the thing it looked at. */
  examined: number;
  /** The thing, as a plural noun phrase: "content records", "facsimile configs", "tracked files". */
  noun: string;
  /** The smallest count that is not vacuous, as the gate itself declares it. */
  minimum: number;
}>;

/** A line that announced itself as a census line and could not be read. */
export type MalformedPopulationLine = Readonly<{ line: string; reason: string }>;

export type ParsedPopulations = Readonly<{
  reports: readonly PopulationReport[];
  malformed: readonly MalformedPopulationLine[];
}>;

export const POPULATION_PREFIX = "[census]";

/**
 * The one grammar. Anchored at the start of the line so a sentence in a gate's prose that happens to
 * contain the words cannot be read as a declaration, which is the mistake "a gate that forbids a
 * construct must read code, not text" is about.
 */
const LINE = /^\[census\] (\S+) examined (\d+) (.+?) \(minimum (\d+)\)(?: VACUOUS)?$/;

/** True when a gate examined fewer than it declared it must. */
export function isVacuous(report: PopulationReport): boolean {
  return report.examined < report.minimum;
}

export function populationLine(report: PopulationReport): string {
  const tail = isVacuous(report) ? " VACUOUS" : "";
  return `${POPULATION_PREFIX} ${report.gate} examined ${report.examined} ${report.noun} (minimum ${report.minimum})${tail}`;
}

/**
 * Print the line and say whether the run was vacuous. The caller decides the exit code: this module
 * never calls `process.exit`, so a gate's own failure reporting stays in the gate.
 */
export function reportPopulation(report: PopulationReport): boolean {
  console.log(populationLine(report));
  return isVacuous(report);
}

/**
 * Read every census line out of a gate's combined output. Lines that are not census lines are
 * ignored; lines that start with the prefix and do not parse are returned as malformed.
 */
export function parsePopulationLines(text: string): ParsedPopulations {
  const reports: PopulationReport[] = [];
  const malformed: MalformedPopulationLine[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line.startsWith(POPULATION_PREFIX)) continue;
    const match = LINE.exec(line);
    if (!match) {
      malformed.push({
        line,
        reason: "does not match [census] <gate> examined <n> <noun> (minimum <m>)",
      });
      continue;
    }
    const gate = match[1];
    const examined = Number(match[2]);
    const noun = match[3];
    const minimum = Number(match[4]);
    if (
      gate === undefined ||
      noun === undefined ||
      !Number.isInteger(examined) ||
      !Number.isInteger(minimum)
    ) {
      malformed.push({ line, reason: "a captured field was absent or not an integer" });
      continue;
    }
    if (minimum < 1) {
      // A minimum of zero is a declaration that nothing counts as vacuous, which is the hole this
      // whole mechanism closes. It is reported rather than accepted.
      malformed.push({ line, reason: "a minimum below 1 cannot detect a vacuous run" });
      continue;
    }
    reports.push({ gate, examined, noun, minimum });
  }
  return { reports, malformed };
}
