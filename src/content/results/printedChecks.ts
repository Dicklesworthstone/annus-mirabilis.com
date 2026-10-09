/**
 * THE PRINTED CHECK A RESULT CARD NAMES, joined at build time from the card's scenario and the
 * scenario's owning function (am-me-results-cards-c6mf). A card never computes a number: the owner
 * reproduces the printed value and the modern comparison, and this module only reads the scenario,
 * calls the owner, and labels what comes back.
 *
 * It lives beside the card loader, not with the results face that shows it, because the join calls
 * physics and the face may not: nothing under src/reader/ imports src/physics/reference
 * (noPhysicsInComponents.test.ts, AGENTS.md "Kernels own the law"). The face receives these rows
 * as plain values and formats nothing but them.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BROWNIAN_PRINTED_DISPLACEMENT_SCENARIO,
  printedBrownianDisplacement,
} from "../../physics/reference/diffusion/printedDisplacement.ts";
import {
  MASS_ENERGY_PRINTED_FACTOR_SCENARIO,
  printedMassConversion,
} from "../../physics/reference/massEnergy.ts";
import { parseYaml } from "../provenance/yaml.ts";

/** A card layer the results face will not show: its rule names the refusal. */
export class ResultCardsError extends Error {
  readonly rule: string;
  constructor(rule: string, message: string) {
    super(message);
    this.name = "ResultCardsError";
    this.rule = rule;
  }
}

/** One row of a printed check: a printed or a comparison value, labelled by its constant set. */
export type PrintedCheckRow = Readonly<{
  printedValue: string;
  constantSetId: string;
  reproducedValue: number;
  /** The reproduced value with its unit, at the precision the comparison needs. */
  reproducedText: string;
  comparisonKind: string;
  label: string;
}>;

/** A card's printed check: the scenario's stated inputs, its rows, and the owner's comparison. */
export type ScenarioCheck = Readonly<{
  scenarioId: string;
  statedInputs: Readonly<Record<string, string>>;
  transcriptionPending: boolean;
  rows: readonly PrintedCheckRow[];
  /** The owner's sentence comparing the rows' constant sets, never derived here. */
  comparison: string;
}>;

/** Eight significant figures, the precision at which the two conversions differ visibly. */
const grams = (g: number) => `${Number(g.toPrecision(8))} g`;
/** Seven figures in micrometres, where the two thermal constants first differ. */
const microns = (m: number) => `${Number((m * 1e6).toPrecision(7))} um`;

/** The modern-golden scenario that owns the reference viscosity for the paper's liquid. */
const MODERN_VISCOSITY_SCENARIO = "diffusion-modern-viscosity-17c";

type Scenario = {
  editorialInputs?: { quantityId?: unknown; value?: unknown; source?: unknown }[];
  inputs?: {
    emittedEnergy?: { value?: unknown; unit?: unknown };
    temperature?: { value?: unknown };
    viscosity?: { value?: unknown };
    particleRadius?: { value?: unknown };
    elapsedTime?: { value?: unknown };
  };
  expected?: { outputs?: { printedValue?: unknown }[] };
  transcription?: { status?: unknown };
};

function readScenario(root: string, scenarioId: string): Scenario {
  return parseYaml(
    readFileSync(join(root, "content", "scenarios", `${scenarioId}.yaml`), "utf8"),
  ) as Scenario;
}

/**
 * Einstein's printed displacement, paper 2 section 5. The owner reproduces both rows from the
 * scenario's stated inputs; this function reads the scenario and labels what comes back, and the
 * sentence comparing the two constant sets is the owner's, never written here.
 */
