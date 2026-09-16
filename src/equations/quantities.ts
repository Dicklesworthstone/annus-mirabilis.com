/** Brownian explanatory slice, not a completed cross-paper notation concordance. */
export type Quantity = Readonly<{
  id: string;
  name: string;
  glyph: string;
  dimension: readonly string[];
  unit: string;
  displayUnit: string;
  displayPower: number;
  semanticKind: string;
  role: "result" | "input" | "constant";
  definition: string;
}>;
const q = (
  id: string,
  name: string,
  glyph: string,
  d: readonly string[],
  unit: string,
  displayUnit: string,
  displayPower: number,
  semanticKind: string,
  role: Quantity["role"],
  definition: string,
): Quantity =>
  Object.freeze({
    id,
    name,
    glyph,
    dimension: Object.freeze([...d]),
    unit,
    displayUnit,
    displayPower,
    semanticKind,
    role,
    definition,
  });
export const BROWNIAN_QUANTITIES: Readonly<Record<string, Quantity>> = Object.freeze(
  Object.fromEntries(
    [
      q(
        "diffusionCoefficient",
        "Diffusion coefficient",
        "D",
        ["2", "0", "-1", "0", "0", "0"],
        "m2/s",
        "μm²/s",
        12,
        "latent-diffusivity",
        "result",
        "The rate of growth of the model's coordinate mean square, divided by two. It is not a particle speed.",
      ),
      q(
        "rmsDisplacement1d",
        "Coordinate RMS displacement",
        "\\lambda_x",
        ["1", "0", "0", "0", "0", "0"],
        "m",
        "μm",
        6,
        "latent-coordinate-rms",
        "result",
        "The square root of the model's mean squared displacement along one coordinate. This is a model prediction, not the sample RMS.",
      ),
      q(
        "observationInterval",
        "Observation interval",
        "t",
        ["0", "0", "1", "0", "0", "0"],
        "s",
        "s",
        0,
        "observation-interval",
        "input",
        "The fixed interval over which displacement is observed. Changing it re-observes the same trial.",
      ),
      q(
        "temperature",
        "Absolute temperature",
        "T",
        ["0", "0", "0", "1", "0", "0"],
        "K",
        "K",
        0,
        "absolute-temperature",
        "input",
        "Temperature in kelvin. Viscosity is held as a separate input; changing T does not silently change viscosity.",
      ),
      q(
        "viscosity",
        "Dynamic viscosity",
        "\\eta",
        ["-1", "1", "-1", "0", "0", "0"],
        "Pa s",
        "mPa·s",
        3,
        "dynamic-viscosity",
        "input",
        "The Newtonian fluid's resistance to shear. Larger viscosity reduces diffusivity at fixed temperature and radius.",
      ),
      q(
        "particleRadius",
        "Particle radius",
        "a",
        ["1", "0", "0", "0", "0", "0"],
        "m",
        "μm",
        6,
        "sphere-radius",
        "input",
        "The radius, not the diameter, of the ideal spherical tracer.",
      ),
      q(
        "boltzmannConstant",
        "Boltzmann constant",
        "k_B",
        ["2", "1", "-2", "-1", "0", "0"],
        "J/K",
        "J/K",
        0,
        "boltzmann-constant",
        "constant",
        "The active modern SI 2019 value. This known constant is not independent evidence in an inference of molecular number.",
      ),
      q(
        "modelApparentSpeed",
        "Apparent coordinate speed",
        "v_{\\mathrm{app}}",
        ["1", "0", "-1", "0", "0", "0"],
        "m/s",
        "μm/s",
        6,
        "interval-dependent-apparent-speed",
        "result",
        "Coordinate RMS divided by the chosen interval. It depends on that interval and is not instantaneous physical velocity.",
      ),
    ].map((v) => [v.id, v]),
  ),
);
export type QuantityRegistry = Readonly<Record<string, Quantity>>;
