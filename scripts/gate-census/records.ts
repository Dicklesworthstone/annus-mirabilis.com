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
  /**
   * SET ONLY WHEN AN EMPTY POPULATION IS THE CORRECT ANSWER, with the reason.
   *
   * Most gates examine a corpus, and zero is a broken run. A few examine a CONDITION: `stashes` looks
   * for stashes nobody has reviewed, and a repository with none is in the state the gate wants. Such a
   * gate cannot declare a minimum of 1 without going red on a clean repository, and the census refuses
   * a minimum of 0 because a minimum of 0 cannot detect anything.
   *
   * So the third state is declared here rather than left as an absent record. A record carrying this
   * does not have to print a census line, and the census lists it in its own category instead of
   * counting it as a gap. The reason is required, and it is the only thing standing between this field
   * and an escape hatch: it has to say why zero is the gate's success condition rather than its blind
   * spot.
   */
  populationMayBeEmpty?: Readonly<{ reason: string }>;
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
    gate: "verify-content",
    noun: "content records compiled",
    howRead:
      "options.loadFiles() handed to compileContent; the count is files.length. This gate prints more " +
      "denominators than any other - result.populations is one line per audit saying how much of its " +
      "subject it judged - and had no single number a reader across gates could compare. Measured " +
      "2026-10-06: 334 records, 648 flags, 0 errors. It also calls the architecture gate, so its output " +
      "carries TWO census lines; the census attributes by gate id and reads only its own.",
    gateRefusesVacuous: true,
    plants: [minimumPlant("verify-content", "scripts/verify-content.ts", 200, "VACUOUS")],
  },
  {
    gate: "verify-wasm-artifacts",
    noun: "wasm verification checks",
    howRead:
      "result.checks.length. The population is the CHECKS the script assembled rather than the artifacts: " +
      "a run that registered two of them would print 'All WASM artifact verification checks PASSED' " +
      "having verified almost nothing, and the sentence would be identical. Measured 12.",
    gateRefusesVacuous: true,
    plants: [
      minimumPlant("verify-wasm-artifacts", "scripts/verify-wasm-artifacts.ts", 8, "VACUOUS"),
    ],
  },
  {
    gate: "audit-derivation-tools",
    noun: "derivation steps",
    howRead:
      "report.totalSteps over the shipped derivation chains. THE DENOMINATOR IS TINY AND THAT IS A FACT " +
      "ABOUT THE CORPUS: measured 2026-10-06, ONE chain ships (chain-bm-variance-of-sum) with 4 steps, " +
      "because the 200 printed displays have no semantic tree yet (am-rc1001-bridge-plan-pcjk.28). The " +
      "floor of 4 is therefore the whole corpus, and it is recorded so the next reader does not read " +
      "'0 errors' as broad coverage. Raise it when chains land.",
    gateRefusesVacuous: true,
    plants: [
      minimumPlant("audit-derivation-tools", "scripts/audit-derivation-tools.ts", 4, "VACUOUS"),
    ],
  },
  {
    gate: "stashes",
    noun: "git stashes",
    howRead:
      "`git stash list` in the repository, compared with src/testing/stashes/acknowledgedStashes.json. " +
      "Measured 2026-10-06: 8 present, 8 reviewed under a bead.",
    gateRefusesVacuous: false,
    plants: [],
    populationMayBeEmpty: {
      reason:
        "The gate looks for stashes NOBODY HAS REVIEWED, and a repository with no stash at all is " +
        "exactly the state it wants. A floor of 1 would go red on a clean repository, and a floor of 0 " +
        "cannot detect anything, so neither is a declaration. What could go wrong here is the inverse " +
        "of vacuity - a stash the gate failed to see - and that is a question about `git stash list`, " +
        "not about a denominator this census can read.",
    },
  },
  {
    gate: "facsimile-config",
    noun: "facsimile source configurations",
    howRead:
      "checkAllConfigs over the facsimile config directory; the count is Object.keys(results).length. " +
      "The gate already refuses 0 with EMPTY_CONFIG_POPULATION (am-cglg); the floor of 4 adds the case " +
      "that bead could not reach, a run reading the WRONG directory and finding some but not all.",
    gateRefusesVacuous: true,
    plants: [minimumPlant("facsimile-config", "scripts/download-facsimiles.ts", 4, "VACUOUS")],
  },
  {
    gate: "facsimile-page-anchors",
    noun: "facsimile page maps",
    howRead:
      "report.checkedCount over the provenance receipts' page maps. The line is printed by runCli, " +
      "which owns the exit code, not by the formatter, which returns a string.",
    gateRefusesVacuous: true,
    plants: [
      minimumPlant("facsimile-page-anchors", "scripts/verify-facsimile-anchors.ts", 4, "VACUOUS"),
    ],
  },
  {
    gate: "receipts",
    noun: "provenance receipt files",
    howRead:
      "filesChecked over docs/provenance. Measured 10 files, 0 errors, 43 flags; the floor of 6 is one " +
      "per pinned facsimile, so a run that read none of them cannot pass.",
    gateRefusesVacuous: true,
    plants: [minimumPlant("receipts", "scripts/check-receipts.ts", 6, "VACUOUS")],
  },
  {
    gate: "scenarios",
    noun: "scenario rows",
    howRead:
      "passed + failed + notAvailable from the scenario registry. The not-available rows are counted on " +
      "purpose: a registry that loaded six rows would report '0 failed' and read as a clean suite.",
    gateRefusesVacuous: true,
    plants: [minimumPlant("scenarios", "scripts/run-scenarios.ts", 80, "VACUOUS")],
  },
  {
    gate: "typecheck-lane",
    noun: "named lane checks",
    howRead:
      "checks.length, the two named checks this lane runs. The population matters here more than most: " +
      "this lane exists because `bun run typecheck` runs 34 generators before tsc and its exit code " +
      "cannot say which half broke, so a lane silently running one of its two checks is the same failure " +
      "one level up.",
    gateRefusesVacuous: true,
    plants: [minimumPlant("typecheck-lane", "scripts/typecheck-lane.ts", 2, "VACUOUS")],
  },
  {
    gate: "publication-contract",
    noun: "publication contract steps",
    howRead:
      "results.length, the contract steps executed. A run that executed one would print 'Failed: 0' and " +
      "read as a passing contract.",
    // The line is printed and the count is reported, but the gate's exit comes from its step results.
    // Raising its own floor out of reach therefore proves the line, not a refusal, so no plant is
    // registered rather than one that would be judged by the wrong predicate.
    gateRefusesVacuous: false,
    plants: [],
  },
  {
    gate: "license-inventory",
    noun: "license inventory items",
    howRead:
      "result.inventory.items.length. A run that built an inventory of three would report 'no policy " +
      "violations' and read as a clean inventory. 82 items measured, 75 against a settled rights " +
      "position and 7 exempt pending am-gov-decision-license-rights-tps.",
    gateRefusesVacuous: true,
    plants: [
      minimumPlant("license-inventory", "scripts/verify-license-inventory.ts", 40, "VACUOUS"),
    ],
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
