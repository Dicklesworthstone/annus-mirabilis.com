/** Transfer exercise: radiation constants and a synthetic Brownian inference of N. */
import {
  type ConstantSet,
  ConstantSetError,
  constantValue,
  createDeclaredConstantSet,
  getConstantSet,
  withHistoricalGuard,
} from "../../physics/reference/constants.ts";
import {
  brownianFrames,
  chiSquareQuantile,
  stokesEinsteinD,
} from "../../physics/reference/diffusion.ts";
import {
  drawHiddenMolecularNumber,
  INFERENCE_GRID_DT,
  INFERENCE_STREAMS,
} from "../../physics/reference/inference/synthetic.ts";
import {
  type Assessment,
  estimateIncrements,
  estimatorInterval,
  identifiabilityFamily,
  independentModelAdmission,
  invertToMolecularNumber,
} from "../../physics/reference/inference.ts";
import { parseU64, StreamInputError } from "../../physics/reference/philox.ts";
import { avogadroFromPlanckConstants } from "../../physics/reference/radiation.ts";
import {
  ExerciseReferenceError,
  type NumericExercisePart,
  type NumericReference,
  referenceFromEvaluation,
} from "../exercises/numeric.ts";
import type { ConnectionExercise } from "./types.ts";

export const AVOGADRO_EXERCISE_ID = "cross-journey-avogadro-three-ways";
export const AVOGADRO_RADIATION_SET = "einstein-1905-light-quanta-printed";
export const AVOGADRO_BROWNIAN_SET = "einstein-1905-brownian-printed";
export const AVOGADRO_BROWNIAN_SETTINGS = Object.freeze({
  seed: "190505110000000007",
  M: 24,
  d: 1,
  dt: INFERENCE_GRID_DT,
  T: 290.15,
  eta: 1.35e-3,
  a: 0.5e-6,
  alpha: 0.05,
});

/** A reference owner must supply its complete accepted result before the exercise can publish. */
export function requireAvogadroComputation<T>(result: Assessment<T>, owner: string): T {
  if (result.kind !== "accepted")
    throw new ExerciseReferenceError(
      "exercise-reference-not-a-value",
      `${AVOGADRO_EXERCISE_ID}: ${owner} returned ${result.kind}; no exercise reference can be published.`,
    );
  return result.data;
}

/** A synthetic label must not let the historical exercise acquire modern exact inputs. */
function historicalGasSet(set: ConstantSet): void {
  const R = set.entries.find((entry) => entry.quantityId === "molarGasConstant");
  if (
    set.kind !== "printed-historical" ||
    set.gasConstantProvenance !== "measured-without-counting-molecules" ||
    R?.unit !== "J/(mol K)" ||
    R.evidentialRole !== "measured-observation" ||
    R.dependsOn.some((id) => /avogadro|boltzmann/i.test(id)) ||
    set.entries.some(
      (entry) =>
        entry.kind === "exact-defined" &&
        ["boltzmannConstant", "avogadroConstant", "molarGasConstant"].includes(entry.quantityId),
    )
  )
    throw new ConstantSetError(
      "modern-constant-in-historical-path",
      "This exercise needs a historical gas constant independent of exact N_A and k_B.",
    );
}

/**
 * Same hidden-number and latent stream allocation as BM-07. One step per independent
 * series selects the first coordinate of each logical quarter-second substep. The real
 * Brownian reference generates Gaussian displacements; no view implements a physical law.
 */
