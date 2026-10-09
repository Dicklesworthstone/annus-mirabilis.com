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
  /**
   * FOR A GATE THAT RUNS A THIRD-PARTY TOOL, whose output this repository does not author.
   *
   * `lint` is biome, `unit-tests` is bun's runner. Neither can be made to print the census line, and
   * wrapping them would mean changing the registry's command for steps every pane runs - a shared risk
   * for a reporting improvement. They do, however, each print their own population: "Checked 7 files in
   * 6ms", "Ran 19 tests across 1 file". So the census extracts the count from the tool's own wording
   * instead, which keeps it a READER rather than a trusting consumer.
   *
   * That wording is the exact subject of the AGENTS.md incident this census exists for: biome printed
   * "Checked 0 files in 1629µs" because zsh did not word-split an unquoted variable, the chain continued,
   * and "biome clean on all four" went into a commit message. A census that reads this number would have
   * refused that run.
   *
   * `pattern` is a regular expression source with ONE capture group holding the count, stored as a
   * string so a record stays data. A pattern that does not match is a finding, never a zero.
   */
  toolPopulation?: Readonly<{ pattern: string; noun: string; minimum: number; why: string }>;
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
  /*
    THE APPLE STEPS THAT RUN ON THIS MACHINE AND WERE VERIFIED HERE (am-rc1001-bridge-plan-pcjk.9,
    with am-app-apple-quality-gate-q6gs owning the gate itself).

    Each step DECLARES its population through the verdict's `population` field and
    scripts/app/apple-quality.ts's `main` prints the line once, so the grammar is applied in one
    place and a step cannot half-adopt it. Measured 2026-10-08 by running each step:

      apple-plist-lint       3 property lists
      apple-generated-fresh  4 generated rasters
      apple-swiftlint        54 Swift files
      apple-swift-format     54 Swift files
      apple-toolchain        4 tools, reported as versions rather than a count
      apple-disk             28.7 GB free against a 10 GB floor

    THREE OF THE NINE WERE OBSERVED ON 2026-10-09 AND ARE NOW RECORDED BELOW. The note that
    follows stood when it was written and was right to refuse the other six.

      apple-simulators      3 named simulators, now a printed population
      apple-edition-fresh   1073 exported edition files, now a printed population
      apple-project-fresh   a regenerate-and-diff condition, recorded as such

    The remaining SIX need a working Xcode build, and the reason they did not have one is now known
    rather than guessed: generated/app-edition/edition-source.txt pinned the edition to
    `/private/tmp/.../<another session id>/scratchpad/web-build-live-1200/out`, a path under another
    agent session's scratchpad, and a scratchpad dies with its session. So the build phase failed at
    `cd "${OUT}"` under `set -e`, which Xcode reports as exit 65 with no `error:` line, and
    apple-build, apple-unit-tests, apple-ui-tests, apple-harness-evidence and apple-release-absence
    all failed on it. 8c07d192 made that case say what to run; it did not make a build exist, which
    needs a fresh web build and a re-export, so those six stay listed against their owner.

    The original note, which still governs the six:

    The nine not recorded here need a simulator, a device, an Xcode build, or an exported edition
    from a build that no longer exists on this machine (apple-edition-parity exits 1 today naming a
    scratchpad path from another session). Declaring a population I could not observe would be
    exactly the citation this census exists to refuse, so they stay listed against their owner.
  */
  {
    gate: "apple-simulators",
    noun: "named simulators",
    howRead:
      "ensureSimulators(REPO) returns one entry per simulator the apple-toolchain decision names, " +
      "creating any that are missing, and the count is that list's length. Observed 2026-10-09 by " +
      "running the step: 'examined 3 named simulators (minimum 1)'.",
    gateRefusesVacuous: true,
    plants: [],
  },
  {
    gate: "apple-edition-fresh",
    noun: "exported edition files",
    howRead:
      "The step walks generated/app-edition/edition-manifest.json file by file, hashing each one " +
      "under the exported build's directory, and the count is manifest.files.length. Observed " +
      "2026-10-09: 'examined 1073 exported edition files (minimum 1)'. The floor is 1 rather than " +
      "the measured 1073 because the edition's size is a product of the web build and moves with it.",
    gateRefusesVacuous: true,
    plants: [],
  },
  {
    gate: "apple-project-fresh",
    noun: "regenerated project files compared with the committed project",
    howRead:
      "xcodegen regenerates ios/AnnusMirabilis.xcodeproj from ios/project.yml and the step reads " +
      "`git status --porcelain` on it. Observed 2026-10-09: exit 0, 'Regenerating ios/project.yml " +
      "changes nothing in the committed project', and the working tree stayed clean.",
    gateRefusesVacuous: true,
    populationMayBeEmpty: {
      reason:
        "A regenerate-and-diff step examines no corpus: it compares two STATES of one directory, " +
        "and an empty diff is its success condition rather than its blind spot. A minimum of 1 " +
        "changed file would invert the gate, and a minimum of 0 cannot detect anything. The " +
        "failure this census guards against cannot arise here, because the comparison is against " +
        "a file xcodegen has just written: if xcodegen does not run, the step fails on its exit " +
        "code before any diff is read.",
    },
    plants: [],
  },
  {
    gate: "apple-plist-lint",
    noun: "property lists linted",
    howRead:
      "The length of the step's own file list -- Info.plist, PrivacyInfo.xcprivacy and the " +
      "entitlements -- which is what plutil was handed.",
    gateRefusesVacuous: false,
    plants: [
      {
        id: "apple-plist-lint-declares-more-than-it-lints",
        file: "scripts/app/apple-quality.ts",
        find: '        noun: "property lists linted",\n        minimum: 3,',
        replace: '        noun: "property lists linted",\n        minimum: 4,',
        expectFailureNaming: "VACUOUS",
        why:
          "The three files are named in the step, so the only way the count can fall is a list " +
          "that lost one -- which is what raising the declared minimum simulates. A quieter " +
          "'2 of 2 OK' would otherwise read as a pass.",
      },
    ],
  },
  {
    gate: "apple-generated-fresh",
    noun: "generated rasters compared",
    howRead: "The length of the step's own list of four named rasters, light and dark for each.",
    gateRefusesVacuous: false,
    plants: [],
  },
  {
    gate: "apple-swiftlint",
    noun: "Swift files linted",
    howRead:
      "Parsed by the step from SwiftLint's own 'in N files.' line, which it already refuses at " +
      "zero ('An empty run is not a pass'). The census floor adds the case where it reads some " +
      "files but not the tree.",
    gateRefusesVacuous: true,
    plants: [],
  },
  {
    gate: "apple-swift-format",
    noun: "Swift files formatted-checked",
    howRead:
      "Counted by the step by walking the four Swift source roots, and it refuses zero for the " +
      "same reason SwiftLint does.",
    gateRefusesVacuous: true,
    plants: [],
  },
  {
    gate: "apple-toolchain",
    noun: "installed tools checked",
    howRead:
      "The step reports the four tools by VERSION rather than by count -- 'Xcode 26.1.1 (17B100), " +
      "XcodeGen 2.46.0, SwiftLint 0.63.2, swift-format 6.2.1' -- which is the more useful line for " +
      "a reader and is why it declares no population.",
    gateRefusesVacuous: true,
    populationMayBeEmpty: {
      reason:
        "This step reads a CONDITION, not a corpus: whether the installed tools match the " +
        "apple-toolchain decision in docs/DECISIONS.md. There is no population to be vacuous over, " +
        "and a line declaring 'examined 4 tools (minimum 4)' would carry a minimum that cannot " +
        "detect anything the version comparison does not already refuse. It fails closed on a " +
        "missing tool and on an unreadable decision block.",
    },
    plants: [],
  },
  {
    gate: "apple-disk",
    noun: "free disk measured against the toolchain decision's floor",
    howRead:
      "One scalar from statfs, compared with the floor the apple-toolchain decision names. " +
      "Measured 2026-10-08: 28.7 GB free, floor 10 GB.",
    gateRefusesVacuous: true,
    populationMayBeEmpty: {
      reason:
        "There is no corpus here at all. This step reads a single quantity -- free disk -- and " +
        "compares it with a declared floor, so the honest population is one and a minimum of one " +
        "cannot detect anything. The failure this census guards against, a clean verdict over a " +
        "population that was never read, cannot arise: a statfs that fails cannot produce a " +
        "number, and the step fails closed when the decision block is unreadable.",
    },
    plants: [],
  },
  {
    gate: "typecheck",
    noun: "files typechecked by tsc",
    howRead:
      "Parsed from tsc's own `--diagnostics` summary, because this gate runs a third-party " +
      "compiler. See toolPopulation below.",
    gateRefusesVacuous: false,
    plants: [],
    toolPopulation: {
      /*
        ANCHORED ON THE PAIR tsc PRINTS, not on the word. `Files:\s+(\d+)` alone matches
        "Total Files: 12" in any prose the step happens to emit -- verified, it does -- and the
        census matches against the WHOLE output with no multiline flag, so a line-start anchor would
        only ever match the first line. tsc prints `Files:` immediately above `Lines:`, so requiring
        the pair is both specific and cheap. Verified against a real run: captures 4913, and does
        not match "Files: many\nLines: 3".
      */
      pattern: String.raw`Files:\s+(\d+)\s*\n\s*Lines:`,
      noun: "files typechecked by tsc",
      /*
        Measured 2026-10-08: 4,913 files, 1,107,622 lines. The floor is 2,000 -- about 40% -- because
        what has to be caught is a tsconfig `include` that narrowed or an invocation pointed at a
        subdirectory, either of which would let `tsc --noEmit` exit 0 having compiled a fraction of
        the repository. tsc prints NOTHING on success without this flag, which is why this gate had
        no population at all: a green `bun run typecheck` was indistinguishable from a green run over
        one file. AGENTS.md records the neighbouring version of this trap -- `bun run typecheck` is
        46 generators before the compiler, and its exit code cannot say which of the two failed.
      */
      minimum: 2000,
      why:
        "tsc's output is not ours to shape, and it prints no count at all by default. `--diagnostics` " +
        "adds the summary without changing the exit code or what is compiled, which makes the " +
        "population readable without wrapping the compiler.",
    },
  },
  {
    gate: "build",
    noun: "HTML pages emitted",
    howRead:
      "Counted from out/ by scripts/build/reportBuildPopulation.ts, which `bun run build` now runs " +
      "after `next build`. Files ending .html, not directories: next emits a DIRECTORY named " +
      "out/_next/static/chunks/app/offline/[paper]/[file]/index.html, so `find -name '*.html'` " +
      "reports 721 where the real page count is 720.",
    // The reporter prints and never exits non-zero, deliberately: it runs at the end of the chain
    // that vercel.json's buildCommand invokes, so a reporting line able to throw could fail every
    // pane's build and the deploy. The census judges the number instead, as it does for `lint`.
    gateRefusesVacuous: false,
    plants: [
      {
        id: "build-floor-unreachable",
        file: "scripts/build/reportBuildPopulation.ts",
        // NOT `minimum: 250,` -- minimumPlant's anchor does not exist here, because the floor is a
        // named constant the reporter and its test both read. Targeting the declaration is also the
        // more faithful plant: the floor is the thing under review.
        find: "export const BUILD_PAGE_FLOOR = 250;",
        replace: "export const BUILD_PAGE_FLOOR = 99999999;",
        expectFailureNaming: "below the declared floor",
        why:
          "The reporter never exits non-zero, so what this plant has to show is that the census " +
          "LINE goes VACUOUS and the reporter says so in words. Raising the floor out of reach is " +
          "the only edit that does it without deleting pages from a real build.",
      },
    ],
  },
  {
    gate: "browser-acceptance",
    noun: "runtime conformance assertions",
    howRead:
      "Counted INSIDE the assertion loop, so the number is what executed rather than what the " +
      "array declares, against a minimum of the declared length. The gate previously printed " +
      "PASS/FAIL per assertion and a log path with no total, so a run that executed fewer than it " +
      "declares looked identical to a complete one and every surviving assertion still said PASS.",
    gateRefusesVacuous: true,
    plants: [
      {
        id: "browser-acceptance-declares-more-than-it-runs",
        file: "scripts/e2e/runtime-conformance/run.ts",
        find: "    declared = assertions.length;",
        replace: "    declared = assertions.length + 1;",
        expectFailureNaming: "RUNTIME_CONFORMANCE_POPULATION_BELOW_FLOOR",
        why:
          "Simulates the real defect: an assertion that stops being constructed, or a loop that " +
          "breaks early, while the per-assertion PASS lines all still print. Raising the declared " +
          "count by one is the smallest edit that makes what RAN disagree with what is DECLARED, " +
          "which is the only condition this line exists to detect.",
      },
    ],
  },
  {
    gate: "coverage-report",
    noun: "input files",
    howRead:
      "report.inputs, which records only files that were OPENED, each with its sha256 -- so the " +
      "count is the population and not a restatement of the verdict. Printed on BOTH paths, or a " +
      "census could not tell this gate's refusal from a gate that never ran.",
    // coverageWasMeasured plus the exit in main(): a run that opened no file exits 1.
    gateRefusesVacuous: true,
    /*
      NO PLANT, AND THE REASON IS THE FINDING. As registered this gate CANNOT PASS: the registry
      runs `bun scripts/coverage-report.ts` with no arguments, and the inputs it can read are
      `--scenario-evidence <path>` and `--review-records <path>`. Measured 2026-10-08, the bare
      command exits 1 printing "examined 0 input files (minimum 1) VACUOUS" beside its own REFUSED
      line; with a real input it exits 0 at "examined 1 input files (minimum 1)". So the script is
      right and the step's registration is incomplete, which a `nightly` cadence that nothing runs
      had kept invisible -- the same shape am-7bkr found for perf-budgets.

      A plant cannot discriminate on a gate that is already red, so declaring one would be a plant
      that passes for the wrong reason. This record instead puts the gate in the census's judged set
      so it is listed RED against am-cm-coverage-ledger-0ip, which is what criterion 3 asks for:
      "either fixed by its own bead with a passing plant, or listed as red in the census with its
      bead id. None is silently green." Giving the step arbitrary paths to make it green would be
      making a gate pass rather than wiring it, so the loaders stay with their owner.
    */
    plants: [],
  },
  {
    gate: "perf-budget-change",
    noun: "budget rows",
    howRead:
      "The union of the base and current budget ids, from the check's own comparedRows. A row " +
      "present in either is one the check reasoned about, so a removal still counts as examined.",
    gateRefusesVacuous: true,
    plants: [
      minimumPlant(
        "perf-budget-change",
        "scripts/perf-budget-diff.ts",
        1,
        "BUDGET_POPULATION_BELOW_FLOOR",
      ),
    ],
  },
  {
    gate: "facsimile-digests",
    noun: "pinned digests",
    howRead:
      "The number of pins the verify run examined, printed before the per-pin lines and on every " +
      "path. The sibling `facsimile-config` gate in the same script already did this, after a " +
      "vacuous run there had become indistinguishable from a real one by reading the output; the " +
      "verify path was not covered.",
    gateRefusesVacuous: true,
    plants: [
      minimumPlant(
        "facsimile-digests",
        "scripts/download-facsimiles.ts",
        1,
        "PIN_POPULATION_BELOW_FLOOR",
      ),
    ],
  },
  {
    gate: "resource-stress",
    noun: "lifecycle scenarios",
    howRead:
      "The suite's own scenario count, printed before the verdict on every path including --json. " +
      "A census that could only read a passing run could not tell a failing gate from a vacuous one.",
    // The gate exits 1 on a vacuous run rather than only reporting it, so the census is a second
    // reader of a refusal the gate already makes.
    gateRefusesVacuous: true,
    plants: [
      {
        id: "resource-stress-declares-more-than-it-runs",
        file: "scripts/resource-stress.ts",
        // NOT `minimum: 6,` -- the minimum is the identifier DECLARED_SCENARIOS, so the plant has to
        // move the declaration. That is also the more faithful plant: it simulates the real defect,
        // a scenario that stops being constructed while the summary still reads "N / N passed".
        find: "export const DECLARED_SCENARIOS = 6;",
        replace: "export const DECLARED_SCENARIOS = 7;",
        expectFailureNaming: "REFUSED",
        why:
          "A '6 / 6 passed' summary and a '5 / 5 passed' summary read identically, which is the whole " +
          "reason this gate needs a declared population. Raising the declaration by one makes the run " +
          "report 6 against a minimum of 7, which is exactly the shape of a dropped scenario, and the " +
          "gate must refuse rather than print PASSED.",
      },
    ],
  },
  {
    gate: "perf-budgets",
    noun: "build-dependent budget rows",
    howRead:
      "Counted as BUILD_DEPENDENT_ROWS less the rows that reached no verdict, which is the same " +
      "predicate the gate's own refusal uses (`unmeasuredBuildRows`), so the census line and the " +
      "gate's verdict cannot disagree. The other six rows are not-available by construction in this " +
      "harness and are deliberately NOT the population: counting them would let the line read 8 of 8 " +
      "on a run that measured nothing about the build.",
    gateRefusesVacuous: true,
    plants: [
      {
        id: "perf-budgets-declares-an-unmeasurable-row",
        file: "scripts/run-perf-budgets.ts",
        // The minimum is BUILD_DEPENDENT_ROWS.length, so the plant adds a row that cannot be
        // measured. This is the defect am-7bkr found: a browser-driven row added to the list while
        // the harness can only read build output, after which the run reports a budget result over
        // whatever survived.
        find: 'export const BUILD_DEPENDENT_ROWS = ["initial-route-js", "reading-face-html"] as const;',
        replace:
          'export const BUILD_DEPENDENT_ROWS = ["initial-route-js", "reading-face-html", "layout-shift"] as const;',
        expectFailureNaming: "REFUSED",
        why:
          "The floor and the count come from one list, so the only way to make them disagree is to " +
          "declare a row the harness cannot reach -- which is the real failure this gate was repaired " +
          "for. `layout-shift` is one of the six that are not-available by construction, so the " +
          "planted run measures 2 against a minimum of 3 and must refuse.",
      },
    ],
  },
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
    gate: "lint",
    noun: "files checked by biome",
    howRead:
      "Parsed from biome's own summary line, because this gate runs a third-party tool. See " +
      "toolPopulation below.",
    gateRefusesVacuous: false,
    plants: [],
    toolPopulation: {
      pattern: String.raw`Checked (\d+) files? in`,
      noun: "files checked by biome",
      // Measured 2026-10-06 over the repository: biome checks several thousand files. The floor is 500,
      // which no partial invocation reaches and every real repo-wide run clears.
      minimum: 500,
      why:
        "biome's output is not ours to change, and wrapping it would mean changing the registry command " +
        "for a step every pane runs. Its 'Checked N files' line is the number AGENTS.md's first recorded " +
        "instance turned on: 'Checked 0 files in 1629µs', from an unquoted variable zsh did not " +
        "word-split, after which 'biome clean on all four' went into a commit message.",
    },
  },
  {
    gate: "format-check",
    noun: "files checked by biome",
    howRead: "Parsed from biome's own summary line, as for `lint`.",
    gateRefusesVacuous: false,
    plants: [],
    toolPopulation: {
      pattern: String.raw`Checked (\d+) files? in`,
      noun: "files checked by biome",
      minimum: 500,
      why: "Same tool and same line as `lint`; a format run that checked nothing is equally silent.",
    },
  },
  {
    gate: "unit-tests",
    noun: "tests run by bun",
    howRead: "Parsed from bun's own summary line, because this gate runs a third-party runner.",
    gateRefusesVacuous: false,
    plants: [],
    toolPopulation: {
      pattern: String.raw`Ran (\d+) tests? across`,
      noun: "tests run by bun",
      // Measured over the lane: more than fifteen thousand tests. The floor is 5000, far below any real
      // run and far above the shapes that go vacuous - an empty file list, or a filter matching nothing.
      minimum: 5000,
      why:
        "AGENTS.md records the same mechanism costing a second agent fifteen planted negatives: " +
        "`bun test $SUITES` with the paths in an unquoted variable ran nothing and every plant read as " +
        "passing. 'Ran N tests' is what distinguishes that from a clean lane.",
    },
  },
  {
    gate: "ubs-diff",
    noun: "changed source files scanned by ubs",
    howRead:
      "ubs scans the working-tree diff. Measured 2026-10-06 on a tree whose only change was a .jsonl " +
      "file: 'no recognizable languages in .../git_scan', exit 0, nothing examined.",
    gateRefusesVacuous: false,
    plants: [],
    populationMayBeEmpty: {
      reason:
        "The population IS a diff, so zero is correct whenever no source file changed - which is the " +
        "normal state of a clean release checkout. That makes this step structurally unable to " +
        "contribute to a release profile even though it is required in all three: it will examine " +
        "nothing and pass. Recorded here rather than silently counted as covered; moving it to a " +
        "whole-tree scan, or dropping it from the profiles, is its owner's decision " +
        "(am-scaf-quality-gates-ci-4xx).",
    },
  },
  {
    gate: "ubs-staged",
    noun: "staged source files scanned by ubs",
    howRead: "ubs scans the git index. Zero staged files is the normal state outside a commit.",
    gateRefusesVacuous: false,
    plants: [],
    populationMayBeEmpty: {
      reason:
        "Same shape as ubs-diff and the same consequence: the index is empty except in the moments " +
        "around a commit, so in a release profile this step examines nothing and passes. It is a " +
        "pre-commit aid wired into a release chain, which is a question for its owner " +
        "(am-scaf-quality-gates-ci-4xx) rather than a denominator this census can supply.",
    },
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
    gate: "facsimile-pins",
    noun: "pinned facsimiles",
    howRead:
      "report.checkedCount over the pinned facsimile configs, comparing anchor, content identity and " +
      "folio coverage. Measured 2026-10-06: 6 pins checked, 6 verified, 0 refused. Note this gate's own " +
      "caveat: /sources is git-ignored, so in an environment without the parent scans its refusals are a " +
      "statement about the environment and not about the pins.",
    gateRefusesVacuous: true,
    plants: [minimumPlant("facsimile-pins", "scripts/verify-facsimile-pins.ts", 4, "VACUOUS")],
  },
  {
    gate: "voice-lint",
    noun: "visitor-facing strings",
    howRead:
      "res.totalScanned over every visitor-facing string in the corpus. Measured 2026-10-06: 82166 items, " +
      "8 errors, 68 flags, 1048 info. The gate is RED today on those 8 errors, which are physics " +
      "vocabulary under review (am-x9xf, am-lmgx) and not this census's business; it is requiredInCi " +
      "false and required in no profile.",
    // The gate's exit comes from its error count, so a floor would not change its verdict today.
    gateRefusesVacuous: false,
    plants: [],
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
