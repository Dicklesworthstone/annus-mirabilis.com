/**
 * DO THE INSTRUMENTS' ACCEPTANCE CASES RESOLVE TO ANYTHING? (am-nxbq, dispatch 304.)
 *
 * Every manifest in content/experiments/ lists `acceptanceCases`, and AGENTS.md requires them to
 * include "refusals and non-numeric results". Measured on 2026-09-27 with this module's own
 * resolver: **119 refs, 118 distinct, 11 resolved, 107 dangling; 11 refs name a refusal by spelling
 * and none of them resolves; 0 of 33 instruments have a resolvable refusal case.** A dangling ref
 * and a real one were indistinguishable to every gate that ran, which is what this exists to end.
 *
 * WHAT COUNTS AS RESOLVED, and there are exactly two things:
 *
 * - A SCENARIO the repository's own loader finds (scenario-registry/load.ts, the same loader the
 *   scenario tests run), so this gate and those tests cannot disagree about what exists.
 * - AN IN-CODE FIXTURE the author DECLARES, in content/experiments/acceptance-fixtures.yaml, by
 *   naming the file that holds it. The declaration is then checked: the file must exist and must
 *   contain the id as a literal. A ref is never resolved by searching the tree for its name, which
 *   would make any string that happens to appear in a comment count as a case.
 *
 * WHAT IT REFUSES TO CALL A REFUSAL. A case counts as a refusal case when the scenario it resolves
 * to EXPECTS one: `expected.status` naming a code in the refusal registry. A case counts as a
 * non-numeric case when `expected.status` names one of the typed non-numeric result statuses.
 * Neither is decided by the ref's spelling. The bead counted 11 refs "naming a refusal" by their
 * ids, which is the right way to size a debt and the wrong way to certify a case: a ref called
 * `...-refused` that resolved to a scenario expecting a number would be worse than a dangling one.
 *
 * WHAT IT REFUSES TO CALL AN ACCEPTANCE CASE AT ALL, AND WHY THE DEBT IS NOT ONE DEBT. Measured on
 * 2026-10-05 over the same 33 manifests, which declare 135 presets between them: of 106 dangling
 * refs, **67 are a preset of the SAME instrument** that names them, 0 are a preset of another, and
 * 39 are neither. Sixteen instruments' entire dangling list is their own preset list copied into the
 * field: bm-03 6 of 6, bm-08 9 of 9, sr-13 7 of 7, sr-11 6 of 6, sr-05 5 of 5, sr-12 5 of 5, and so
 * on. A preset is `{ label, parameters }` and carries NO expectation (see
 * `src/experiments/bm03/definition.ts`, `"bm-03-ratio-one"`), so a ref naming one asserts nothing
 * about a result, and writing a scenario file named after it would not be the repair either: the
 * repair is a scenario that STATES what the preset's parameters should produce.
 *
 * That distinction is the reason this is reported separately rather than counted as 106 missing
 * files. The three populations need three different repairs, and the undifferentiated count told an
 * author to write 106 scenarios when 67 of them are a manifest that cites initial conditions where
 * an expectation was required. A dangling ref that is its lab's own preset is still dangling - it
 * resolves to nothing - and it is named by its own code so the diagnosis is accurate.
 *
 * A near miss worth recording, because it is the same error this file exists to refuse: the first
 * measurement of that split read 106 of 106 refs as "present somewhere in the tree", because
 * `src/testing/acceptanceCasesBaseline.json` lists every one of them and lives under `src/`. The
 * instrument was inside its own population. Excluding the baseline, 71 appear in code and 35 nowhere.
 * Of the 71, the ones in a test file are mostly named by a test asserting that the id parses as a
 * preset id, which is a naming check and not evidence of a result, so declaring those files as
 * in-code fixtures would have been proof-class inflation dressed as paying down debt.
 *
 * THE BASELINE RECORDS THE DEBT, and shrinking it is the only allowed direction. A new dangling ref
 * fails. A baselined ref that now resolves fails too, because the baseline must be kept honest; the
 * message says to remove the line. `--strict` refuses any dangling ref at all, which is how this
 * gate will read once the debt is paid.
 *
 * A RESOLVED COUNT OF ZERO FAILS, whatever the baseline says. A run that examined every ref and
 * resolved none is indistinguishable from a run that examined nothing, and both would otherwise
 * report a clean sweep.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { strictParse } from "../content/schemas/strictParse.ts";
import { refusalCodeRegistry } from "../experiments/results/refusalCodes.ts";
import { defaultScenarioDirs, loadScenarios } from "./scenario-registry/load.ts";

export const FIXTURE_DECLARATIONS = join("content", "experiments", "acceptance-fixtures.yaml");
export const ACCEPTANCE_BASELINE = join("src", "testing", "acceptanceCasesBaseline.json");

/** The typed result statuses that are not a number (src/experiments/results/types.ts). */
export const NON_NUMERIC_STATUSES: ReadonlySet<string> = new Set([
  "symbolic",
  "analytic-limit",
  "underdetermined",
  "not-applicable",
  "outside-domain",
  "divergent",
]);

