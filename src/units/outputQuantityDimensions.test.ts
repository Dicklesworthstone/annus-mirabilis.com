/**
 * AN OUTPUT'S DECLARED UNIT AGAINST THE DIMENSION OF THE QUANTITY ITS MANIFEST BINDS IT TO (am-ff2s).
 *
 * AGENTS.md lists "dimension mismatches in supported expressions" among what the content compiler
 * rejects. Nothing compared these two, which is how bm-07 came to declare
 * `radiusNumberProduct: c("m/mol", ...)` in code and `quantityId: avogadroNumberEstimate` in its
 * manifest: a mismatch of a whole length dimension, inherited by anything reading the output's
 * quantityId for a name, a unit or a colour.
 *
 * IT IS A TEST AND NOT A SCRIPT, on purpose. `bun run test` is reached by `bun run gates` and by all
 * three release profiles, while a standalone audit script has to be registered to run at all - and six
 * plan-specified audits in this repository exist, can fail, and are reachable from no runner
 * (am-unwired-audits-uwot). A check nobody runs is a claim.
 *
 * THE DENOMINATOR IS PRINTED, because "0 errors" over an empty join is the failure this guards. The join
 * has three sides and any of them can go quietly empty: the manifests under content/experiments, the
 * `*_OUTPUTS` contracts in the experiment modules, and the quantity registry. Non-vacuity floors are
 * asserted on each before the verdict.
 *
 * AN UNPARSED UNIT IS A FAILURE, not an exclusion. The first attempt at this comparison was abandoned
 * because the unit parser it used returned dimensionless for anything it did not know, so every pair
 * agreed; see outputUnitDimension.ts. The parser now refuses, and this check refuses with it, because an
 * excluded pair and an agreeing pair are the same green.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadQuantityRegistry } from "../content/quantities/registry.ts";
import { strictParse } from "../content/schemas/strictParse.ts";
import {
  exponentsEqual,
  formatExponents,
  registryExponents,
  unitDimension,
} from "./outputUnitDimension.ts";

const ROOT = process.cwd();
const EXPERIMENTS = fileURLToPath(new URL("../experiments/", import.meta.url));
/** Modules that declare lab outputs outside a definition.ts, as outputLabels.test.ts lists them. */
const EXTRA = ["sr08/forceLedger.ts", "sr08/session.ts", "lightThread/session.ts"];

/**
 * THE RECORDED DEBT, measured 2026-10-06 over all 33 manifests after bm-07 was repaired.
 *
 * Every entry is a real disagreement, not an exemption: `<instrument>/<output>` with the unit the code
 * declares, the quantity the manifest binds, and what the two dimensions are. They divide into two
 * kinds, and the division is why they are listed rather than counted.
 *
 * ONE: A DIMENSIONLESS RATIO BOUND TO A DIMENSIONAL QUANTITY (15). The output is a ratio to a reference -
 * v/c, ΔS/k_B, an intensity normalised to its centre - and the quantity it names is the dimensional thing
 * the ratio is taken of. Whether each should bind a new dimensionless quantity, or carry a declared
 * normalisation, is an editorial decision per output and not a repair to make in passing. The relativity
 * ones are the clearest: `composedSpeedOverC` is a number between 0 and 1 and `frameSpeed` is a velocity.
 *
 * TWO: A DENSITY OR AN INTENSITY BOUND TO A TOTAL (2). `lq-01/pointSourceIntensity` is W/m² against
 * `incidentPower` in watts, and `lq-03/bandEnergy` is J/m³ against `bandEnergy` in joules. AGENTS.md names
 * this distinction explicitly - "a spectral density versus a total" - among the ones dimensions must keep,
 * so these two are the same class of defect as bm-07 and not a convention.
 *
 * Filed on am-bzsk, which is the standing home for findings with no open bead of their own. THIS LIST ONLY
 * EVER COMES DOWN: a disagreement repaired must be deleted from it, and the equality below is what makes
 * that a visible change rather than a quiet surplus.
 */
