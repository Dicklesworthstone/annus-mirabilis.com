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

/** The instrument's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-bm-03-configuration-integral-e84v.yaml, which the readings audit reads. */
export const BM03_CAPTION = Object.freeze({
  r0: "Counting where independent particles can be, not how they move, gives the pressure they exert. Twice the room gives each particle twice the places to be, and two particles four times the arrangements.",
  r1: "§2 derives osmotic pressure from the molecular-kinetic theory without any picture of how the particles move. The free energy is F = −(RT/N) lg B, where B is an integral over every possible state of the system. For n particles held in a volume V* by a semipermeable wall, moving independently in a homogeneous liquid with no forces on them, §2 shows that the integral splits into a factor J that depends neither on where the particles are nor on V*, times one factor of V* for each particle: B = J V*^{n}. Then F = −(RT/N){lg J + n lg V*}, and the pressure is p = −∂F/∂V* = (RT/N)(n/V*), in modern symbols N_{p}k_{B}T/V. So suspended bodies and dissolved molecules of equal number exert the same osmotic pressure at high dilution. The lab's default is two particles in 2 × 10^{−12} m³, twice the starting volume, at 293.15 K: the free energy falls by 5.61 × 10^{−21} J, and the pressure is 4.05 × 10^{−9} Pa. With 100 particles it is 2.02 × 10^{−7} Pa, fifty times as much. Lock the two particles into one rigid cluster and they have only one placement to make: the free energy falls by half as much, 2.81 × 10^{−21} J, and the pressure is 2.02 × 10^{−9} Pa, that of a single particle.",
  r2: "Start with one particle in a box of volume V. The number of places it can be is proportional to V: twice the volume, twice the places. A second particle that moves independently of the first has its own V places, so the pair has V × V = V² arrangements, and twice the volume gives four times as many. For N_{p} particles the count is V^{N_{p}}, and the rest of the integral, everything about velocities and the liquid's own molecules, is the volume-independent factor J. The free energy uses the logarithm of the count, and the logarithm turns the product into a sum: ln(J V^{N_{p}}) = ln J + N_{p} ln V. So F = −k_{B}T(ln J + N_{p} ln V), writing k_{B} for Einstein's R/N. Pressure is how fast the free energy falls as the volume grows, p = −∂F/∂V. The ln J term does not change with V, so it drops out, and the derivative of N_{p} ln V is N_{p}/V, leaving p = N_{p}k_{B}T/V. Now put in the default. k_{B}T = 1.381 × 10^{−23} × 293.15 = 4.047 × 10^{−21} J, and doubling the volume changes F by −2 × 4.047 × 10^{−21} × ln 2 = −5.61 × 10^{−21} J. The pressure in 2 × 10^{−12} m³ is 2 × 4.047 × 10^{−21}/(2 × 10^{−12}) = 4.05 × 10^{−9} Pa. For a locked cluster the count is V, not V², so the change is −k_{B}T ln 2 = −2.81 × 10^{−21} J and the pressure is k_{B}T/V = 2.02 × 10^{−9} Pa: half, because one unit is placed instead of two. Nothing in the argument used the particles' size or how they move, which is why a suspended grain and a dissolved molecule count the same.",
  r3: "Einstein's printed §2 writes the entropy as S = E/T + 2κ lg ∫e^{−E/2κT} dp_{1} … dp_{l}, with 2κN = R, so his κ is half of the modern k_{B}; B stands for the integral, J for the volume-independent factor, V* for the volume inside the semipermeable wall, n for the number of particles, and lg for the natural logarithm. A footnote says the section presupposes his papers on the foundations of thermodynamics of 1902 and 1903, and that the paper's results can be understood without it. The rigid cluster is a comparison authored for this site: it shows that pressure counts independently placed units, not constituents, the point the light-quanta paper's §5 makes with its exponent n.",
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
    label: "Volume ratio exactly 1 (ΔF = 0)",
    parameters: Object.freeze({
      ...BM03_DEFAULTS,
      Np: 2,
      volumeRatio: 1,
      step: "two-particles" as const,
    }),
  }),
});