export type AcceptanceRef = Readonly<{
  /** The instrument whose manifest names it. */
  lab: string;
  ref: string;
  /** How it resolved, or that it did not. */
  resolution: "scenario" | "fixture" | "dangling";
  /** Where the thing it resolved to lives. */
  where?: string | undefined;
  /** What the scenario it resolves to expects, when that is a status rather than numbers. */
  status?: string | undefined;
  kind?: "refusal" | "non-numeric" | undefined;
  /**
   * Set when the ref did not resolve AND is a preset declared by the same manifest. It is not a
   * second kind of resolution: the ref is dangling either way, and this records which repair it
   * needs.
   */
  ownPreset?: true | undefined;
}>;

export type AcceptanceProblem = Readonly<{
  code:
    | "acceptance-ref-dangling"
    | "acceptance-ref-is-a-preset"
    | "acceptance-baseline-slack"
    | "acceptance-fixture-undeclared"
    | "acceptance-fixture-missing-file"
    | "acceptance-fixture-absent-from-file"
    | "acceptance-nothing-resolved"
    | "acceptance-instrument-without-refusal"
    | "acceptance-instrument-without-non-numeric";
  message: string;
}>;

export type AcceptanceCensus = Readonly<{
  /** Instruments whose manifests were read. */
  instruments: number;
  /** Scenario files the repository's own loader found. */
  scenarios: number;
  refs: number;
  distinctRefs: number;
  resolved: number;
  viaScenario: number;
  viaFixture: number;
  dangling: number;
  /** Presets declared across every manifest read, the denominator of the split below. */
  presetsDeclared: number;
  /** Of `dangling`, the ones that are a preset of the instrument that names them. */
  danglingOwnPreset: number;
  /** Of `dangling`, the rest: a ref that is not a preset of its instrument and resolves to nothing. */
  danglingOther: number;
  /** Instruments with at least one case that resolves to a scenario expecting a refusal. */
  instrumentsWithRefusal: number;
  instrumentsWithNonNumeric: number;
}>;

export type AcceptanceReport = Readonly<{
  refs: readonly AcceptanceRef[];
  census: AcceptanceCensus;
  problems: readonly AcceptanceProblem[];
}>;

type Options = Readonly<{
  /** Refuse every dangling ref, rather than the ones the baseline has not recorded. */
  strict?: boolean;
  /** Replaces the recorded debt, so a test can plant one without touching the file. */
  baseline?: readonly string[];
  /** Replaces the declared in-code fixtures. */
  declarations?: Readonly<Record<string, string>>;
  /** Instruments that have declared in their manifest why their model admits no such case. */
  root?: string;
}>;

type ManifestRef = Readonly<{
  lab: string;
  ref: string;
  noRefusal?: string | undefined;
  noNonNumeric?: string | undefined;
  /** The preset ids this same manifest declares. */
  presets: ReadonlySet<string>;
}>;

/**
 * Each manifest's acceptance refs, in manifest order, carrying the preset ids the SAME manifest
 * declares. The presets come from the manifest rather than from `REGISTERED_PRESET_IDS` in
 * content/schemas/experiment.ts on purpose: that list is hand-maintained and held 128 ids on
 * 2026-10-05 where the manifests declared 135, so reading it would have made the split depend on how
 * current the registry is rather than on what the instrument declares.
 */
