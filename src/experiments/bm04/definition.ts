import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

/** BM-04's executable host-reference parameters. */
export type Bm04Parameters = Readonly<{
  F: number;
  m: number;
  T: number;
  eta: number;
  a: number;
  W: number;
  cells: number;
  dt: number;
  steps: number;
  profile: "uniform" | "step" | "equilibrium" | "spike";
}>;

export const BM04_DEFAULTS: Bm04Parameters = Object.freeze({
  F: 4.047373e-15, // 4.047373 fN = k_B * T / (1 μm) at 293.15 K
  m: 1.0, // Einstein relation
  T: 293.15, // 20 °C
  eta: 0.001002, // water viscosity at 20 °C in Pa·s
  a: 0.5e-6, // 0.5 μm radius
  W: 1e-5, // 10 μm box width
  cells: 100,
  dt: 0.005, // 5 ms
  steps: 200,
  profile: "uniform",
});

export const BM04_PARAMETER_CLASSES: Readonly<Record<keyof Bm04Parameters, ParameterClass>> =
  Object.freeze({
    F: "input",
    m: "input",
    T: "input",
    eta: "input",
    a: "input",
    W: "input",
    cells: "input",
    dt: "input",
    steps: "input",
    profile: "input",
  });
export const BM04_CLASSES = BM04_PARAMETER_CLASSES;

export const BM04_BUDGET = Object.freeze({ workUnits: 4_000_000, allocationBytes: 16_000_000 });

export const BM04_MODEL = Object.freeze({
  id: "bm04-drift-diffusion-v1",
  constantSetId: "modern-si-2019",
  ownerKind: "host-reference",
  label: "Drift-diffusion flux balance, host calculation",
  source: "src/workers/operations/bm04.ts",
  assumptions: Object.freeze([
    "Dilute spherical particles in a Newtonian fluid at low Reynolds number.",
    "Dynamic steady-state balance between directional drift and Brownian diffusion.",
    "Zero-flux reflecting boundary conditions at domain walls.",
    "These are consequences of a model, not empirical claims.",
  ]),
});

function contract(
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract {
  return Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });
}

/**
 * The index signature is load-bearing and so is the declared key, for different consumers.
 *
 * `BM04_OUTPUTS[quantityId]` is indexed with an UNTRUSTED runtime id at
 * workers/operations/bm04.ts:39 and again in workers/protocol/bm04.ts, so the string index
 * signature stays: it is a trust boundary, not looseness to be tidied away.
 *
 * `pecletNumber` is also read by LITERAL key in bm04/diagnostics.ts. Under
 * noUncheckedIndexedAccess a literal read on a bare Record is `OutputContract | undefined`, which
 * forced a runtime guard at that call site refusing "missing-output-contract" - a refusal no
 * caller could ever fire, because only editing this object can remove the key. Declaring the key
 * here moves that guarantee from a runtime check nothing can reach to one the type checker
 * enforces on this file. Delete the key from this type and the literal read stops compiling,
 * which is the check the runtime guard was standing in for.
 */