export function buildAvogadroBrownianData(
  seed: string = AVOGADRO_BROWNIAN_SETTINGS.seed,
  set: ConstantSet = getConstantSet(AVOGADRO_BROWNIAN_SET),
) {
  if (typeof seed !== "string")
    throw new StreamInputError("invalid-seed", "The seed must be a canonical decimal string.");
  parseU64(seed);
  historicalGasSet(set);
  return withHistoricalGuard(() => {
    const input = AVOGADRO_BROWNIAN_SETTINGS;
    const hiddenNumber = drawHiddenMolecularNumber(seed);
    const gasConstant = constantValue(set, "molarGasConstant").value;
    const generatorSet = createDeclaredConstantSet({
      id: "scenario-cross-journey-brownian-hidden-number",
      era: "synthetic exercise",
      provenance: `Historical R from ${set.id}, with a declared synthetic molecular number.`,
      precisionNote: "Seeded host Gaussian calculation; no strict WASM reproducibility is claimed.",
      gasConstantProvenance: "not-applicable",
      entries: [
        {
          quantityId: "molarGasConstant",
          value: gasConstant,
          exactDecimal: String(gasConstant),
          unit: "J/(mol K)",
          kind: "declared-scenario",
          evidentialRole: "declared-input",
          provenance: `Numerical input carried from ${set.id}; no modern exact gas constant is substituted.`,
          dependsOn: [],
        },
        {
          quantityId: "avogadroConstant",
          value: hiddenNumber,
          exactDecimal: String(hiddenNumber),
          unit: "1/mol",
          kind: "declared-scenario",
          provenance: `Synthetic hidden input drawn from BM-07's parameter stream at seed ${seed}; not a measured or historical molecular number.`,
          evidentialRole: "declared-input",
          dependsOn: [],
        },
      ],
    });
    const diffusion = referenceFromEvaluation(stokesEinsteinD(input, generatorSet).result, {
      constantSetId: generatorSet.id,
      owner: "diffusion.stokesEinsteinD",
      exerciseId: AVOGADRO_EXERCISE_ID,
    });
    const frames = requireAvogadroComputation(
      brownianFrames({
        nSeries: input.M,
        steps: 1,
        stepKernel: 3,
        seed,
        diffusion: diffusion.value,
        dt: input.dt,
        streamKernelId: INFERENCE_STREAMS.latent,
      }),
      "diffusion.brownianFrames",
    );
    const increments = Float64Array.from({ length: input.M }, (_, i) => frames[2 * i + 1] ?? NaN);
    requireAvogadroComputation(
      independentModelAdmission({
        equalSpacing: true,
        nonOverlapping: true,
        localizationStd: 0,
        exposureTime: 0,
        censored: false,
      }),
      "inference.independentModelAdmission",
    );
    const estimate = requireAvogadroComputation(
      estimateIncrements(increments, input.dt, input.d, "independent-increment-known-zero-drift"),
      "inference.estimateIncrements",
    );
    const diffusionInterval = requireAvogadroComputation(
      estimatorInterval(estimate, input.alpha),
      "inference.estimatorInterval",
    );
    const molecularNumber = requireAvogadroComputation(
      invertToMolecularNumber(
        {
          ...input,
          dHat: estimate.dHat,
          interval: diffusionInterval,
          radiusProvenance: "independently-declared",
          synthetic: true,
        },
        set,
      ),
      "inference.invertToMolecularNumber",
    );
    const family = requireAvogadroComputation(
      identifiabilityFamily(
        {
          D: estimate.dHat,
          T: input.T,
          eta: input.eta,
          radiusRange: [0.25e-6, 1e-6],
          synthetic: true,
        },
        set,
      ),
      "inference.identifiabilityFamily",
    );
    return Object.freeze({
      seed,
      constantSetId: set.id,
      generatorSet,
      hiddenNumber,
      generatorD: diffusion.value,
      increments: Object.freeze(Array.from(increments)),
      estimate,
      diffusionInterval,
      molecularNumber,
      family,
      chiSquareLower: requireAvogadroComputation(
        chiSquareQuantile(estimate.q, input.alpha / 2),
        "diffusion.chiSquareQuantile",
      ),
      chiSquareUpper: requireAvogadroComputation(
        chiSquareQuantile(estimate.q, 1 - input.alpha / 2),
        "diffusion.chiSquareQuantile",
      ),
    });
  });
}

export const AVOGADRO_BROWNIAN_DATA = buildAvogadroBrownianData();
const concise = (value: number) => Number(value.toPrecision(7)).toString();
const numberText = (value: number) => `${concise(value / 1e23)} × 10²³`;