function manifestRefs(root: string): ManifestRef[] {
  const dir = join(root, "content", "experiments");
  const out: ManifestRef[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith(".yaml") || name === "acceptance-fixtures.yaml") continue;
    const raw = strictParse(readFileSync(join(dir, name), "utf8"), "yaml", name) as {
      acceptanceCases?: unknown;
      acceptanceCoverage?: { noRefusalCase?: unknown; noNonNumericCase?: unknown };
      presets?: unknown;
    } | null;
    if (!raw || typeof raw !== "object") continue;
    const lab = name.slice(0, -".yaml".length);
    const noRefusal =
      typeof raw.acceptanceCoverage?.noRefusalCase === "string"
        ? raw.acceptanceCoverage.noRefusalCase
        : undefined;
    const noNonNumeric =
      typeof raw.acceptanceCoverage?.noNonNumericCase === "string"
        ? raw.acceptanceCoverage.noNonNumericCase
        : undefined;
    const presets = new Set<string>();
    if (Array.isArray(raw.presets))
      for (const p of raw.presets) {
        const id = (p as { presetId?: unknown } | null)?.presetId;
        if (typeof id === "string" && id !== "") presets.add(id);
      }
    const cases = Array.isArray(raw.acceptanceCases) ? raw.acceptanceCases : [];
    if (cases.length === 0) out.push({ lab, ref: "", noRefusal, noNonNumeric, presets });
    for (const c of cases)
      if (typeof c === "string" && c !== "")
        out.push({ lab, ref: c, noRefusal, noNonNumeric, presets });
  }
  return out;
}

/** The declared in-code fixtures: ref -> the file that holds it. */
export function loadFixtureDeclarations(root = process.cwd()): Record<string, string> {
  const path = join(root, FIXTURE_DECLARATIONS);
  if (!existsSync(path)) return {};
  const raw = strictParse(readFileSync(path, "utf8"), "yaml", FIXTURE_DECLARATIONS) as {
    fixtures?: unknown;
  } | null;
  const fixtures = raw && typeof raw === "object" ? raw.fixtures : undefined;
  if (!fixtures || typeof fixtures !== "object" || Array.isArray(fixtures)) return {};
  return Object.fromEntries(
    Object.entries(fixtures as Record<string, unknown>).flatMap(([ref, file]) =>
      typeof file === "string" ? [[ref, file] as const] : [],
    ),
  );
}

/** The recorded debt. */
export function loadAcceptanceBaseline(root = process.cwd()): string[] {
  const path = join(root, ACCEPTANCE_BASELINE);
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf8")) as { dangling?: unknown };
  return Array.isArray(raw.dangling)
    ? raw.dangling.filter((d): d is string => typeof d === "string")
    : [];
}

/**
 * Every acceptance ref, resolved, with the census and every problem. Nothing here reads the tree for
 * a ref's name: a fixture is resolved through its declaration and the declaration is then checked.
 */