export const BM04_OUTPUTS: Readonly<Record<string, OutputContract>> & {
  readonly pecletNumber: OutputContract;
} = Object.freeze({
  densityProfile: contract("1/m", "coordinate-density", "diffusion.driftDiffusionFrames1d", [
    "value",
    "outside-domain",
  ]),
  osmoticProfile: contract("1/m", "coordinate-density", "diffusion.osmoticEquilibriumProfile", [
    "value",
    "outside-domain",
  ]),
  diffusionCoefficient: contract("m2/s", "latent-diffusivity", "diffusion.equilibriumBalance", [
    "value",
    "symbolic",
    "outside-domain",
  ]),
  kickDiffusivity: contract("m2/s", "kick-diffusivity", "diffusion.equilibriumBalance", [
    "value",
    "not-applicable",
    "outside-domain",
  ]),
  mobility: contract("kg-1 s", "stokes-mobility", "diffusion.stokesMobility", [
    "value",
    "outside-domain",
  ]),
  driftVelocity: contract("m/s", "force-drift", "diffusion.driftVelocity", [
    "value",
    "outside-domain",
  ]),
  particleReynoldsNumber: contract("1", "reynolds-number", "diffusion.driftVelocity", [
    "value",
    "outside-domain",
  ]),
  kickModel: contract("1", "model-classification", "bm04.evaluate", ["value"]),
  osmoticDecayLength: contract("m", "osmotic-force-length", "diffusion.decayLengths", [
    "value",
    "not-applicable",
    "outside-domain",
  ]),
  kineticDecayLength: contract("m", "kick-kinetic-length", "diffusion.decayLengths", [
    "value",
    "not-applicable",
    "outside-domain",
  ]),
  driftFlux: contract("m-2 s-1", "advective-particle-flux", "diffusion.driftDiffusionFlux", [
    "value",
    "outside-domain",
  ]),
  diffusionFlux: contract("m-2 s-1", "diffusive-particle-flux", "diffusion.driftDiffusionFlux", [
    "value",
    "outside-domain",
  ]),
  totalFlux: contract("m-2 s-1", "total-particle-flux", "diffusion.driftDiffusionFlux", [
    "value",
    "outside-domain",
  ]),
  steadyState: contract("1", "steady-state-indicator", "bm04.evaluate", [
    "value",
    "not-applicable",
  ]),
  pecletNumber: contract("1", "grid-peclet-number", "diffusion.driftDiffusionFrames1d", [
    "value",
    "not-applicable",
    "outside-domain",
  ]),
  stabilityRatio: contract("1", "explicit-positivity-number", "diffusion.driftDiffusionFrames1d", [
    "value",
  ]),
});

export const BM04_PRESETS = Object.freeze({
  "einstein-balance": Object.freeze({
    id: "bm-04-einstein-balance",
    label: "Einstein equilibrium balance (m = 1, F = 4.047 fN)",
    parameters: BM04_DEFAULTS,
  }),
  "naegeli-kicks-off": Object.freeze({
    id: "bm-04-naegeli-kicks-off",
    label: "Nägeli kicks-off branch (m = 0, F = 4.047 fN)",
    parameters: Object.freeze({ ...BM04_DEFAULTS, m: 0, dt: 0.0001 }),
  }),
  "naegeli-zero-force": Object.freeze({
    id: "bm-04-naegeli-zero-force",
    label: "Nägeli frozen step (m = 0, F = 0)",
    parameters: Object.freeze({ ...BM04_DEFAULTS, m: 0, F: 0, profile: "step" as const }),
  }),
  "mismatched-kicks": Object.freeze({
    id: "bm-04-mismatched-kicks",
    label: "Mismatched kinetic kicks (m = 2, F = 4.047 fN)",
    parameters: Object.freeze({ ...BM04_DEFAULTS, m: 2 }),
  }),
  "zero-force-relaxation": Object.freeze({
    id: "bm-04-zero-force-relaxation",
    label: "Pure diffusion relaxation (m = 1, F = 0)",
    parameters: Object.freeze({ ...BM04_DEFAULTS, F: 0, profile: "step" as const }),
  }),
});

export const BM04_PROMPT = Object.freeze({
  id: "bm-04-predict-force-dependence",
  question:
    "If you double the external force pulling on the particles, does the steady-state diffusion coefficient D double, halve, or stay unchanged?",
  candidates: Object.freeze([
    Object.freeze({
      id: "bm-04-predict-force-dependence-double",
      label: "D doubles",
      description: "A stronger force causes faster particle transport",
    }),
    Object.freeze({
      id: "bm-04-predict-force-dependence-unchanged",
      label: "D stays unchanged",
      description:
        "Diffusion reflects thermal agitation and drag; the force drops out of the relation",
    }),
    Object.freeze({
      id: "bm-04-predict-force-dependence-halves",
      label: "D halves",
      description: "A stronger force compresses the distribution, reducing spreading",
    }),
  ]),
});
