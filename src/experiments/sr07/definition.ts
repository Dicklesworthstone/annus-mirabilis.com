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
  "sources and currents (SR-12)",
  "media",
  "boundary conditions",
  "radiation reaction",
  "field configurations other than the admitted analytic validation waves",
]);

export const SR07_CAPTION = Object.freeze({
  r0: "Carry Maxwell's equations into the moving frame. They keep the same form, provided the electric and magnetic fields transform together.",
  r1: "Section 6 substitutes the chain-rule operators from the §3 map, groups terms, and identifies the combinations that play the role of the transformed fields. In paper 3, X, Y, Z are electric components and L, M, N are magnetic components. Einstein's β is the modern γ. The algebra is a static worked chain; the residuals are a live host calculation on an admitted plane wave.",
  r2: "Select one of the six Maxwell-Hertz equations and step it. The printed layer is Gaussian, as in the 1905 paper. The modern layer is SI; the conversion is labeled, never silent. Validation uses closed-form derivatives, not finite differences. |v| ≥ c is refused.",
  r3: "Form invariance of the homogeneous equations does not by itself prove every physical identification of the fields. The later layer says so and stops. L and N here are magnetic components, not the speed of light and not Avogadro's number.",
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
