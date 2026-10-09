/**
 * EINSTEIN'S PRINTED 0,8 MIKRON, REPRODUCED BY THE OWNER RATHER THAN RETYPED ONTO A CARD.
 *
 * Paper 2 section 5, printed page 559, states its own inputs and then prints a result:
 * "Wir wollen berechnen, wie gross lambda_x fuer eine Sekunde ist, wenn N gemaess den Resultaten
 * der kinetischen Gastheorie 6.10^23 gesetzt wird; es sei als Fluessigkeit Wasser von 17 Grad C.
 * gewaehlt (k = 1,35.10^-2) und der Teilchendurchmesser sei 0,001 mm", giving
 * "lambda_x = 8.10^-5 cm = 0,8 Mikron", and then "Die mittlere Verschiebung in 1 Min. waere also
 * ca. 6 Mikron." Read from the pinned facsimile's page image on 2026-10-08; k there is the
 * VISCOSITY, not Boltzmann's constant, and the printed 0,001 mm is a DIAMETER, so the radius is
 * 5e-7 m.
 *
 * This is the owner a result card's printed check calls. The card displays `comparison.wording`
 * and never computes a percentage from the two rows, exactly as the mass-energy printed factor
 * does: the two constant sets are reported side by side and are never combined into one number.
 *
 * WHY THE TWO ROWS DIFFER AT ALL, since both use Einstein's printed viscosity, radius and
 * temperature: only the thermal constant changes. The printed set carries his R = 8.31 and
 * N = 6e23, whose quotient is the k_B of 1905; the modern set carries the 2019 defined k_B. So the
 * comparison isolates one constant, which is the only honest thing to show here.
 *
 * It does NOT compare against a modern VISCOSITY of water at 17 degrees, which is a different
 * question (that comparison moves the number much further, and conflating the two would read as
 * though Einstein's arithmetic were off when it is his fluid datum that is dated).
 */
import { getConstantSet } from "../constants.ts";
import { rmsDisplacement, stokesEinsteinD } from "./distributions.ts";

/** The scenario this owner reproduces, named so a card cannot point at it by a different spelling. */
export const BROWNIAN_PRINTED_DISPLACEMENT_SCENARIO = "diffusion-einstein-1905-printed";

export type PrintedDisplacementInput = Readonly<{
  /** Kelvin. Einstein's 17 degrees C, converted by the site and declared as such. */
  temperatureK: number;
  /** Pa s. Einstein's printed k = 1,35e-2 poise. */
  viscosityPaS: number;
  /** Metres. Half the printed 0,001 mm diameter. */
  particleRadiusM: number;
  /** Seconds. The paper computes one second and then states one minute. */
  elapsedSeconds: number;
}>;

export type PrintedDisplacementRow = Readonly<{
  constantSetId: string;
  /** Root mean square displacement along x, in metres. */
  value: number;
  /** The diffusion coefficient this row's thermal constant produced, m^2/s. */
  diffusionCoefficient: number;
  entryLabels: readonly string[];
}>;

export type PrintedDisplacement = Readonly<{
  scenarioId: string;
  status: "value" | "outside-domain";
  reason?: string;
  condition?: string;
  elapsedSeconds: number;
  printed: PrintedDisplacementRow;
  modern: PrintedDisplacementRow;
  comparison: Readonly<{
    leftSetId: string;
    rightSetId: string;
    /** modern divided by printed. Reported, never rendered as a percentage by a view. */
    ratio: number;
    wording: string;
  }>;
}>;

const PRINTED_SET = "einstein-1905-brownian-printed";
const MODERN_SET = "modern-si-2019";

function emptyRow(constantSetId: string, entryLabels: readonly string[]): PrintedDisplacementRow {
  return Object.freeze({
    constantSetId,
    value: Number.NaN,
    diffusionCoefficient: Number.NaN,
    entryLabels: Object.freeze([...entryLabels]),
  });
}

/**
 * Reproduces the printed displacement under Einstein's constants and under the modern thermal
 * constant, from the same stated inputs. A refusal is typed and never a zero.
 */
export function printedBrownianDisplacement(input: PrintedDisplacementInput): PrintedDisplacement {
  const { temperatureK: T, viscosityPaS: eta, particleRadiusM: a, elapsedSeconds: t } = input;
  const printedLabels = [
    "molarGasConstant (editorial: 8.31 J/(mol K); paper 2 prints no R)",
    "avogadroConstant (printed: 6e23 1/mol)",
  ];
  const modernLabels = ["boltzmannConstant (defined: 1.380649e-23 J/K)"];

  if (![T, eta, a].every((v) => Number.isFinite(v) && v > 0) || !Number.isFinite(t) || t < 0) {
    return Object.freeze({
      scenarioId: BROWNIAN_PRINTED_DISPLACEMENT_SCENARIO,
      status: "outside-domain" as const,
      condition: "T > 0, eta > 0, a > 0, t >= 0",
      reason:
        "Temperature, viscosity and radius must be strictly positive and the elapsed time nonnegative.",
      elapsedSeconds: t,
      printed: emptyRow(PRINTED_SET, printedLabels),
      modern: emptyRow(MODERN_SET, modernLabels),
      comparison: Object.freeze({
        leftSetId: MODERN_SET,
        rightSetId: PRINTED_SET,
        ratio: Number.NaN,
        wording:
          "No comparison: the stated inputs are outside the model's domain, so neither constant set produced a displacement.",
      }),
    });
  }

  const row = (setId: string, entryLabels: readonly string[]): PrintedDisplacementRow => {
    const set = getConstantSet(setId);
    const d = stokesEinsteinD({ T, eta, a }, set).result;
    // An Evaluation's value is `number | Float64Array`, because the same shape carries frame
    // arrays elsewhere. Both of these are scalars, so the guard narrows rather than casts: a cast
    // would compile and hand a Float64Array to a card as though it were a length.
    if (d.status !== "value" || typeof d.value !== "number") return emptyRow(setId, entryLabels);
    const r = rmsDisplacement(d.value, t).result;
    if (r.status !== "value" || typeof r.value !== "number") return emptyRow(setId, entryLabels);
    return Object.freeze({
      constantSetId: setId,
      value: r.value,
      diffusionCoefficient: d.value,
      entryLabels: Object.freeze([...entryLabels]),
    });
  };

  const printed = row(PRINTED_SET, printedLabels);
  const modern = row(MODERN_SET, modernLabels);
  const ratio = modern.value / printed.value;

  return Object.freeze({
    scenarioId: BROWNIAN_PRINTED_DISPLACEMENT_SCENARIO,
    status: "value" as const,
    elapsedSeconds: t,
    printed,
    modern,
    comparison: Object.freeze({
      leftSetId: MODERN_SET,
      rightSetId: PRINTED_SET,
      ratio,
      wording:
        "Both rows use Einstein's printed viscosity, particle radius and temperature; only the thermal constant differs, his R over N against the defined Boltzmann constant of 2019. The modern row is the slightly smaller of the two. Displacement goes as the square root of the diffusion coefficient, so a change in that constant moves the length by less than it moves the coefficient.",
    }),
  });
}
