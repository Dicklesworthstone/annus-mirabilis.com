import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Lq05View = "enumeration" | "sampling" | "logarithmic";

export type Lq05Parameters = Readonly<{
  n: number;
  f: number;
  view: Lq05View;
  locked: boolean;
  seed: string;
  trials: number;
}>;

export const LQ05_DEFAULTS: Lq05Parameters = Object.freeze({
  n: 4,
  f: 0.5,
  view: "enumeration",
  locked: false,
  seed: "12345",
  trials: 10000,
});

export const LQ05_CLASSES: Readonly<Record<keyof Lq05Parameters, ParameterClass>> = Object.freeze({
  n: "input",
  f: "estimator",
  view: "presentation",
  locked: "input",
  seed: "input",
  trials: "input",
});

export const LQ05_MODEL = Object.freeze({
  id: "lq05-independent-configurations-v1",
  constantSetId: "modern-si-2019",
  label: "Independent configurations & Boltzmann entropy · host calculation",
  assumptions: Object.freeze([
    "No favored part of the space or direction in volume V₀.",
    "Negligible interactions among the n movable points.",
    "Other movable points may also be present without altering the independent distribution.",
    "No assumption is needed about the laws of motion of the points.",
  ]),
  notModeled: Object.freeze([
    "Interactions between points.",
    "Gas dynamics or time evolution.",
    "Radiation itself (this is the gas and dilute-solution analogy, not a model of light).",
    "Correlations other than the fully locked case.",
  ]),
});

export const LQ05_QUESTION =
  "How does counting independent possibilities produce an entropy that depends on volume like n ln V, and what changes if the things are not independent?";

/** The instrument's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-lq-05-independent-configurations-jtvo.yaml, which the
 * readings audit reads. Numbers are evaluateLq05 at LQ05_DEFAULTS, at n = 60, and locked. */
export const LQ05_CAPTION = Object.freeze({
  r0: "If points wander independently through a box, the chance of finding all of them in its left half at the same moment is one half multiplied by itself once for each point: one in 16 for four points. Einstein turned that chance, through Boltzmann's principle, into the way a gas's entropy depends on its volume, and then read radiation the same way.",
  r1: "§5 of the light-quanta paper takes n points moving in a volume v_{0}, with nothing assumed about how they move except that no part of the space and no direction is preferred, and so few that they do not act on one another. It asks for the probability that, at a moment picked at random, all n are in a part v of the volume, and answers W = (v/v_{0})^{n}. Boltzmann's principle, S − S_{0} = (R/N) lg W, then gives S − S_{0} = R(n/N) lg(v/v_{0}), from which the gas law and the law of osmotic pressure follow. The instrument sets the fraction f = v/v_{0} and the number n. At its defaults, n = 4 and f = 1/2, W = 1/16 = 0.0625 and the entropy difference is ln W = −2.773 in units of R/N, which is k_{B}. A seeded run of 10 000 random placements, seed 12345, finds all four inside 606 times, a fraction of 0.0606. The enumeration view lists every arrangement of the points among equal cells, 2^{4} = 16 of them here with one favourable, and stops at 2^{20} arrangements rather than freeze the page. For large n the chance is too small to see by sampling: at n = 60 it is 8.67 × 10^{−19}, one success in about 1.2 × 10^{18} tries, so the logarithmic view states log_{10} W = −18.06 instead. Locking the points into one group makes W = f = 1/2 whatever n is, which shows that the exponent n comes from the independence of the points, not from how many labels there are. In §6 Einstein reads radiation's entropy in the same form, with E/(Rβν/N) in the place of n.",
  r2: "Take one point first. It moves about the whole volume v_{0}, and no part of the volume is preferred, so at a moment chosen at random it is in the part v with probability v/v_{0}, the fraction of the volume that part occupies. Call that fraction f; for the left half, f = 1/2. Now take a second point that moves independently of the first. Independently means that where the first point is tells you nothing about where the second is, and for independent events the probability that both happen is the product of their probabilities: f × f = f². Each further point multiplies by f again, so for n points W = f^{n}. With four points and half the volume, W = (1/2)^{4} = 1/16 = 0.0625. A sampler checks this: it places the four points at random 10 000 times and counts the placements with all four on the left, expecting about 10 000/16 = 625. With seed 12345 it finds 606, a fraction of 0.0606, within the ordinary scatter of such a count, whose standard deviation is √(10 000 × 0.0625 × 0.9375) ≈ 24. The enumeration view reaches the same number by counting. Divide the box into two equal cells; each of the four points can be in either, which makes 2 × 2 × 2 × 2 = 16 equally likely arrangements, and exactly one has all four on the left. Now the entropy. Boltzmann's principle says S − S_{0} = (R/N) lg W, where lg is Einstein's natural logarithm, R the gas constant and N the number of molecules in a gram-molecule, so R/N is Boltzmann's constant k_{B}. The logarithm of a power brings the power down in front, lg f^{n} = n lg f, so S − S_{0} = (R/N) n lg(v/v_{0}). For four points and half the volume that is 4 × lg(1/2) = −2.773 in units of R/N. Squeezing the points into a smaller part lowers the entropy, as compressing a gas does. The same arithmetic for n = 60 gives 60 × lg(1/2) = −41.59, so W = e^{−41.59} = 8.67 × 10^{−19}. The sampler finds nothing in 10 000 tries because the expected number of successes, 10 000 × 8.67 × 10^{−19}, is far below one, which is why the logarithmic view states log_{10} W = −18.06 instead of waiting for an event. Last, lock the points together so that they move as one. Now one placement decides all of them, W = f = 1/2 for any n, and the entropy change is lg(1/2), as for a single point. The coefficient in front of the logarithm counts independent placements, and §6 uses exactly that: radiation's entropy has E/(Rβν/N) in that place, so it behaves as that many independent quanta.",
  r3: "The phrase statistical probability is Einstein's own. §5 opens by objecting that entropy calculations often fix cases of equal probability by hypothesis, and promises a separate paper; here the probability is that of finding the state at a moment picked at random. He remarks that the derivation needs no assumption about the law by which the molecules move. The relation as usually written, S = k log W, and the constant k are Planck's, from 1900 and 1901; Boltzmann's 1877 work related entropy to the number of ways a state can be realized without that notation, and Einstein writes R/N. §6 applies the result to radiation of low density, in the range where Wien's law holds, and draws the heuristic conclusion that gives the paper its title. The locked group is a counterexample authored for this site, not a model Einstein discussed.",
});

