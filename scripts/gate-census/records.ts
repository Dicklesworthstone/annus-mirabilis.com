/**
 * THE CENSUS RECORDS (am-rc1001-bridge-plan-pcjk.9).
 *
 * One per registry step that has adopted the printed-population line. A step with no record here is a
 * gap the census reports with its owning bead; it is never silently green.
 *
 * WHAT A RECORD DOES NOT HOLD: the count, and the minimum. Both come from the line the gate printed in
 * THIS run. A record restating either would be a second source of truth that drifts, and worse, a
 * census comparing a gate's output against a number copied from the gate would inherit the gate's own
 * silence - which is the defect this whole mechanism exists to break. The record declares only what the
 * printed line cannot: the noun the gate is SUPPOSED to examine, how it obtains it, and what plant
 * proves it bites.
 *
 * So a gate that quietly changes which population it reads is caught by the noun comparison, and a
 * gate whose population collapses is caught by its own printed minimum.
 */

export type GatePlant = Readonly<{
  /** A short id for the plant, used in the census's output and its log. */
  id: string;
  /** The file the plant edits, relative to the repository root. */
  file: string;
  /** An exact string that must be present, so a moved anchor is a visible failure, not a silent no-op. */
  find: string;
  /** What it becomes. */
  replace: string;
  /** Text the gate's failing output must contain. A red for any other reason does not count. */
  expectFailureNaming: string;
  /** Why this plant is the right one for this gate. */
  why: string;
}>;

export type CensusRecord = Readonly<{
  /** The registry step id. */
  gate: string;
  /** The noun the gate prints, exactly. Compared with the printed line. */
  noun: string;
  /** How the gate obtains that population, for a reviewer who has to judge the minimum. */
  howRead: string;
  /** Whether the gate itself exits non-zero on a vacuous population, or only the census notices. */
  gateRefusesVacuous: boolean;
  plants: readonly GatePlant[];
}>;

/** The plant every adopting gate shares: raise its own declared floor out of reach. */
const minimumPlant = (
  gate: string,
  file: string,
  currentMinimum: number,
  expectFailureNaming: string,
): GatePlant => ({
  id: `${gate}-minimum-unreachable`,
  file,
  find: `minimum: ${currentMinimum},`,
  replace: "minimum: 99999999,",
  expectFailureNaming,
  why:
    "The cheapest plant that exercises the whole path: the gate's real population is read, compared " +
    "with a floor it cannot clear, and the refusal has to name what the clean result would have been " +
    "a statement about. It cannot pass by accident, because the count is the real one.",
});

export const CENSUS_RECORDS: readonly CensusRecord[] = [
  {
    gate: "ocr-guard",
    noun: "tracked source files",
    howRead:
      "scanRepositoryForForbiddenOcr() walks the tracked tree and returns scannedFileCount. The gate " +
      "already refused a count of exactly 0 before this; the floor states the same idea at 1000.",
    gateRefusesVacuous: true,
    plants: [minimumPlant("ocr-guard", "scripts/ocr-guard.ts", 1000, "REFUSED")],
  },
  {
    gate: "architecture",
    noun: "repository entries",
    howRead:
      "collectRepoEntries(rootDir, isIgnored) over the whole repository minus gitignored paths; the " +
      "count is entries.length, the same number the pass line has always printed.",
    gateRefusesVacuous: true,
    plants: [
      minimumPlant("architecture", "scripts/app-router-architecture.ts", 10000, "Gate Refused"),
    ],
  },
  {
    gate: "renamed-refusal-codes",
    noun: "tracked sources",
    howRead:
      "readTrackedSources(root) via git ls-files, filtered to .ts/.tsx/.mts/.mjs/.json. The FILES are " +
      "the denominator rather than the codes: a run that read ten sources would report few codes and " +
      "no survivors and would read exactly like a clean tree.",
    gateRefusesVacuous: true,
    plants: [
      minimumPlant(
        "renamed-refusal-codes",
        "scripts/check-renamed-refusal-codes.ts",
        1000,
        "VACUOUS",
      ),
    ],
  },
  {
    gate: "audit-dimensions",
    noun: "equation records with trees",
    howRead:
      "loadRepositoryCorpus() over content/equations. The gate already refuses an empty corpus: its " +
      "own comment records a day when it printed '0 total' and exited 0 while 18 records sat on disk.",
    gateRefusesVacuous: true,
    plants: [minimumPlant("audit-dimensions", "scripts/audit-dimensions.ts", 100, "VACUOUS")],
  },
  {
    gate: "audit-reachability",
    noun: "argument nodes",
    howRead: "report.totalNodes from the reachability audit over content/arguments.",
    // Recorded as false rather than fixed: the CLI exits 0 unconditionally under the comment "Always
    // exit 0 as specified in acceptance criteria", so this step cannot fail however many findings it
    // reports. Changing that belongs to am-edit-comprehension-protocol-ouih.
    gateRefusesVacuous: false,
    plants: [],
  },
  {
    gate: "equation-explanations",
    noun: "printed displays across 4 paper(s)",
    howRead:
      "checkPaperExplanations(cwd, paper) per paper, summing census.displays. The floor is summed over " +
      "the papers actually requested, because mass-energy prints 7 displays and relativity 98, so a " +
      "fraction of one total marks a correct single-paper run vacuous.",
    gateRefusesVacuous: true,
    plants: [],
  },
  {
    gate: "verify-constant-sets",
    noun: "constant set records",
    howRead:
      "loadedSets from content/quantities/constant-sets/. The floor is 2 because the gate's purpose is " +
      "comparing a historical set with a modern one, so one set cannot support a verdict.",
    gateRefusesVacuous: true,
    plants: [minimumPlant("verify-constant-sets", "scripts/verify-constant-sets.ts", 2, "REFUSED")],
  },
];

export function recordFor(gate: string): CensusRecord | undefined {
  return CENSUS_RECORDS.find((r) => r.gate === gate);
}