export function checkAcceptanceCases(options: Options = {}): AcceptanceReport {
  const root = options.root ?? process.cwd();
  const problems: AcceptanceProblem[] = [];
  const loaded = loadScenarios(defaultScenarioDirs(root));
  const scenarios = new Map(loaded.map((l) => [l.scenario.id, l]));
  const declarations = options.declarations ?? loadFixtureDeclarations(root);
  const baseline = new Set(options.baseline ?? loadAcceptanceBaseline(root));
  const rows = manifestRefs(root);

  const refs: AcceptanceRef[] = [];
  for (const { lab, ref, presets } of rows) {
    if (ref === "") continue;
    const scenario = scenarios.get(ref);
    if (scenario) {
      const status = scenario.scenario.expected?.status?.status;
      const kind =
        status === undefined
          ? undefined
          : status in refusalCodeRegistry
            ? ("refusal" as const)
            : NON_NUMERIC_STATUSES.has(status)
              ? ("non-numeric" as const)
              : undefined;
      refs.push({ lab, ref, resolution: "scenario", where: scenario.path, status, kind });
      continue;
    }
    const declared = declarations[ref];
    if (declared !== undefined) {
      const path = join(root, declared);
      if (!existsSync(path)) {
        problems.push({
          code: "acceptance-fixture-missing-file",
          message: `${lab}: ${ref} is declared as an in-code fixture in ${declared}, which does not exist.`,
        });
      } else if (!readFileSync(path, "utf8").includes(ref)) {
        problems.push({
          code: "acceptance-fixture-absent-from-file",
          message: `${lab}: ${ref} is declared as an in-code fixture in ${declared}, which does not contain that id. A declaration is checked, not believed.`,
        });
      } else {
        refs.push({ lab, ref, resolution: "fixture", where: declared });
        continue;
      }
    }
    // The preset mark is reached only here, AFTER both resolutions have been tried, so a preset that
    // also has a real scenario resolves as that scenario and is never diagnosed as one of these.
    refs.push({
      lab,
      ref,
      resolution: "dangling",
      ...(presets.has(ref) ? { ownPreset: true as const } : {}),
    });
  }

  const distinct = new Set(refs.map((r) => r.ref));
  const dangling = refs.filter((r) => r.resolution === "dangling");
  const danglingIds = new Set(dangling.map((r) => r.ref));

  for (const row of dangling)
    if (options.strict || !baseline.has(row.ref))
      problems.push(
        row.ownPreset
          ? {
              code: "acceptance-ref-is-a-preset",
              message: `${row.lab}: acceptance case ${JSON.stringify(row.ref)} is a preset this manifest declares, not a case. A preset carries parameters and no expectation, so it asserts nothing about a result. Write a scenario that states what those parameters should produce; naming the scenario after the preset is not enough on its own.`,
            }
          : {
              code: "acceptance-ref-dangling",
              message: `${row.lab}: acceptance case ${JSON.stringify(row.ref)} resolves to no scenario and is not a declared in-code fixture.${options.strict ? "" : " It is new debt: write the case, or declare the fixture that holds it."}`,
            },
      );
  for (const recorded of baseline)
    if (!danglingIds.has(recorded))
      problems.push({
        code: "acceptance-baseline-slack",
        message: `${recorded} is recorded as dangling and now resolves. Remove it from ${ACCEPTANCE_BASELINE}: a baseline that is not shrunk stops being a measurement.`,
      });

  const byLab = new Map<string, AcceptanceRef[]>();
  for (const row of refs) byLab.set(row.lab, [...(byLab.get(row.lab) ?? []), row]);
  const instrumentsWithRefusal = [...byLab.values()].filter((rows) =>
    rows.some((r) => r.kind === "refusal"),
  ).length;
  const instrumentsWithNonNumeric = [...byLab.values()].filter((rows) =>
    rows.some((r) => r.kind === "non-numeric"),
  ).length;

  // An instrument that HAS a resolvable refusal case may not lose it. Requiring one of every
  // instrument today would be 33 failures on a tree where none exists, which is a debt to be worked
  // down and is what the baseline's own count records; `--strict` asks for all of them.
  if (options.strict)
    for (const [lab, rows] of byLab) {
      const declaredNoRefusal = manifestRefs(root).find((r) => r.lab === lab)?.noRefusal;
      const declaredNoNonNumeric = manifestRefs(root).find((r) => r.lab === lab)?.noNonNumeric;
      if (!rows.some((r) => r.kind === "refusal") && !declaredNoRefusal)
        problems.push({
          code: "acceptance-instrument-without-refusal",
          message: `${lab}: no acceptance case resolves to a scenario expecting a refusal, and the manifest declares no reason its model admits none.`,
        });
      if (!rows.some((r) => r.kind === "non-numeric") && !declaredNoNonNumeric)
        problems.push({
          code: "acceptance-instrument-without-non-numeric",
          message: `${lab}: no acceptance case resolves to a scenario expecting a non-numeric result, and the manifest declares no reason its model admits none.`,
        });
    }

  const resolved = refs.filter((r) => r.resolution !== "dangling");
  if (refs.length > 0 && resolved.length === 0)
    problems.push({
      code: "acceptance-nothing-resolved",
      message: `${refs.length} acceptance refs were examined and none resolved. A run that resolves nothing reads exactly like a clean one, so it fails here whatever the baseline holds.`,
    });

  return {
    refs,
    census: {
      instruments: byLab.size,
      scenarios: scenarios.size,
      refs: refs.length,
      distinctRefs: distinct.size,
      resolved: resolved.length,
      viaScenario: refs.filter((r) => r.resolution === "scenario").length,
      viaFixture: refs.filter((r) => r.resolution === "fixture").length,
      dangling: dangling.length,
      presetsDeclared: new Set(rows.flatMap((r) => [...r.presets])).size,
      danglingOwnPreset: dangling.filter((r) => r.ownPreset === true).length,
      danglingOther: dangling.filter((r) => r.ownPreset !== true).length,
      instrumentsWithRefusal,
      instrumentsWithNonNumeric,
    },
    problems,
  };
}
