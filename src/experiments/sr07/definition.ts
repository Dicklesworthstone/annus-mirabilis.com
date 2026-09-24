import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Sr07EquationId =
  | "ampere-x"
  | "ampere-y"
  | "ampere-z"
  | "faraday-x"
  | "faraday-y"
  | "faraday-z";
export type Sr07UnitLayer = "printed-gaussian" | "modern-si";
export type Sr07Wave = "plus-x" | "minus-x" | "plus-y" | "oblique";
export type Sr07Polarization = "primary" | "secondary";

export type Sr07Parameters = Readonly<{
  equationId: Sr07EquationId;
  stepIndex: number;
  unitLayer: Sr07UnitLayer;
  boostBeta: number;
  wave: Sr07Wave;
  polarization: Sr07Polarization;
}>;

export const SR07_DEFAULTS: Sr07Parameters = Object.freeze({
  equationId: "ampere-x",
  stepIndex: 0,
  unitLayer: "printed-gaussian",
  boostBeta: 0.6,
  wave: "plus-x",
  polarization: "primary",
});

export const SR07_CLASSES: Readonly<Record<keyof Sr07Parameters, ParameterClass>> = Object.freeze({
  equationId: "presentation",
  stepIndex: "presentation",
  unitLayer: "presentation",
  boostBeta: "observer",
  wave: "input",
  polarization: "input",
});

export const SR07_QUESTION =
  "How do the Maxwell-Hertz equations keep their form under the transformation, and what must the electric and magnetic fields do?";

export const SR07_MODEL = Object.freeze({
  id: "sr07-host-v1",
  ownerKind: "host-reference" as const,
  label: "Static worked example (algebra) and ideal model, host calculation (residuals)",
});

export const SR07_NOT_MODELED = Object.freeze([
  "sources and currents (the charge-and-current laboratory)",
  "media",
  "boundary conditions",
  "radiation reaction",
  "field configurations other than the admitted analytic validation waves",
]);

/** The instrument's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-sr-07-field-equations-xxes.yaml, which the readings audit reads. */
export const SR07_CAPTION = Object.freeze({
  r0: "Carry Maxwell's equations for empty space into a moving frame and they keep exactly the same form, provided the electric and magnetic fields are allowed to change together. That requirement is what fixes how the fields transform.",
  r1: "§6 takes the Maxwell–Hertz equations for empty space in the stationary system K, six equations linking the rates of change of the electric force (X, Y, Z) and the magnetic force (L, M, N); in paper 3, X, Y, Z are electric components and L, M, N are magnetic components. It rewrites them in the coordinates and time of the moving system k by the transformation of §3, which turns each derivative into a combination of derivatives in ξ, η, ζ and τ, and finds the same form again if β(Y − (v/V)N), β(Z + (v/V)M), β(M + (v/V)Z) and β(N − (v/V)Y) are read as the new components. The principle of relativity demands that the equations hold in k for the forces measured there, so the two forms must agree, which fixes the transformed fields up to a common factor ψ(v); the inverse transformation and symmetry make ψ = 1. Einstein's β is the modern γ. The lab steps through one equation at a time and checks the result on a plane wave: at 0.6c, for light moving along the boost, the amplitude and the frequency both fall to 0.5, and all six transformed equations hold at twenty seeded events, every residual 0 against a relative tolerance of 10^{−12}.",
  r2: "Take one of the six, the x component of the Ampère–Maxwell law as printed: (1/V) ∂X/∂t = ∂N/∂y − ∂M/∂z. The transformation of §3 gives τ = β(t − vx/V²), ξ = β(x − vt), η = y and ζ = z. By the chain rule, a derivative with respect to t in K becomes β(∂/∂τ − v ∂/∂ξ), a derivative with respect to x becomes β(∂/∂ξ − (v/V²) ∂/∂τ), and derivatives with respect to y and z are unchanged. Substitute these into all six equations and collect terms. The x equation becomes (1/V) ∂X/∂τ = ∂[β(N − (v/V)Y)]/∂η − ∂[β(M + (v/V)Z)]/∂ζ, which has the shape of the original if the bracketed combinations are called N′ and M′ and X is called X′. The other five equations work out the same way, with X′ = X, L′ = L and the four mixed combinations. In the printed Gaussian units electric and magnetic forces have the same dimension, so Y − (v/V)N makes sense as it stands; in SI the same combination is E_{y} − vB_{z}, and the lab labels that conversion rather than making it silently. For a plane wave moving along x, N = Y, so at 0.6c the combination gives Y′ = β(Y − (v/V)N) = 1.25 × (1 − 0.6) Y = 0.5 Y: the amplitude halves, and the frequency halves with it, which is §7's Doppler factor. The lab then evaluates the six transformed equations at twenty events drawn from a fixed seed, taking the derivatives in closed form rather than by finite differences, and reports the largest residual, here 0. A boost at or beyond the speed of light is refused, because β is not defined there.",
  r3: "The derivation is §6's, pp. 907–909, and it assumes the Maxwell–Hertz equations for empty space, not a theory of matter. It shows that the equations keep their form; that the transformed quantities are the forces a charge at rest in k would feel is a further step, which §6 takes by defining the fields in k through their ponderomotive effects there, and form invariance of the equations does not by itself prove that identification. Lorentz had given the transformation of the free-space fields in 1904 for his corresponding states, and Poincaré completed the transformation of charge and current in 1905 and 1906. L and N here are magnetic components, not the speed of light of paper 1 or the emitted energy of paper 4, and N is not Avogadro's number.",
});