const RECORDED_DISAGREEMENTS: readonly string[] = [
  // One: a dimensionless ratio bound to the dimensional quantity it is a ratio of.
  'lq-01/centerIntensity unit="1" (1) vs incidentPower (m^2 kg s^-3)',
  'lq-01/instantaneousCenterIntensity unit="1" (1) vs incidentPower (m^2 kg s^-3)',
  'lq-01/selectedPositionIntensity unit="1" (1) vs incidentPower (m^2 kg s^-3)',
  'bm-03/momentumIntegrals unit="1" (1) vs freeEnergy (m^2 kg s^-2)',
  'bm-03/volumeIndependentFactor unit="1" (1) vs freeEnergy (m^2 kg s^-2)',
  'lq-05/deltaSOverKb unit="1" (1) vs entropy (m^2 kg s^-2 K^-1)',
  'sr-04/leftRayFraction unit="1" (1) vs frameSpeed (m s^-1)',
  'sr-04/rightRayFraction unit="1" (1) vs frameSpeed (m s^-1)',
  'sr-05/dailyLossSpeedBeta unit="1" (1) vs frameSpeed (m s^-1)',
  'sr-06/composedSpeedOverC unit="1" (1) vs frameSpeed (m s^-1)',
  'sr-06/composedUxOverC unit="1" (1) vs frameSpeed (m s^-1)',
  'sr-06/composedUyOverC unit="1" (1) vs frameSpeed (m s^-1)',
  'sr-06/galileanSpeedOverC unit="1" (1) vs frameSpeed (m s^-1)',
  'sr-06/printedSpeedOverC unit="1" (1) vs frameSpeed (m s^-1)',
  'sr-06/shortfall unit="1" (1) vs frameSpeed (m s^-1)',
  // Two: a density or an intensity bound to a total.
  'lq-01/pointSourceIntensity unit="W/m2" (kg s^-3) vs incidentPower (m^2 kg s^-3)',
  'lq-03/bandEnergy unit="J/m^3" (m^-1 kg s^-2) vs bandEnergy (m^2 kg s^-2)',
];

type Row = Readonly<{ instrument: string; output: string; unit: string; quantityId: string }>;

type Report = Readonly<{
  manifests: number;
  pairs: number;
  compared: number;
  agree: number;
  disagreements: readonly string[];
  unparsed: readonly string[];
  contracts: number;
  registryIds: number;
}>;

/** Every output id a laboratory publishes, with the unit its contract declares. */
async function unitByOutputId(): Promise<{ units: Map<string, string>; contracts: number }> {
  const files = [
    ...readdirSync(EXPERIMENTS)
      .map((dir) => join(dir, "definition.ts"))
      .filter((f) => existsSync(join(EXPERIMENTS, f))),
    ...EXTRA,
  ];
  const units = new Map<string, string>();
  let contracts = 0;
  for (const file of files) {
    const mod = (await import(join(EXPERIMENTS, file))) as Record<string, unknown>;
    for (const [name, value] of Object.entries(mod)) {
      if (!name.includes("OUTPUT") || !value || typeof value !== "object") continue;
      for (const [id, contract] of Object.entries(value as Record<string, unknown>)) {
        if (!contract || typeof contract !== "object" || !("semanticKind" in contract)) continue;
        contracts += 1;
        if (!units.has(id)) units.set(id, String((contract as { unit?: unknown }).unit ?? ""));
      }
    }
  }
  return { units, contracts };
}

/** The (output, quantityId) pairs every manifest declares. */
function manifestPairs(): { rows: Row[]; manifests: number } {
  const dir = join(ROOT, "content", "experiments");
  const files = readdirSync(dir).filter((f) => f.endsWith(".yaml"));
  const rows: Row[] = [];
  for (const file of files) {
    // THE REPOSITORY'S OWN PARSER, not the `yaml` package: this project has two YAML readers that do not
    // agree on what is valid, and a check reading the one the compiler does not use would be judging a
    // different corpus from the one that ships.
    const doc = strictParse(readFileSync(join(dir, file), "utf8"), "yaml") as {
      id?: string;
      outputs?: { id?: string; quantityId?: string }[];
    };
    const instrument = doc.id ?? file.replace(/\.yaml$/, "");
    for (const output of doc.outputs ?? []) {
      if (!output.id || !output.quantityId) continue;
      rows.push({ instrument, output: output.id, unit: "", quantityId: output.quantityId });
    }
  }
  return { rows, manifests: files.length };
}

async function audit(): Promise<Report> {
  const { units, contracts } = await unitByOutputId();
  const { rows, manifests } = manifestPairs();
  const registry = loadQuantityRegistry(join(ROOT, "content", "quantities"));
  const disagreements: string[] = [];
  const unparsed: string[] = [];
  let compared = 0;
  let agree = 0;
  for (const row of rows) {
    const unit = units.get(row.output);
    const quantity = registry.quantities.get(row.quantityId);
    // A pair is only comparable when all three sides exist: the code gives the output a unit, the
    // manifest names a quantity, and that quantity declares a dimension. Each absence is a different
    // gap and none of them is this check's subject.
    if (unit === undefined || quantity?.dimension === undefined) continue;
    const want = registryExponents(quantity.dimension);
    // A fractional exponent is declined rather than compared: sqrt(Dt) has a rational dimension and
    // comparing it against an integer vector would be the wrong question, not a failure.
    if (want === null) continue;
    const got = unitDimension(unit);
    if (got.kind === "unparsed") {
      unparsed.push(
        `${row.instrument}/${row.output} unit=${JSON.stringify(unit)} token=${got.token} (${got.reason})`,
      );
      continue;
    }
    compared += 1;
    if (exponentsEqual(got.exponents, want)) {
      agree += 1;
      continue;
    }
    disagreements.push(
      `${row.instrument}/${row.output} unit=${JSON.stringify(unit)} (${formatExponents(got.exponents)}) vs ${row.quantityId} (${formatExponents(want)})`,
    );
  }
  return {
    manifests,
    pairs: rows.length,
    compared,
    agree,
    disagreements: disagreements.sort((a, b) => a.localeCompare(b, "en")),
    unparsed,
    contracts,
    registryIds: registry.ids.length,
  };
}