export function avogadroRadiationPart(
  set: ConstantSet = getConstantSet(AVOGADRO_RADIATION_SET),
): NumericExercisePart {
  const id = "cross-journey-avogadro-radiation";
  const result = avogadroFromPlanckConstants(set);
  return Object.freeze({
    id,
    prompt:
      "Use N = (β/α) · 8πR/L³ with α = 6.10 × 10⁻⁵⁷, β = 4.866 × 10⁻¹¹, R = 8.31 × 10⁷ and L = 3 × 10¹⁰ in the stated CGS units. What molecular number does this give per mole?",
    workedExplanation:
      "Keeping the CGS units throughout gives N = (4.866 × 10⁻¹¹ / 6.10 × 10⁻⁵⁷) · 8π · 8.31 × 10⁷ / (3 × 10¹⁰)³, about 6.170486 × 10²³ per mole. Einstein printed 6.17 × 10²³. Here α uses the corrected witness exponent 10⁻⁵⁷; the facsimile prints 10⁻⁵⁶, which would give one tenth of this result. R and L are editorial inputs because their numerical values are not printed in §2.",
    family: "inverseAmount",
    units: ["1/mol"],
    reference: referenceFromEvaluation(
      { status: result.status, value: result.avogadroConstant, quantityId: "avogadroConstant" },
      { constantSetId: set.id, owner: "radiation.avogadroFromPlanckConstants", exerciseId: id },
    ),
    tolerance: { absolute: 0, relative: 0.001 },
    toleranceReason: "One part in a thousand accommodates rounding to the printed 6.17 × 10²³.",
    commonSlips: [
      {
        factor: 0.1,
        message:
          "This is the result of using the facsimile's uncorrected α exponent 10⁻⁵⁶. The stated exercise uses the corrected exponent 10⁻⁵⁷.",
      },
    ],
  });
}

export const AVOGADRO_RADIATION_PART = avogadroRadiationPart();

const conditionalInterval =
  "This 95% interval is conditional on the independently supplied radius, R, temperature and viscosity, exact timing and spatial calibration, known zero drift, and independent Gaussian increments. It describes variation in repeated synthetic samples; it does not include uncertainty in those supplied inputs.";

function brownianPart(endpoint: "estimate" | "lower" | "upper"): NumericExercisePart {
  const data = AVOGADRO_BROWNIAN_DATA;
  const id = `cross-journey-avogadro-brownian-${endpoint}`;
  const value =
    endpoint === "estimate"
      ? data.molecularNumber.estimate
      : data.molecularNumber.interval[endpoint];
  const prompt =
    endpoint === "estimate"
      ? "Use the synthetic displacements and the independently supplied radius to estimate N. First find D̂ = Σ(Δx)²/(2MΔt), then invert D = RT/(6πηaN). What is your estimate per mole?"
      : `Find the ${endpoint} endpoint of the conditional 95% interval for N, per mole. Inverting N = C/D reverses the endpoints: Nₗₒ = C/Dₕᵢ and Nₕᵢ = C/Dₗₒ, where C = RT/(6πηa).`;
  return Object.freeze({
    id,
    prompt,
    workedExplanation: `The independent-increment estimate is D̂ = ${concise(data.estimate.dHat)} m²/s. For q = ${data.estimate.q}, D lies between qD̂/χ²₀.₉₇₅ and qD̂/χ²₀.₀₂₅, giving [${concise(data.diffusionInterval.lower)}, ${concise(data.diffusionInterval.upper)}] m²/s. Invert the limits in reverse order to get N̂ = ${numberText(data.molecularNumber.estimate)} mol⁻¹ and the interval [${numberText(data.molecularNumber.interval.lower)}, ${numberText(data.molecularNumber.interval.upper)}] mol⁻¹. ${conditionalInterval}`,
    family: "inverseAmount",
    units: ["1/mol"],
    reference: referenceFromEvaluation(
      { status: "value", value, quantityId: "avogadroNumberEstimate" },
      {
        constantSetId: data.constantSetId,
        owner: "inference.invertToMolecularNumber",
        exerciseId: id,
      },
    ),
    tolerance: { absolute: 0, relative: 0.001 },
    toleranceReason:
      "One part in a thousand allows rounding the displayed displacements, summary and chi-square quantiles.",
  });
}

export const AVOGADRO_BROWNIAN_PARTS = Object.freeze([
  brownianPart("estimate"),
  brownianPart("lower"),
  brownianPart("upper"),
] as const);