const c = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const LQ05_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  configurationProbability: c("1", "probability", "radiation.independentPointsProbability", [
    "value",
    "outside-domain",
  ]),
  lnW: c("1", "log-probability", "radiation.independentPointsProbability", [
    "value",
    "outside-domain",
  ]),
  log10W: c("1", "log10-probability", "radiation.independentPointsProbability", [
    "value",
    "outside-domain",
  ]),
  deltaSOverKb: c("1", "entropy-dimensionless", "radiation.independentPointsProbability", [
    "value",
    "outside-domain",
  ]),
  sampleFraction: c("1", "empirical-probability", "radiation.sampleIndependentPoints", [
    "value",
    "outside-domain",
  ]),
  successCount: c("1", "success-count", "radiation.sampleIndependentPoints", [
    "value",
    "outside-domain",
  ]),
  drawCountAfter: c("1", "draw-count", "radiation.sampleIndependentPoints", [
    "value",
    "outside-domain",
  ]),
  expectedTrialsToOne: c("1", "expected-trials", "radiation.independentPointsProbability", [
    "value",
    "outside-domain",
  ]),
  lockedProbability: c("1", "locked-probability", "radiation.lockedPositionsProbability", [
    "value",
    "outside-domain",
  ]),
});

export const LQ05_PRESETS: Readonly<
  Record<string, Readonly<{ label: string; description: string; parameters: Lq05Parameters }>>
> = Object.freeze({
  "lq-05-first-encounter": Object.freeze({
    label: "First encounter (n = 2, f = 1/2)",
    description: "Two independent points in half a volume: 4 microstates, 1 favorable, W = 1/4.",
    parameters: Object.freeze({
      n: 2,
      f: 0.5,
      view: "enumeration",
      locked: false,
      seed: "12345",
      trials: 10000,
    }),
  }),
  "lq-05-journey-stage-e": Object.freeze({
    label: "Journey I Stage E (n = 3, log, locked)",
    description:
      "Stage E walkthrough: microstate counting with n = 3, large n scaling, and the locked counterexample.",
    parameters: Object.freeze({
      n: 3,
      f: 0.5,
      view: "enumeration",
      locked: false,
      seed: "19050511",
      trials: 10000,
    }),
  }),
  "lq-05-locked-positions": Object.freeze({
    label: "The locked positions (n = 10, locked counterexample)",
    description:
      "Ten rigidly locked points: W = 1/2 rather than 1/1024, demonstrating that independence produces the power n.",
    parameters: Object.freeze({
      n: 10,
      f: 0.5,
      view: "enumeration",
      locked: true,
      seed: "12345",
      trials: 10000,
    }),
  }),
  "lq-05-n60-log": Object.freeze({
    label: "Large ensemble logarithmic view (n = 60)",
    description:
      "Macroscopic scaling: 60 independent points in half a volume give W ≈ 8.67 × 10^-19 (log10 W ≈ -18.06).",
    parameters: Object.freeze({
      n: 60,
      f: 0.5,
      view: "logarithmic",
      locked: false,
      seed: "12345",
      trials: 10000,
    }),
  }),
});