describe("every manifest output's unit agrees with its quantity's dimension", () => {
  test("the three sides of the join are real populations, so nothing below is vacuous", async () => {
    const report = await audit();
    // Each floor guards a different way this check could pass over nothing: a manifest directory it
    // cannot read, an import that returns no contracts, a registry that loaded nothing, and a join whose
    // keys never meet.
    expect(report.manifests).toBeGreaterThanOrEqual(33);
    expect(report.contracts).toBeGreaterThan(400);
    expect(report.registryIds).toBeGreaterThan(300);
    expect(report.pairs).toBeGreaterThan(300);
    expect(report.compared).toBeGreaterThan(150);
    console.log(
      `[output dimensions] ${report.compared} of ${report.pairs} manifest outputs across ` +
        `${report.manifests} manifests compared (${report.contracts} code contracts, ` +
        `${report.registryIds} registry ids): ${report.agree} agree, ` +
        `${report.disagreements.length} disagree, ${report.unparsed.length} unparsed`,
    );
  });

  test("no output's unit is dimensionally inconsistent with its quantity, beyond the recorded debt", async () => {
    const report = await audit();
    expect(report.disagreements).toEqual(
      [...RECORDED_DISAGREEMENTS].sort((a, b) => a.localeCompare(b, "en")),
    );
  });

  test("bm-07's radius-number product agrees, which is the instance this check was written for", async () => {
    // Named rather than left to the set above, because it is the historical fact: it disagreed until
    // 2026-10-06, by a whole length dimension, and a count of 17 would not say which 17.
    const report = await audit();
    expect(report.disagreements.filter((d) => d.startsWith("bm-07/"))).toEqual([]);
    expect(report.agree).toBeGreaterThan(170);
  });

  test("every unit in the join parses, so no pair is silently excluded", async () => {
    // An excluded pair and an agreeing pair are the same green. This is the half the first attempt at
    // this comparison got wrong, by using a parser that returned dimensionless for what it did not know.
    const report = await audit();
    expect(report.unparsed).toEqual([]);
  });

  test("PLANTED: pointing an output at a quantity of another dimension is reported, naming it", async () => {
    // The predicate driven directly rather than by editing bm-07.yaml, so the plant cannot be swept into
    // a peer's commit while it is red. The shape is exactly the defect: a length-times-per-mole product
    // bound to a per-mole quantity.
    const registry = loadQuantityRegistry(join(ROOT, "content", "quantities"));
    const product = registry.quantities.get("radiusNumberProduct");
    const perMole = registry.quantities.get("avogadroNumberEstimate");
    expect(product?.dimension).toBeDefined();
    expect(perMole?.dimension).toBeDefined();
    if (!product?.dimension || !perMole?.dimension) throw new Error("unreachable");
    const unit = unitDimension("m/mol");
    if (unit.kind !== "dimension") throw new Error("m/mol must parse");
    const right = registryExponents(product.dimension);
    const wrong = registryExponents(perMole.dimension);
    expect(right).not.toBeNull();
    expect(wrong).not.toBeNull();
    if (right === null || wrong === null) throw new Error("unreachable");
    // The repaired binding agrees; the historical one does not, and the message names both dimensions.
    expect(exponentsEqual(unit.exponents, right)).toBe(true);
    expect(exponentsEqual(unit.exponents, wrong)).toBe(false);
    expect(formatExponents(unit.exponents)).toBe("m mol^-1");
    expect(formatExponents(wrong)).toBe("mol^-1");
  });

  test("the recorded debt is a list of named instances, with no duplicates", async () => {
    // A baseline is the record of a debt, not a budget: a duplicate entry would silently admit a second
    // offender under one line, and an entry that no longer disagrees must be deleted rather than left.
    expect(new Set(RECORDED_DISAGREEMENTS).size).toBe(RECORDED_DISAGREEMENTS.length);
    expect(RECORDED_DISAGREEMENTS.length).toBe(17);
    for (const entry of RECORDED_DISAGREEMENTS) expect(entry).toMatch(/^[a-z]+-\d+\/\w+ unit=/);
  });
});