export const SR07_EQUATIONS: Readonly<
  Record<Sr07EquationId, Readonly<{ printed: string; si: string; spoken: string }>>
> = Object.freeze({
  "ampere-x": Object.freeze({
    printed: "(1/V) ∂X/∂t = ∂N/∂y − ∂M/∂z",
    si: "(1/c²) ∂E_x/∂t = ∂B_z/∂y − ∂B_y/∂z",
    spoken: "Ampere-Maxwell, x component. Printed Gaussian. X is electric; M and N are magnetic.",
  }),
  "ampere-y": Object.freeze({
    printed: "(1/V) ∂Y/∂t = ∂L/∂z − ∂N/∂x",
    si: "(1/c²) ∂E_y/∂t = ∂B_x/∂z − ∂B_z/∂x",
    spoken: "Ampere-Maxwell, y component. L and N are magnetic-field components.",
  }),
  "ampere-z": Object.freeze({
    printed: "(1/V) ∂Z/∂t = ∂M/∂x − ∂L/∂y",
    si: "(1/c²) ∂E_z/∂t = ∂B_y/∂x − ∂B_x/∂y",
    spoken: "Ampere-Maxwell, z component.",
  }),
  "faraday-x": Object.freeze({
    printed: "(1/V) ∂L/∂t = ∂Y/∂z − ∂Z/∂y",
    si: "−∂B_x/∂t = ∂E_z/∂y − ∂E_y/∂z",
    spoken: "Faraday, x component. L is a magnetic component, not the speed of light.",
  }),
  "faraday-y": Object.freeze({
    printed: "(1/V) ∂M/∂t = ∂Z/∂x − ∂X/∂z",
    si: "−∂B_y/∂t = ∂E_x/∂z − ∂E_z/∂x",
    spoken: "Faraday, y component.",
  }),
  "faraday-z": Object.freeze({
    printed: "(1/V) ∂N/∂t = ∂X/∂y − ∂Y/∂x",
    si: "−∂B_z/∂t = ∂E_y/∂x − ∂E_x/∂y",
    spoken: "Faraday, z component. N is a magnetic component, not Avogadro's number.",
  }),
});

export const SR07_STEPS = Object.freeze([
  "Chain-rule operators from the §3 map: ∂/∂t and ∂/∂x mix τ and ξ with Einstein's β (modern γ).",
  "Substitute those operators into the selected equation. The changed subexpression is the one that mixed.",
  "Combine equation pairs to isolate ∂/∂τ terms.",
  "Group into X, β(Y − (v/V) N), β(Z + (v/V) M), L, β(M + (v/V) Z), β(N − (v/V) Y).",
  "The move: those combinations are the transformed fields up to a common factor ψ(v). The inverse requires ψ(v)ψ(−v) = 1; symmetry gives ψ = 1.",
  "Caveat: form invariance of the equations does not by itself prove every physical identification. The later layer uses more structure and is labeled as later.",
]);

const contract = (
  unit: string,
  semanticKind: string,
  statuses: OutputContract["statuses"] = ["value", "outside-domain", "not-applicable", "symbolic"],
): OutputContract =>
  Object.freeze({
    unit,
    semanticKind,
    ownerId: "fields",
    statuses: Object.freeze([...statuses]),
  });

export const SR07_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  residualMax: contract("1", "plane-wave-maxwell-residual"),
  residualFaradayX: contract("1", "plane-wave-maxwell-residual"),
  residualFaradayY: contract("1", "plane-wave-maxwell-residual"),
  residualFaradayZ: contract("1", "plane-wave-maxwell-residual"),
  residualAmpereX: contract("1", "plane-wave-maxwell-residual"),
  residualAmpereY: contract("1", "plane-wave-maxwell-residual"),
  residualAmpereZ: contract("1", "plane-wave-maxwell-residual"),
  amplitudeFactor: contract("1", "transformed-amplitude-factor"),
  frequencyFactor: contract("1", "transformed-frequency-factor"),
  lorentzFactor: contract("1", "lorentz-factor"),
  formInvariant: contract("1", "form-invariance-flag"),
  stepIndexOut: contract("1", "derivation-step-index"),
});

export const SR07_COMPONENTS = Object.freeze([
  Object.freeze({ printed: "X", role: "electric x in K", si: "E_x" }),
  Object.freeze({ printed: "Y", role: "electric y in K", si: "E_y" }),
  Object.freeze({ printed: "Z", role: "electric z in K", si: "E_z" }),
  Object.freeze({ printed: "L", role: "magnetic x in K (not the speed of light)", si: "B_x" }),
  Object.freeze({ printed: "M", role: "magnetic y in K", si: "B_y" }),
  Object.freeze({ printed: "N", role: "magnetic z in K (not Avogadro's number)", si: "B_z" }),
]);

export const SR07_PRESETS = Object.freeze([
  {
    presetId: "sr-07-plane-wave-0.6c",
    label: "Plane wave along +x at 0.6c",
    parameterValues: Object.freeze({
      boostBeta: 0.6,
      wave: "plus-x" as const,
      polarization: "primary" as const,
    }),
  },
  {
    presetId: "sr-07-oblique-wave-0.6c",
    label: "Oblique wave at 0.6c",
    parameterValues: Object.freeze({
      boostBeta: 0.6,
      wave: "oblique" as const,
      polarization: "primary" as const,
    }),
  },
  {
    presetId: "sr-07-equation-1-grouping",
    label: "First equation, grouping step",
    parameterValues: Object.freeze({
      equationId: "ampere-x" as const,
      stepIndex: 3,
    }),
  },
]);
