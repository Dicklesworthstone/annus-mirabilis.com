/** Bounded, versioned state for the three-method comparison. No notes enter URLs. */
import { powerOfTenText } from "../../units/scientific.ts";
import { ExperimentRuntimeError } from "../refusal.ts";
export const AVOGADRO_DEFAULTS = Object.freeze({
  alphaScale: 1,
  meanSquareUm2: 0.86,
  observationSeconds: 1,
  coordinateCount: 100,
  radiusUm: 0.5,
  radiusKnown: 1,
  independentModel: 1,
  temperature: 293.15,
  viscosityMpaS: 1,
  soluteDiffusionUm2S: 500,
  molarConcentration: 20,
  specificViscosity: 0.01,
  coefficient: 2.5,
});
export type AvogadroParameters = Readonly<{ [K in keyof typeof AVOGADRO_DEFAULTS]: number }>;
export type AvogadroKey = keyof AvogadroParameters;
export const AVOGADRO_FIELDS: Readonly<
  Record<
    AvogadroKey,
    Readonly<{
      label: string;
      min: number;
      max: number;
    }>
  >
> = Object.freeze({
  alphaScale: { label: "Radiation constant α / reference α", min: 0.1, max: 10 },
  meanSquareUm2: { label: "Mean-square displacement in one coordinate (µm²)", min: 1e-8, max: 1e6 },
  observationSeconds: { label: "Observation interval (s)", min: 1e-6, max: 1e6 },
  coordinateCount: { label: "Independent coordinate increments", min: 1, max: 10000 },
  radiusUm: { label: "Independently declared tracer radius (µm)", min: 0.001, max: 100 },
  radiusKnown: { label: "Independent radius supplied: 1 yes, 0 no", min: 0, max: 1 },
  independentModel: {
    label: "Independent, error-free increments admitted: 1 yes, 0 no",
    min: 0,
    max: 1,
  },
  temperature: { label: "Shared temperature (K)", min: 1, max: 1000 },
  viscosityMpaS: { label: "Shared solvent viscosity (mPa s)", min: 0.001, max: 1000 },
  soluteDiffusionUm2S: { label: "Solute diffusivity (µm²/s)", min: 1e-6, max: 1e6 },
  molarConcentration: {
    label: "Solute molar concentration (mol/m³ of solution)",
    min: 0,
    max: 10000,
  },
  specificViscosity: { label: "Specific viscosity: solution / solvent − 1", min: 0, max: 1 },
  coefficient: { label: "Viscosity coefficient: 1 original, 2.5 corrected", min: 1, max: 2.5 },
});
export type Validation =
  | Readonly<{ kind: "accepted"; parameters: AvogadroParameters }>
  | Readonly<{ kind: "refused"; reason: string }>;
const refused = (reason: string): Validation => Object.freeze({ kind: "refused", reason });
const keys = Object.keys(AVOGADRO_FIELDS) as AvogadroKey[];

export function validateAvogadroParameters(input: unknown): Validation {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return refused("Settings must be a parameter record.");
  const record = input as Record<string, unknown>;
  if (
    Object.keys(record).length !== keys.length ||
    Object.keys(record).some((key) => !Object.hasOwn(AVOGADRO_FIELDS, key))
  ) {
    return refused("Settings must contain exactly the supported parameters.");
  }
  const parameters = {} as Record<AvogadroKey, number>;
  for (const key of keys) {
    const n = record[key];
    const field = AVOGADRO_FIELDS[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < field.min || n > field.max)
      return refused(
        `${field.label}: enter a number from ${powerOfTenText(field.min)} to ${powerOfTenText(field.max)}. No value was clamped.`,
      );
    parameters[key] = n;
  }
  if (!Number.isSafeInteger(parameters.coordinateCount))
    return refused("The independent coordinate count must be an integer.");
  if (![0, 1].includes(parameters.radiusKnown) || ![0, 1].includes(parameters.independentModel))
    return refused("Choose yes or no for the radius and observation assumptions.");
  if (![1, 2.5].includes(parameters.coefficient))
    return refused("Choose the original coefficient 1 or the corrected coefficient 2.5.");
  return Object.freeze({ kind: "accepted", parameters: Object.freeze(parameters) });
}

const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
export function parseAvogadroDraft(draft: Readonly<Record<AvogadroKey, string>>): Validation {
  const parameters: Record<string, number> = {};
  for (const key of keys) {
    const text = draft[key]?.trim();
    if (!text || text.length > 64 || !decimal.test(text))
      return refused(
        `${AVOGADRO_FIELDS[key].label}: enter a decimal number, not an empty field or expression.`,
      );
    parameters[key] = Number(text);
  }
  return validateAvogadroParameters(parameters);
}

export function encodeAvogadroParameters(input: AvogadroParameters): string {
  const checked = validateAvogadroParameters(input);
  if (checked.kind !== "accepted")
    throw new ExperimentRuntimeError("parameters-rejected", checked.reason, "avogadro");
  const params = new URLSearchParams({ av: "1" });
  for (const key of keys) params.set(key, String(checked.parameters[key]));
  return params.toString();
}

