import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Bm03Step = "one-particle" | "two-particles" | "many-particles" | "derivative";
export type Bm03Model = "independent" | "locked-cluster";
export type Bm03Notation = "printed" | "modern";

export type Bm03Parameters = Readonly<{
  Np: number;
  volumeRatio: number;
  V0: number; // reference volume in μm³ (10^6 μm³ = 10^-12 m³)
  T: number; // K
  model: Bm03Model;
  step: Bm03Step;
  notation: Bm03Notation;
}>;

export const BM03_DEFAULTS: Bm03Parameters = Object.freeze({
  Np: 2,
  volumeRatio: 2,
  V0: 1_000_000,
  T: 293.15,
  model: "independent",
  step: "one-particle",
  notation: "printed",
});

export const BM03_CLASSES: Readonly<Record<keyof Bm03Parameters, ParameterClass>> = Object.freeze({
  Np: "input",
  volumeRatio: "input",
  V0: "input",
  T: "input",
  model: "input",
  step: "presentation",
  notation: "presentation",
});

export const BM03_QUESTION =
  "How does counting where independent particles can be produce the pressure law without solving any motion?";

export const BM03_NOT_MODELED = Object.freeze([
  "interactions between particles",
  "excluded volume effects",
  "external potential fields",
  "non-ideal solutions",
  "quantum statistics",
  "momentum integrals beyond their cancellation in the derivative",
  "molecular dynamics or collision trajectories",
  "cluster formation or breakup kinetics",
]);

export const BM03_CAPTION = Object.freeze({
  r0: "Counting where independent particles can be, not how they move, gives the pressure. Doubling the room doubles each particle's options.",
  r1: "Under independence, N_p particles explore volume V with a state-variable integral proportional to V^{N_p}. The free energy contains -k_B T ln(V^{N_p}) = -N_p k_B T ln V. Differentiating with respect to volume yields the pressure p = -dF/dV = N_p k_B T / V.",
  r2: "One particle has position options proportional to V. Two independent particles have options proportional to V * V = V^2. For N_p independent particles the factor is V^{N_p}. Taking the logarithm turns this product into the sum N_p ln V. The volume derivative removes the volume-independent factor J and the constant offset F_0, leaving p = N_p k_B T / V.",
  r3: "Einstein's printed §2 notation uses B for the configuration integral, J for the volume-independent factor, lg for the natural logarithm, n for the particle count, V* for volume, and 2 kappa N = R for the gas constant relation. If the particles are locked into a single rigid cluster, the spatial arrangements grow only as V/V_0 rather than (V/V_0)^{N_p}, yielding pressure p = k_B T / V. Pressure counts independently placed units, not constituents.",
});

export const BM03_MODEL = Object.freeze({
  id: "bm03-configuration-integral-v1",
  constantSetId: "modern-si-2019",
  ownerKind: "host-reference",
  label: "Configuration integral & free energy, host calculation",
  source: "src/physics/reference/diffusion/routeA.ts",
  assumptions: Object.freeze([
    "Independence of particle positions (the §2 premise).",
    "Dilution (no excluded volume interactions).",
    "Uniform potential inside the accessible volume.",
    "Thermal equilibrium.",
    "The volume-independent factor J does not depend on volume V.",
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

export const BM03_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  factorRatio: contract("1", "volume-arrangement-ratio", "diffusion.configurationFactorRatio", [
    "value",
    "outside-domain",
  ]),
  deltaF: contract(
    "J",
    "configurational-free-energy-difference",
    "diffusion.configurationVolumeTerm",
    ["value", "outside-domain"],
  ),
  pressure: contract("Pa", "ideal-osmotic-pressure", "diffusion.configurationVolumeTerm", [
    "value",
    "outside-domain",
  ]),
  lockedClusterPressure: contract(
    "Pa",
    "locked-cluster-pressure",
    "diffusion.lockedClusterPressure",
    ["value", "outside-domain"],
  ),
  volumeIndependentFactor: contract(
    "1",
    "volume-independent-integral",
    "diffusion.configurationVolumeTerm",
    ["symbolic"],
  ),
  momentumIntegrals: contract(
    "1",
    "momentum-integrals-factor",
    "diffusion.configurationVolumeTerm",
    ["symbolic"],
  ),
  freeEnergyOffset: contract(
    "J",
    "constant-free-energy-offset",
    "diffusion.configurationVolumeTerm",
    ["symbolic"],
  ),
});

export const BM03_PRESETS = Object.freeze({
  "bm-03-two-particles-double": Object.freeze({
    label: "Two particles, double volume (Np = 2, V/V0 = 2)",
    parameters: Object.freeze({
      ...BM03_DEFAULTS,
      Np: 2,
      volumeRatio: 2,
      step: "two-particles" as const,
    }),
  }),
  "bm-03-million-particles": Object.freeze({
    label: "One million particles (logarithmic evaluation)",
    parameters: Object.freeze({
      ...BM03_DEFAULTS,
      Np: 1_000_000,
      volumeRatio: 2,
      step: "many-particles" as const,
    }),
  }),
  "bm-03-overflow-guard": Object.freeze({
    label: "1024 particles overflow guard",
    parameters: Object.freeze({
      ...BM03_DEFAULTS,
      Np: 1024,
      volumeRatio: 2,
      step: "many-particles" as const,
    }),
  }),
  "bm-03-pressure-matches-bm-02": Object.freeze({
    label: "1000 particles (the osmotic-partition default)",
    parameters: Object.freeze({
      ...BM03_DEFAULTS,
      Np: 1000,
      volumeRatio: 1,
      step: "derivative" as const,
    }),
  }),
  "bm-03-locked-cluster": Object.freeze({
    label: "Locked cluster counterexample",
    parameters: Object.freeze({
      ...BM03_DEFAULTS,
      Np: 1000,
      volumeRatio: 2,
      model: "locked-cluster" as const,
      step: "derivative" as const,
    }),
  }),
  "bm-03-ratio-one": Object.freeze({
    label: "Volume ratio exactly 1 (Delta F = 0)",
    parameters: Object.freeze({
      ...BM03_DEFAULTS,
      Np: 2,
      volumeRatio: 1,
      step: "two-particles" as const,
    }),
  }),
});
