/**
 * The printed check a result card names (printedChecks.ts): each refusal by its rule, from a fixture
 * root that reaches exactly that site, and the join itself on the real scenario, whose owner gives
 * both values and the comparison. The fixture roots are temporary directories.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MASS_ENERGY_PRINTED_FACTOR_SCENARIO,
  PRINTED_FACTOR_WORDING,
} from "../../physics/reference/massEnergy.ts";
import { printedCheckFor, ResultCardsError } from "./printedChecks.ts";

function rootWith(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "result-cards-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const scenario = (value: number, unit: string) =>
  [
    "inputs:",
    "  emittedEnergy:",
    `    value: ${value}`,
    `    unit: ${unit}`,
    "expected:",
    "  outputs:",
    '    - printedValue: "a fixture value"',
    "",
  ].join("\n");

const scenarioPath = `content/scenarios/${MASS_ENERGY_PRINTED_FACTOR_SCENARIO}.yaml`;

function ruleOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof ResultCardsError) return error.rule;
    throw error;
  }
  return "no refusal";
}

describe("the printed check refuses a layer it cannot own", () => {
  test("a scenario with no reproducer here: printed-check-unowned", () => {
    expect(ruleOf(() => printedCheckFor(rootWith({}), "a-scenario-nobody-owns"))).toBe(
      "printed-check-unowned",
    );
  });

  test("(printedChecks.ts:218) a scenario that states no energy in joules: printed-check-scenario-shape", () => {
    const root = rootWith({ [scenarioPath]: scenario(1e7, "erg") });
    expect(ruleOf(() => printedCheckFor(root, MASS_ENERGY_PRINTED_FACTOR_SCENARIO))).toBe(
      "printed-check-scenario-shape",
    );
  });

  test("(printedChecks.ts:224) an energy the owner refuses: printed-check-refused", () => {
    const root = rootWith({ [scenarioPath]: scenario(-1, "J") });
    expect(ruleOf(() => printedCheckFor(root, MASS_ENERGY_PRINTED_FACTOR_SCENARIO))).toBe(
      "printed-check-refused",
    );
  });

  test("the control: a well-formed scenario is reproduced, not refused", () => {
    const root = rootWith({ [scenarioPath]: scenario(1, "J") });
    expect(printedCheckFor(root, MASS_ENERGY_PRINTED_FACTOR_SCENARIO).rows.length).toBe(2);
  });
});

/**
 * THE BROWNIAN BRANCH'S FOUR REFUSALS, EACH BY ITS OWN SITE.
 *
 * Why one test per site rather than one per code: the refusal scanner reads
 * `printed-check-scenario-shape` at four sites and `printed-check-refused` at two, and its rule is
 * that an uncited site under a repeated code is never credited. So covering one of each code left
 * all six reading as untested. The file carried one site per code when it was written (d61c6ed3);
 * fd8e5798 and 0d0ab45c took them to four and two, which is what un-credited the originals.
 */
describe("the brownian printed check refuses each malformed shape at its own site", () => {
  const BROWNIAN = "diffusion-einstein-1905-printed";
  const MODERN = "diffusion-modern-viscosity-17c";
  const at = (id: string) => `content/scenarios/${id}.yaml`;

  /** Exponents are written signed, because YAML 1.1 resolves `5e-7` as a float and `6e23` as a string. */
  const brownian = (over: Readonly<Record<string, string>> = {}) =>
    [
      "inputs:",
      "  temperature:",
      `    value: ${over.temperature ?? "290.15"}`,
      "    unit: K",
      "  viscosity:",
      `    value: ${over.viscosity ?? "0.00135"}`,
      '    unit: "Pa s"',
      "  particleRadius:",
      `    value: ${over.particleRadius ?? "5.0e-7"}`,
      "    unit: m",
      ...(over.omitElapsed === "yes"
        ? []
        : ["  elapsedTime:", `    value: ${over.elapsedTime ?? "1"}`, "    unit: s"]),
      "expected:",
      "  outputs:",
      ...(over.outputWithoutPrintedValue === "yes"
        ? ["    - elapsedTime:", "        value: 1", "        unit: s"]
        : ['    - printedValue: "0,8 Mikron"']),
      "",
    ].join("\n");

  const modern = (withSource = true) =>
    [
      "editorialInputs:",
      "  - quantityId: viscosity",
      "    value: 0.0010798059",
      '    unit: "Pa s"',
      ...(withSource ? ['    source: "a fixture source for this test only"'] : []),
      "",
    ].join("\n");

  test("(printedChecks.ts:103) a brownian scenario missing an elapsed time: printed-check-scenario-shape", () => {
    const root = rootWith({
      [at(BROWNIAN)]: brownian({ omitElapsed: "yes" }),
      [at(MODERN)]: modern(),
    });
    expect(ruleOf(() => printedCheckFor(root, BROWNIAN))).toBe("printed-check-scenario-shape");
  });

  test("(printedChecks.ts:115) a modern-viscosity scenario with no sourced viscosity: printed-check-scenario-shape", () => {
    // The brownian scenario is WELL FORMED here, so the refusal can only come from the modern one.
    // That is the whole point of a per-site test: site 103 and site 115 carry the same code.
    const root = rootWith({ [at(BROWNIAN)]: brownian(), [at(MODERN)]: modern(false) });
    expect(ruleOf(() => printedCheckFor(root, BROWNIAN))).toBe("printed-check-scenario-shape");
  });

  test("(printedChecks.ts:132) an expected output with no printed value: printed-check-scenario-shape", () => {
    const root = rootWith({
      [at(BROWNIAN)]: brownian({ outputWithoutPrintedValue: "yes" }),
      [at(MODERN)]: modern(),
    });
    expect(ruleOf(() => printedCheckFor(root, BROWNIAN))).toBe("printed-check-scenario-shape");
  });

  test("(printedChecks.ts:145) a radius the owner refuses: printed-check-refused", () => {
    // A negative radius is finite, so it passes the shape check at 103 and is refused by the owner
    // instead, which is the only way to reach 145 rather than 103.
    const root = rootWith({
      [at(BROWNIAN)]: brownian({ particleRadius: "-5.0e-7" }),
      [at(MODERN)]: modern(),
    });
    expect(ruleOf(() => printedCheckFor(root, BROWNIAN))).toBe("printed-check-refused");
  });

  test("the control: a well-formed pair is reproduced, not refused", () => {
    // Without this, every assertion above would also pass for a function that refused everything.
    const root = rootWith({ [at(BROWNIAN)]: brownian(), [at(MODERN)]: modern() });
    expect(ruleOf(() => printedCheckFor(root, BROWNIAN))).toBe("no refusal");
  });
});

describe("the printed check on the real scenario", () => {
  test("the owner gives the printed and the modern value, each with its constant set, and the comparison", () => {
    const check = printedCheckFor(process.cwd(), MASS_ENERGY_PRINTED_FACTOR_SCENARIO);
    expect(check.rows.map((r) => [r.constantSetId, r.reproducedText])).toEqual([
      ["einstein-1905-mass-energy-printed", "1 g"],
      ["modern-si-2019", "1.0013851 g"],
    ]);
    expect(check.rows[0]?.printedValue).toBe("1 g");
    expect(check.comparison).toBe(PRINTED_FACTOR_WORDING);
  });
});