export function decodeAvogadroParameters(search: string): Validation {
  if (search.length > 4096) return refused("The comparison bookmark exceeds its size limit.");
  const query = new URLSearchParams(search);
  // A URL with no experiment fields may still carry theme or reader controls.
  if (!query.has("av") && !keys.some((key) => query.has(key)))
    return validateAvogadroParameters(AVOGADRO_DEFAULTS);
  if (query.getAll("av").length !== 1 || query.get("av") !== "1")
    return refused("This comparison bookmark has an unsupported or ambiguous version.");
  const draft = {} as Record<AvogadroKey, string>;
  for (const key of keys) {
    if (query.getAll(key).length !== 1)
      return refused("A comparison bookmark must contain each parameter exactly once.");
    draft[key] = query.get(key) ?? "";
  }
  return parseAvogadroDraft(draft);
}

/**
 * The lab's four readings (R0 to R3), checked against the light paper's §2, the Brownian paper's §5
 * and the owners' outputs at AVOGADRO_DEFAULTS (evaluateAvogadro): radiation 6.1705 × 10^{23},
 * Brownian 6.0143 × 10^{23}, joint viscosity-diffusion 6.0188 × 10^{23} with a = 4.297 × 10^{−10} m,
 * aN = 2.586 × 10^{14} m/mol and φ = 0.004; defined 6.0221 × 10^{23}. The readings-owners record
 * am-disc-avogadro-lab-pfi7.yaml carries the same text.
 */
export const AVOGADRO_CAPTION = Object.freeze({
  r0: "Three different pieces of physics each lead to the number of molecules in a mole: the light of hot bodies, the wandering of small spheres, and the way a dissolved substance thickens water. Each needs different things measured first, and historically their agreement helped convince physicists that molecules are real and can be counted.",
  r1: "Three routes are laid side by side, each computed by its own owner. From radiation, Section 2 of the light paper matches Planck's formula to the classical law at long wavelengths and gets N = (β/α)(8πR/L^{3}) = 6.17 × 10^{23} from Planck's constants. From Brownian motion, Section 5 of the Brownian paper inverts λ_{x}^{2} = 2Dt: a mean square of 0.86 μm^{2} in 1 s, for spheres of 0.5 μm in water at 293.15 K, gives N = 6.01 × 10^{23}, and only once the radius is known independently. From the dissertation, a dissolved substance's diffusivity fixes the product of its molecules' radius and N, and the extra viscosity of the solution fixes the volume the molecules fill; with a diffusivity of 500 μm^{2}/s, 20 mol/m^{3} and a viscosity 1 percent above the solvent's, the two give a radius of 0.43 nm and N = 6.02 × 10^{23}. The defined value today is 6.022 × 10^{23}. The settings are illustrative, chosen near modern values, so their agreement here shows how the routes work rather than making a new measurement.",
  r2: "Radiation first. At long wavelengths Planck's formula becomes (α/β)ν^{2}T, and the classical law of Section 1 is (R/N)(8πν^{2}/L^{3})T; equating the coefficients gives N = (β/α)(8πR/L^{3}), and with Planck's α and β, R = 8.31 × 10^{7} erg/(mol K) and L = 3 × 10^{10} cm/s this is 6.17 × 10^{23}. Brownian motion next. λ_{x}^{2} = 2Dt and D = RT/(6πηaN) together give N = RTt/(3πηaλ_{x}^{2}). With RT = 8.314 × 293.15 = 2437 J/mol, t = 1 s, η = 0.001 Pa s, a = 0.5 × 10^{−6} m and λ_{x}^{2} = 0.86 × 10^{−12} m^{2}, the denominator is 3 × 3.1416 × 0.001 × 0.5 × 10^{−6} × 0.86 × 10^{−12} = 4.053 × 10^{−21}, so N = 2437/(4.053 × 10^{−21}) = 6.01 × 10^{23}. Last the dissertation. For solute molecules of radius a, D = RT/(6πηaN) gives aN = RT/(6πηD) = 2437/(6 × 3.1416 × 0.001 × 5 × 10^{−10}) = 2.59 × 10^{14} m/mol. The viscosity law says spheres filling a fraction φ of the volume raise the viscosity by 2.5φ, the coefficient as corrected in 1911, so a specific viscosity of 0.01 means φ = 0.004. The fraction filled is also the concentration times N times each molecule's volume, φ = cN(4/3)πa^{3}. Divide it by aN: a^{2} = φ/((4/3)πc × aN) = 0.004/(4.189 × 20 × 2.59 × 10^{14}) = 1.85 × 10^{−19} m^{2}, so a = 4.30 × 10^{−10} m and N = 2.59 × 10^{14}/(4.30 × 10^{−10}) = 6.02 × 10^{23}.",
  r3: "Einstein's dissertation, dated 30 April 1905 and printed in 1906, applied the third route to sugar in water and found N = 2.1 × 10^{23}. In 1911, after Bancelin had measured suspensions in Perrin's laboratory, Einstein found an error in his calculation of the viscosity: the coefficient of φ is 5/2, not 1, and the corrected N is 6.56 × 10^{23}. Perrin's book Les Atomes of 1913 set thirteen independent determinations side by side, and their agreement did much to settle the reality of molecules. Since 2019 N_{A} = 6.022 140 76 × 10^{23} mol^{−1} by definition.",
});
