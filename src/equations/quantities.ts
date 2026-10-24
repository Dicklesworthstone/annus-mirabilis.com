/**
 * THE EQUATION ROLE VOCABULARY, and the single source of the class names built from it.
 *
 * Three roles, not seven. A term is an `input` the reader sets, a `result` the model computes, or
 * a `constant` the active constant set supplies, so this says where a number in an equation COMES
 * FROM. It is the vocabulary the renderer emits (`wrapHtmlClass` in latex/markers.ts, from this
 * `role` field), the KaTeX trust callback admits (render.ts), the stylesheet colours
 * (equations.css) and the kernel trace marks (content/kernel/trace.ts).
 *
 * IT IS NOT `COLOR_ROLES` (content/schemas/meanings.ts): energy, time-rate, space-geometry,
 * material, statistical, field, quanta, which say what a quantity MEANS. The two vocabularies are
 * disjoint -- no name in either appears in the other -- and `src/design/semanticColor/classNames.ts`
 * records that at length, because its own docblock asserted for weeks that its seven were "the
 * only seven classes the KaTeX trust callback admits".
 *
 * Four sites spelled these three strings independently before this constant existed, one of them
 * a trust callback. WIDENING THIS SET WIDENS WHAT A SOURCE RECORD CAN PUT IN A CLASS ATTRIBUTE
 * THROUGH MATHEMATICS, so adding a role is a security change, not a styling one.
 */
export const EQUATION_ROLES = ["input", "result", "constant"] as const;
export type EquationRole = (typeof EQUATION_ROLES)[number];

export function equationRoleClassName(role: EquationRole): string {
  return `am-role-${role}`;
}

export const EQUATION_ROLE_CLASS_NAMES: readonly string[] = Object.freeze(
  EQUATION_ROLES.map(equationRoleClassName),
);

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
  role: EquationRole;
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
      q(
        "probabilityDensity",
        "Probability density",
        "p",
        ["-1", "0", "0", "0", "0", "0"],
        "1/m",
        "1/μm",
        -6,
        "probability-density",
        "result",
        "Probability per metre of finding the particle at x after time t: a density, not a probability. Its area over an interval is a probability.",
      ),
      q(
        "positionCoordinate1d",
        "Position",
        "x",
        ["1", "0", "0", "0", "0", "0"],
        "m",
        "μm",
        6,
        "coordinate-position",
        "input",
        "The coordinate along which the particles spread, in the diffusion equation.",
      ),
      q(
        "fieldTimeCoordinate",
        "Time",
        "t",
        ["0", "0", "1", "0", "0", "0"],
        "s",
        "s",
        0,
        "clock-reading",
        "input",
        "The time at which the density is read. Every particle is at x = 0 when it reads zero.",
      ),
      q(
        "displacement1d",
        "Displacement since the start",
        "x",
        ["1", "0", "0", "0", "0", "0"],
        "m",
        "μm",
        6,
        "cumulative-displacement",
        "input",
        "How far one particle has moved along x since observation began. Its mean is zero; its mean square is not.",
      ),
      q(
        "stepInterval",
        "Step interval",
        "\\tau",
        ["0", "0", "1", "0", "0", "0"],
        "s",
        "s",
        0,
        "walk-step-interval",
        "input",
        "The short time between successive independent steps of the walk. Paper 2 writes tau for it.",
      ),
      q(
        "stepRms",
        "Step length",
        "l",
        ["1", "0", "0", "0", "0", "0"],
        "m",
        "μm",
        6,
        "walk-step-rms",
        "input",
        "The root mean square length of one step of the walk.",
      ),
      q(
        "walkStepCount",
        "Number of steps",
        "n",
        ["0", "0", "0", "0", "0", "0"],
        "1",
        "1",
        0,
        "walk-step-count",
        "input",
        "How many independent steps fit in the observation interval: t divided by tau.",
      ),
      q(
        "molarGasConstant",
        "Gas constant",
        "R",
        ["2", "1", "-2", "-1", "0", "-1"],
        "J/(mol K)",
        "J/(mol K)",
        0,
        "molar-gas-constant",
        "constant",
        "Energy per mole per kelvin. R divided by N is the gas constant for one molecule, which modern notation writes k_B.",
      ),
      q(
        "avogadroConstant",
        "Avogadro's number",
        "N",
        ["0", "0", "0", "0", "0", "-1"],
        "1/mol",
        "1/mol",
        0,
        "avogadro-constant",
        "constant",
        "Molecules per mole, the number paper 2 sets out to measure; as printed here it is an input to the diffusivity.",
      ),
      q(
        "avogadroNumberEstimate",
        "Estimated Avogadro number",
        "N",
        ["0", "0", "0", "0", "0", "-1"],
        "1/mol",
        "1/mol",
        0,
        "avogadro-estimate",
        "result",
        "The number of molecules per mole a measurement of spreading infers. An estimate with an uncertainty, not the defined constant.",
      ),
      q(
        "genericNumberA",
        "Any number",
        "A",
        ["0", "0", "0", "0", "0", "0"],
        "1",
        "1",
        0,
        "generic-number",
        "input",
        "A stands for any number in an algebraic identity.",
      ),
      q(
        "genericNumberB",
        "Any other number",
        "B",
        ["0", "0", "0", "0", "0", "0"],
        "1",
        "1",
        0,
        "generic-number",
        "input",
        "B stands for any number in an algebraic identity.",
      ),
      q(
        "displacementIncrement",
        "Displacement in one interval",
        "\\Delta",
        ["1", "0", "0", "0", "0", "0"],
        "m",
        "μm",
        6,
        "displacement-increment",
        "input",
        "How far one particle moves along x in one short interval tau. Paper 2 writes Delta for it; it can be of either sign.",
      ),
      q(
        "transitionKernel",
        "Jump density",
        "\\varphi",
        ["-1", "0", "0", "0", "0", "0"],
        "1/m",
        "1/μm",
        -6,
        "transition-kernel",
        "input",
        "Paper 2's phi(Delta): the probability per metre that a particle moves by Delta in one interval tau. A density, not a probability; its area over every Delta is one.",
      ),
      q(
        "scaledDisplacement",
        "Scaled displacement",
        "u",
        ["0", "0", "0", "0", "0", "0"],
        "1",
        "1",
        0,
        "scaled-displacement",
        "input",
        "The displacement divided by the square root of 4Dt: the Gaussian written as a pure number, so its moment integral has no units.",
      ),
    ].map((v) => [v.id, v]),
  ),
);
export type QuantityRegistry = Readonly<Record<string, Quantity>>;