export type AvogadroRadiusComparison = Readonly<{
  known: Readonly<{
    label: string;
    result: NumericReference;
    interval: Readonly<{ lower: number; upper: number; coverage: number }>;
    radius: number;
    paragraphs: readonly string[];
  }>;
  unknown: Readonly<{
    status: "underdetermined";
    reason: string;
    family: readonly Readonly<{ radius: number; molecularNumber: number }>[];
    product: number;
    constantSetId: string;
  }>;
}>;

/** Validate every displayed family coordinate through the shared finite numeric-reference guard. */
export function avogadroFamilySamples(
  family: Pick<typeof AVOGADRO_BROWNIAN_DATA.family, "radii" | "numbers" | "constantSetId">,
): AvogadroRadiusComparison["unknown"]["family"] {
  const context = {
    constantSetId: family.constantSetId,
    owner: "inference.identifiabilityFamily",
    exerciseId: AVOGADRO_EXERCISE_ID,
  };
  return [0, 10, 20, 30, 40].map((i) => ({
    radius: referenceFromEvaluation(
      { status: "value", value: family.radii[i], quantityId: "particleRadius" },
      context,
    ).value,
    molecularNumber: referenceFromEvaluation(
      { status: "value", value: family.numbers[i], quantityId: "avogadroNumberEstimate" },
      context,
    ).value,
  }));
}

export const AVOGADRO_RADIUS_COMPARISON: AvogadroRadiusComparison = Object.freeze({
  known: {
    label: "Radius supplied independently",
    result: AVOGADRO_BROWNIAN_PARTS[0].reference,
    interval: AVOGADRO_BROWNIAN_DATA.molecularNumber.interval,
    radius: AVOGADRO_BROWNIAN_SETTINGS.a,
    paragraphs: [conditionalInterval],
  },
  unknown: {
    status: "underdetermined",
    reason:
      "Without an independently supplied radius, these displacements constrain the product aN. They do not identify one N or a single interval for N. Doubling a halves the compatible N; the family continues beyond the illustrative radii shown here.",
    family: avogadroFamilySamples(AVOGADRO_BROWNIAN_DATA.family),
    product: AVOGADRO_BROWNIAN_DATA.family.product,
    constantSetId: AVOGADRO_BROWNIAN_SET,
  },
});

export type AvogadroContentAvailability = Readonly<{
  companionPresent: boolean;
  avogadroLabPresent: boolean;
}>;