function brownianPrintedCheck(root: string, scenarioId: string): ScenarioCheck {
  const scenario = readScenario(root, scenarioId);
  const T = scenario.inputs?.temperature?.value;
  const eta = scenario.inputs?.viscosity?.value;
  const a = scenario.inputs?.particleRadius?.value;
  const t = scenario.inputs?.elapsedTime?.value;
  const printedValue = scenario.expected?.outputs?.[0]?.printedValue;
  if (
    typeof T !== "number" ||
    typeof eta !== "number" ||
    typeof a !== "number" ||
    typeof t !== "number" ||
    typeof printedValue !== "string"
  )
    throw new ResultCardsError(
      "printed-check-scenario-shape",
      `Scenario ${scenarioId} does not state a temperature, viscosity, radius, elapsed time and printed value.`,
    );
  // The modern reference viscosity is NOT chosen here. It is read from the modern-golden scenario
  // that owns it, with the citation that scenario records, so the third row's provenance is the
  // record's rather than this module's.
  const modern = readScenario(root, MODERN_VISCOSITY_SCENARIO);
  const viscosityInput = (modern.editorialInputs ?? []).find((e) => e.quantityId === "viscosity");
  if (typeof viscosityInput?.value !== "number" || typeof viscosityInput.source !== "string")
    throw new ResultCardsError(
      "printed-check-scenario-shape",
      `Scenario ${MODERN_VISCOSITY_SCENARIO} does not state a viscosity with a source.`,
    );
  const r = printedBrownianDisplacement({
    temperatureK: T,
    viscosityPaS: eta,
    particleRadiusM: a,
    elapsedSeconds: t,
    modernViscosity: {
      valuePaS: viscosityInput.value,
      // The citation id only, not the whole retrieval sentence, which is the record's to hold.
      sourceLabel: viscosityInput.source.split(":")[0] ?? "modern reference",
    },
  });
  if (r.status !== "value")
    throw new ResultCardsError(
      "printed-check-refused",
      `${scenarioId}: ${r.reason ?? "the owner refused the input"}`,
    );
  return {
    scenarioId,
    statedInputs: {
      // The radius is half the printed 0,001 mm diameter, and saying so here is the point: the
      // card shows what the paper states, and the halving is the editorial step.
      "particle diameter": `${(a * 2e3).toPrecision(2)} mm (radius ${a.toExponential()} m)`,
      viscosity: `${eta} Pa s (printed as k = 1,35 \u00b7 10^-2)`,
      temperature: `${T} K (printed as 17 \u00b0 C)`,
      t: `${t} s`,
    },
    transcriptionPending: scenario.transcription?.status !== "verified",
    rows: [
      {
        printedValue,
        constantSetId: r.printed.constantSetId,
        reproducedValue: r.printed.value,
        reproducedText: microns(r.printed.value),
        comparisonKind: "rounds-to",
        label: "as printed: his R over N as the thermal constant",
      },
      {
        printedValue: "(not printed)",
        constantSetId: r.modern.constantSetId,
        reproducedValue: r.modern.value,
        reproducedText: microns(r.modern.value),
        comparisonKind: "modern-constant",
        label: "modern constants: the defined Boltzmann constant, his fluid data unchanged",
      },
      ...(r.modernViscosity
        ? [
            {
              printedValue: "(not printed)",
              constantSetId: r.modernViscosity.constantSetId,
              reproducedValue: r.modernViscosity.value,
              reproducedText: microns(r.modernViscosity.value),
              comparisonKind: "modern-comparison",
              label:
                "modern comparison: today's reference viscosity for water at 17 degrees, which the paper overstates",
            },
          ]
        : []),
    ],
    comparison: r.comparison.wording,
  };
}

/**
 * The printed check a card names, from its scenario and the scenario's owner. Only the scenarios a
 * card can name have a reproducer here; any other is refused, never shown without its owner.
 */
export function printedCheckFor(root: string, scenarioId: string): ScenarioCheck {
  if (scenarioId === BROWNIAN_PRINTED_DISPLACEMENT_SCENARIO)
    return brownianPrintedCheck(root, scenarioId);
  if (scenarioId !== MASS_ENERGY_PRINTED_FACTOR_SCENARIO)
    throw new ResultCardsError(
      "printed-check-unowned",
      `No owner reproduces scenario ${scenarioId} for a result card.`,
    );
  const scenario = readScenario(root, scenarioId);
  const energy = scenario.inputs?.emittedEnergy;
  const printedValue = scenario.expected?.outputs?.[0]?.printedValue;
  if (typeof energy?.value !== "number" || energy.unit !== "J" || typeof printedValue !== "string")
    throw new ResultCardsError(
      "printed-check-scenario-shape",
      `Scenario ${scenarioId} does not state an energy in joules and a printed value.`,
    );
  const r = printedMassConversion({ emittedEnergyJoules: energy.value });
  if (r.status !== "value")
    throw new ResultCardsError(
      "printed-check-refused",
      `${scenarioId}: ${r.reason ?? "the owner refused the input"}`,
    );
  return {
    scenarioId,
    statedInputs: {
      L: `${energy.value.toExponential()} J (${r.emittedEnergyErg.toExponential()} erg)`,
    },
    transcriptionPending: scenario.transcription?.status !== "verified",
    rows: [
      {
        printedValue,
        constantSetId: r.printed.constantSetId,
        reproducedValue: r.printed.value,
        reproducedText: grams(r.printed.value),
        comparisonKind: "rounds-to",
        label: "as printed: L divided by the paper's 9·10²⁰",
      },
      {
        printedValue: "(not printed)",
        constantSetId: r.modern.constantSetId,
        reproducedValue: r.modern.value,
        reproducedText: grams(r.modern.value),
        comparisonKind: "modern-comparison",
        label: "modern comparison: L divided by the square of today's defined speed of light",
      },
    ],
    comparison: r.comparison.wording,
  };
}