export function buildAvogadroExercise(
  availability: AvogadroContentAvailability = {
    companionPresent: false,
    avogadroLabPresent: false,
  },
): ConnectionExercise {
  const data = AVOGADRO_BROWNIAN_DATA;
  const settings = AVOGADRO_BROWNIAN_SETTINGS;
  return {
    id: AVOGADRO_EXERCISE_ID,
    title: "Infer a molecular number by different routes",
    introduction: [
      "Radiation and suspended particles offer different ways to infer the number of molecules in a mole. Work through the radiation estimate and a synthetic Brownian example, then compare what each calculation needs from the world.",
      "Two determinations are ready here. The third determination, from the dissertation, is in preparation.",
    ],
    sections: [
      {
        id: "avogadro-radiation",
        title: "Route 1: radiation constants, paper 1 §2",
        paragraphs: [
          "All four numerical inputs use CGS: α in erg·s⁴/cm³, β in s·K, R in erg/(mol·K), and L in cm/s. L means the speed of light in this paper.",
          "The registered historical set records α as corrected from the printed exponent 10⁻⁵⁶ to 10⁻⁵⁷, with a facsimile provenance receipt. R = 8.31 × 10⁷ and L = 3 × 10¹⁰ are declared editorial inputs, not numerals printed in §2.",
        ],
        parts: [{ kind: "numeric", part: AVOGADRO_RADIATION_PART }],
        links: [
          {
            href: "/papers/light-quanta/s2/",
            label: "Read the molecular-number calculation in §2",
          },
        ],
      },
      {
        id: "avogadro-brownian",
        title: "Route 2: synthetic displacements, paper 2 §5",
        paragraphs: [
          `These are synthetic, independent Gaussian displacements in one coordinate, generated with canonical decimal seed ${data.seed}. There are ${settings.M} displacements, each spanning Δt = ${settings.dt} s, with known zero drift, no localization noise, no exposure blur and no censoring. The generator uses the Brownian inference lab's declared Philox streams and a seeded hidden molecular number. Its gas constant comes from the historical Brownian set; modern exact k_B and N_A enter neither the data nor the inference.`,
          `Supplied independently of the displacements: radius a = 0.5 μm, temperature T = ${settings.T} K, viscosity η = 1.35 × 10⁻³ Pa·s, and R = ${constantValue(getConstantSet(AVOGADRO_BROWNIAN_SET), "molarGasConstant").value} J/(mol·K). These are declared inputs for the synthetic exercise, not a historical measurement record.`,
          `Displacements in μm: ${data.increments.map((x) => concise(x * 1e6)).join(", ")}. Their sum of squares is ${concise(data.estimate.sumSquares)} m².`,
          `Use q = ${data.estimate.q} degrees of freedom, χ²₀.₀₂₅ = ${concise(data.chiSquareLower)} and χ²₀.₉₇₅ = ${concise(data.chiSquareUpper)}. The diffusion interval is [qD̂/χ²₀.₉₇₅, qD̂/χ²₀.₀₂₅].`,
          conditionalInterval,
          "Recovering a hidden number from generated data checks the inference machinery. Evidence about molecules would require observed displacements and independently justified physical inputs.",
        ],
        parts: AVOGADRO_BROWNIAN_PARTS.map((part) => ({ kind: "numeric" as const, part })),
        links: [
          {
            href: "/discover/brownian-motion/#step-07",
            label: "Return to Journey II's molecular-number inversion",
          },
        ],
      },
      {
        id: "avogadro-dissertation",
        title: "Route 3: the dissertation, in preparation",
        paragraphs: [
          availability.companionPresent
            ? "The companion record is present, but its historical input fixtures and verified constant sets are still needed before this exercise can reproduce the dissertation and its correction. The third determination remains in preparation."
            : "The third determination is in preparation. It will reproduce the dissertation and correction only when the companion reading and their verified historical input fixtures are available.",
        ],
        parts: [],
      },
      {
        id: "avogadro-comparison",
        title: "What would make these routes independent evidence?",
        paragraphs: [],
        parts: [
          {
            kind: "explanation",
            part: {
              id: "cross-journey-avogadro-compare-evidence",
              prompt:
                "Compare what each route needs to make an unseen molecular number measurable. What uncertainty belongs to each route, and what changes if the Brownian particle's radius is not independently known?",
              criteria: [
                "Radiation and Brownian motion constrain a microscopic quantity through different macroscopic observations and physical premises.",
                "The radiation route depends on the fitted radiation constants; the Brownian route depends on the measured spread and independently known radius.",
                "Without the radius, the Brownian inference identifies a compatible family of a and N rather than one N.",
                "The dissertation comparison also needs the coefficient of φ and the input data used by each printing; a coefficient change alone cannot explain a change of data.",
                "The modern exact Avogadro constant is a definition adopted in 2019, and a synthetic recovery supplies no new experimental evidence.",
              ],
              workedExplanation:
                "An unseen molecular number can become measurable through unrelated observations, but agreement matters only after examining how the inputs were obtained. Radiation supplies fitted constants; Brownian motion supplies a displacement distribution whose interpretation requires the particle radius and drag model. Removing the radius leaves aN = RT/(6πηD), so each positive radius has a compatible N. A radius inferred from those same displacements cannot serve as independent input. The dissertation route needs its own viscosity coefficient and historical solution data, which are still being prepared here. The modern N_A = 6.02214076 × 10²³ mol⁻¹ is exact by the SI definition adopted in 2019; it was not a prescribed target for the 1905 estimates. The synthetic sample demonstrates the calculation and its conditional interval, while evidence for molecules requires measurements.",
            },
          },
        ],
      },
    ],
    links: [
      {
        href: "/discover/light-quanta/#step-06",
        label: "Journey I: compare the two counting arguments",
      },
      {
        href: "/discover/light-quanta/#step-08",
        label: "Journey I: check the heuristic against the world",
      },
      {
        href: "/discover/brownian-motion/#step-07",
        label: "Journey II: infer the molecular number",
      },
      ...(availability.avogadroLabPresent
        ? [{ href: "/lab/avogadro-lab/", label: "Explore the molecular-number laboratory" }]
        : []),
    ],
  };
}

export const AVOGADRO_EXERCISE = buildAvogadroExercise();
