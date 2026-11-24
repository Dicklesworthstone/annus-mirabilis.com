/**
 * Join result declarations to the actual proof owners used by the reader.
 * Owners check the supplied canonical equation records before returning. A saved title,
 * fixture chain or generated JSON payload cannot stand in for that calculation.
 *
 * These are teaching derivations. They are deliberately separate from projectSupport's
 * source-order graph projection: the checks establish conditional algebra and limits,
 * never the physical premises or historical fidelity.
 */
import brownianInferenceRecord from "../../../content/equations/brownian-motion/eq-model-bm-avogadro-inference.json";
import brownianMolarRecord from "../../../content/equations/brownian-motion/eq-model-bm-diffusivity-molar.json";
import brownianMomentRecord from "../../../content/equations/brownian-motion/eq-model-bm-mean-square-growth.json";
import lqMolarEnergyRecord from "../../../content/equations/light-quanta/eq-model-lq-energy-per-point-molar.json";
import lqEntropyTemperatureRecord from "../../../content/equations/light-quanta/eq-model-lq-entropy-temperature.json";
import lqGasRecord from "../../../content/equations/light-quanta/eq-model-lq-gas-entropy-change.json";
import photoelectricMaximumRecord from "../../../content/equations/light-quanta/eq-model-lq-photoelectric-maximum.json";
import stoppingEnergyRecord from "../../../content/equations/light-quanta/eq-model-lq-stopping-energy.json";
import lqVolumeRecord from "../../../content/equations/light-quanta/eq-model-lq-volume-entropy.json";
import lqEntropyDensityRecord from "../../../content/equations/light-quanta/eq-model-lq-wien-entropy-density.json";
import lqInverseTemperatureRecord from "../../../content/equations/light-quanta/eq-model-lq-wien-inverse-temperature.json";
import lqSpectrumRecord from "../../../content/equations/light-quanta/eq-model-lq-wien-spectrum.json";
import aberrationRecord from "../../../content/equations/special-relativity/eq-model-sr-aberration.json";
import chargeDensityRecord from "../../../content/equations/special-relativity/eq-model-sr-charge-density.json";
import composedVelocityXRecord from "../../../content/equations/special-relativity/eq-model-sr-composed-velocity-x.json";
import composedVelocityYRecord from "../../../content/equations/special-relativity/eq-model-sr-composed-velocity-y.json";
import currentDensityRecord from "../../../content/equations/special-relativity/eq-model-sr-current-density.json";
import dopplerRecord from "../../../content/equations/special-relativity/eq-model-sr-doppler-factor.json";
import frequencyRecord from "../../../content/equations/special-relativity/eq-model-sr-doppler-ratio.json";
import workIntegralRecord from "../../../content/equations/special-relativity/eq-model-sr-electron-work-integral.json";
import workResultRecord from "../../../content/equations/special-relativity/eq-model-sr-electron-work-result.json";
import inversePositionRecord from "../../../content/equations/special-relativity/eq-model-sr-inverse-position.json";
import velocityInverseTimeRecord from "../../../content/equations/special-relativity/eq-model-sr-inverse-time.json";
import lengthRecord from "../../../content/equations/special-relativity/eq-model-sr-length-contraction.json";
import densityRecord from "../../../content/equations/special-relativity/eq-model-sr-light-density.json";
import energyRecord from "../../../content/equations/special-relativity/eq-model-sr-light-energy.json";
import volumeRecord from "../../../content/equations/special-relativity/eq-model-sr-light-volume.json";
import longitudinalRecord from "../../../content/equations/special-relativity/eq-model-sr-longitudinal-mass.json";
import factorRecord from "../../../content/equations/special-relativity/eq-model-sr-lorentz-factor.json";
import velocityPositionRecord from "../../../content/equations/special-relativity/eq-model-sr-map-position.json";
import velocityTimeRecord from "../../../content/equations/special-relativity/eq-model-sr-map-time.json";
import mirrorFrequencyRecord from "../../../content/equations/special-relativity/eq-model-sr-mirror-frequency.json";
import simultaneityOffsetRecord from "../../../content/equations/special-relativity/eq-model-sr-simultaneity-offset.json";
import sphericalWaveRecord from "../../../content/equations/special-relativity/eq-model-sr-spherical-wave-moving.json";
import syncCriterionRecord from "../../../content/equations/special-relativity/eq-model-sr-sync-equal-legs.json";
import syncMidpointRecord from "../../../content/equations/special-relativity/eq-model-sr-sync-midpoint.json";
import clockRecord from "../../../content/equations/special-relativity/eq-model-sr-time-dilation.json";
import laboratoryRecord from "../../../content/equations/special-relativity/eq-model-sr-transverse-mass-laboratory.json";
import printedRecord from "../../../content/equations/special-relativity/eq-model-sr-transverse-mass-printed.json";
import type { Expression } from "../../equations/ast.ts";
import { verifyBrownianEquilibrium } from "../../equations/derivations/brownianEquilibriumProof.ts";
import { brownianInferenceChain } from "../../equations/derivations/brownianInference.ts";
import { verifyBrownianInference } from "../../equations/derivations/brownianInferenceProof.ts";
import { brownianEquilibriumDerivation } from "../../equations/derivations/brownianSource.ts";
import { verifyLqCoefficientCorrespondence } from "../../equations/derivations/lightQuantaCoefficientProof.ts";
import {
  lqCoefficientCorrespondence,
  lqWienEntropyDerivation,
} from "../../equations/derivations/lightQuantaEntropy.ts";
import { verifyLqWienEntropy } from "../../equations/derivations/lightQuantaEntropyProof.ts";
import { photoelectricChain } from "../../equations/derivations/lightQuantaPhotoelectric.ts";
import { verifyPhotoelectric } from "../../equations/derivations/lightQuantaPhotoelectricProof.ts";
import { buildMassEnergyElimination } from "../../equations/derivations/massEnergyElimination.ts";
import { buildMassEnergyLowSpeed } from "../../equations/derivations/massEnergyLowSpeed.ts";
import {
  srChargeCurrentAssumptions,
  srChargeCurrentChains,
} from "../../equations/derivations/srChargeCurrent.ts";
import { verifySRChargeCurrent } from "../../equations/derivations/srChargeCurrentProof.ts";
import {
  srClockLengthAssumptions,
  srClocksAndLengths,
} from "../../equations/derivations/srClocksAndLengths.ts";
import { verifySRClocksAndLengths } from "../../equations/derivations/srClocksAndLengthsProof.ts";
import { srDopplerAssumptions, srDopplerChains } from "../../equations/derivations/srDoppler.ts";
import { verifySRDoppler } from "../../equations/derivations/srDopplerProof.ts";
import {
  srElectronLaboratory,
  srElectronLongitudinal,
  srElectronTransverse,
  srElectronWork,
} from "../../equations/derivations/srElectron.ts";
import { srLightComplexDerivation } from "../../equations/derivations/srLightComplex.ts";
import { srMirrorAssumptions, srMirrorChains } from "../../equations/derivations/srMirror.ts";
import { verifySRMirror } from "../../equations/derivations/srMirrorProof.ts";
import {
  srSimultaneityAssumptions,
  srSimultaneityChain,
} from "../../equations/derivations/srSimultaneity.ts";
import { verifySRSimultaneity } from "../../equations/derivations/srSimultaneityProof.ts";
import {
  srSphericalWaveChain,
  srSphericalWavePremises,
  verifySRSphericalWave,
} from "../../equations/derivations/srSphericalWaveProof.ts";
import { srSynchronizationChain } from "../../equations/derivations/srSynchronization.ts";
import { srVelocityChains } from "../../equations/derivations/srVelocityComposition.ts";
import { verifySRVelocityComposition } from "../../equations/derivations/srVelocityProof.ts";
import { structurallyEqual } from "../../equations/derivations/treeUtils.ts";
import type { DerivationChain } from "../../equations/derivations/types.ts";
import {
  type ChainVerificationReport,
  verifyChain,
} from "../../equations/derivations/verifyChain.ts";
import type { EquationRecord } from "../../equations/record.ts";
import { checkedClosingSupport } from "./closingSupport.ts";
import { checkedFieldCovarianceSupport } from "./fieldCovarianceSupport.ts";
import { checkedGaussianSupport } from "./gaussianSupport.ts";
import { checkedKernelSupport } from "./kernelSupport.ts";
import { checkedLqFoundationsSupport } from "./lightQuantaFoundationsSupport.ts";
import { checkedOsmoticSupport } from "./osmoticSupport.ts";
import { checkedPredictionSupport } from "./predictionSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import type { ResultCardRecord } from "./resultCards.ts";
import type { CheckedResultSupport, ResultProofId } from "./supportDeclarations.ts";

type DerivationProofId = Exclude<
  Extract<ResultProofId, `sr-${string}` | `bm-${string}` | `lq-${string}`>,
  | "sr-field-covariance"
  | "bm-gaussian-displacement"
  | "bm-kernel-diffusion"
  | "bm-historical-displacement"
  | "bm-osmotic-volume"
  | "lq-fluorescence-energy"
  | "lq-ionization-energy-count"
  | "lq-classical-cutoff"
  | "lq-independent-entropy"
>;
type ProofRecord = Readonly<{
  id: string;
  paper: string;
  argument: string;
  tree: unknown;
  assumptions: readonly string[];
}>;
type DerivationProof = Readonly<{
  paper: string;
  conclusion: string;
  title: string;
  href: string;
  records: readonly ProofRecord[];
  chains: readonly DerivationChain[];
  premises?: CheckedResultSupport["assumptions"];
  verify?: (chain: DerivationChain) => ChainVerificationReport;
}>;

/**
 * Each route is the one the explanation face renders. The records are the same imports its
 * owner uses; a separately supplied equation corpus must agree before its result gets support.
 * Only routes whose every transformation is executable belong here. A passing preview report
 * for authored, unchecked calculus is not a checked proof.
 */
const DERIVATION_PROOFS: Readonly<Record<DerivationProofId, DerivationProof>> = {
  "sr-simultaneity-offset": {
    paper: "special-relativity",
    conclusion: simultaneityOffsetRecord.id,
    title: "Compare the same two events in both frames",
    href: "/papers/special-relativity/s2/#sr-simultaneity-derivation",
    records: [velocityTimeRecord, factorRecord, simultaneityOffsetRecord],
    chains: [srSimultaneityChain],
    verify: verifySRSimultaneity,
    premises: srSimultaneityAssumptions,
  },
  "sr-moving-clock": {
    paper: "special-relativity",
    conclusion: clockRecord.id,
    title: "Follow two ticks of the same clock through the coordinate map",
    href: "/papers/special-relativity/s4/#sr-clock-length-clock",
    records: [velocityInverseTimeRecord, factorRecord, clockRecord],
    chains: [srClocksAndLengths.clock],
    verify: verifySRClocksAndLengths,
    premises: srClockLengthAssumptions.filter(
      (assumption) =>
        !["sr-clock-length-resting-rigid-rod", "sr-clock-length-stationary-simultaneity"].includes(
          assumption.id,
        ),
    ),
  },
  "sr-simultaneous-length": {
    paper: "special-relativity",
    conclusion: lengthRecord.id,
    title: "Follow simultaneous endpoint marks to the moving length",
    href: "/papers/special-relativity/s4/#sr-clock-length-rod",
    records: [velocityPositionRecord, factorRecord, lengthRecord],
    chains: [srClocksAndLengths.length],
    verify: verifySRClocksAndLengths,
    premises: srClockLengthAssumptions.filter(
      (assumption) => assumption.id !== "sr-clock-length-same-resting-clock",
    ),
  },
  "lq-photoelectric-energy": {
    paper: "light-quanta",
    conclusion: photoelectricMaximumRecord.id,
    title: "Follow one quantum through escape work to stopping voltage",
    href: "/papers/light-quanta/s8/#lq-photoelectric-derivation",
    records: [photoelectricMaximumRecord, stoppingEnergyRecord],
    chains: [photoelectricChain],
    verify: verifyPhotoelectric,
    premises: [
      {
        id: "lq-photoelectric-whole-quantum",
        label: "One quantum supplies one electron's energy",
        explanation:
          "The admitted model transfers one light quantum's full energy to one electron. This is a physical premise, not a consequence of the energy bookkeeping.",
      },
      {
        id: "lq-photoelectric-attainable-edge",
        label: "The fastest electrons have no additional loss",
        explanation:
          "The maximum assumes electrons can escape after paying the stated work W without an additional energy loss. A generic emitted electron may have less energy.",
      },
      {
        id: "lq-photoelectric-admissible-domain",
        label: "Positive energy scales and an admitted emission budget",
        explanation:
          "h, ν and the charge magnitude e are positive, W is nonnegative and hν is at least W. Below threshold the model has no emitted-electron stopping voltage; a negative algebraic remainder is not an electron energy.",
      },
      {
        id: "lq-photoelectric-retarding-work",
        label: "Electrical work supplies a separate stopping condition",
        explanation:
          "Use the independently supplied relation between electrical work and a nonnegative retarding-voltage magnitude, with e the positive charge magnitude. Contact potentials and additional material effects are outside this ideal comparison.",
      },
    ],
  },
  "sr-doppler-phase": {
    paper: "special-relativity",
    conclusion: dopplerRecord.id,
    title: "Follow one wave phase to the frequency and direction changes",
    href: "/papers/special-relativity/s7/#sr-doppler-derivation",
    records: [
      inversePositionRecord,
      velocityInverseTimeRecord,
      dopplerRecord,
      frequencyRecord,
      aberrationRecord,
    ],
    chains: srDopplerChains,
    verify: verifySRDoppler,
    premises: srDopplerAssumptions,
  },
  "sr-moving-mirror": {
    paper: "special-relativity",
    conclusion: mirrorFrequencyRecord.id,
    title: "Follow reflection through moving-surface energy transfer to pressure",
    href: "/papers/special-relativity/s8/#sr-mirror-derivation",
    records: [dopplerRecord, aberrationRecord, mirrorFrequencyRecord],
    chains: srMirrorChains,
    verify: verifySRMirror,
    premises: srMirrorAssumptions,
  },
  "sr-charge-current": {
    paper: "special-relativity",
    conclusion: chargeDensityRecord.id,
    title: "Follow charge and current from one species to a neutral mixture",
    href: "/papers/special-relativity/s9/#sr-charge-current-derivation",
    records: [chargeDensityRecord, currentDensityRecord],
    chains: srChargeCurrentChains,
    verify: verifySRChargeCurrent,
    premises: srChargeCurrentAssumptions,
  },
  "bm-equilibrium-diffusivity": {
    paper: "brownian-motion",
    conclusion: brownianMolarRecord.id,
    title: "Follow the equilibrium balance to the diffusion coefficient",
    href: "/papers/brownian-motion/s3/#bm-equilibrium-derivation",
    records: [brownianMolarRecord],
    chains: [brownianEquilibriumDerivation],
    verify: verifyBrownianEquilibrium,
    premises: [
      {
        id: "arg-bm-osmotic-suspended",
        label: "Dilute osmotic law",
        explanation:
          "The suspension is dilute and its particles are independent. The admitted osmotic " +
          "law is Π = nRT/N, with uniform positive absolute temperature.",
      },
      {
        id: "bm-isothermal-osmotic-equilibrium",
        label: "The same equilibrium in both descriptions",
        explanation:
          "The isothermal force balance and zero total particle flux describe the same " +
          "weak-force equilibrium. The thermodynamic construction of that state remains a premise.",
      },
      {
        id: "bm-drift-particle-flux",
        label: "Drift counts particles",
        explanation:
          "The drift particle flux is J_drift = nbK. It is compared with a particle flux, " +
          "rather than a mass flux or a velocity inferred from an irregular trajectory.",
      },
      {
        id: "bm-fick-flux",
        label: "Fick's diffusive flux",
        explanation:
          "The admitted transport law is J_diff = −D ∂n/∂x. At equilibrium it cancels the drift.",
      },
      {
        id: "bm-stokes-drag-dilute-spheres",
        label: "Stokes mobility and its domain",
        explanation:
          "The independently supplied mobility is b = 1/(6πηa), for dilute spheres in a " +
          "Newtonian liquid with slow no-slip drift. Viscosity, radius and N are positive.",
      },
      {
        id: "bm-nonzero-gradient-comparison",
        label: "A nonzero comparison gradient",
        explanation:
          "Cancelling ∂n/∂x requires a nonzero gradient in the selected weak-force equilibrium. " +
          "A uniform zero-force state gives 0 = 0 and does not determine D. Applying the " +
          "coefficient in that limit retains the linear-response model assumption.",
      },
    ],
  },
  "bm-molecular-number-inference": {
    paper: "brownian-motion",
    conclusion: brownianInferenceRecord.id,
    title: "Follow the conditional inversion from observed spread to an estimate",
    href: "/papers/brownian-motion/s5/#bm-molecular-number-derivation",
    records: [brownianMolarRecord, brownianMomentRecord, brownianInferenceRecord],
    chains: [brownianInferenceChain],
    verify: verifyBrownianInference,
    premises: [
      {
        id: "bm-inference-observed-moment-fit",
        label: "An explicit fitting definition",
        explanation:
          "Choose the molecular-number estimate whose model mean square matches the observed " +
          "one-axis mean square. This definition does not equate a finite sample with its " +
          "population expectation or make the estimate equal to the unknown model parameter.",
      },
      {
        id: "bm-inference-independent-inputs",
        label: "Independently supplied radius and other inputs",
        explanation:
          "R, temperature, viscosity and particle radius are supplied independently. Without " +
          "the radius the observations constrain only aN. Neither an assumed N nor modern " +
          "exact kB can generate observations and then serve as independent evidence for N.",
      },
      {
        id: "bm-inference-positive-domain",
        label: "Positive inputs and an applicable one-axis model",
        explanation:
          "The interval, mean square, candidate estimate and independent inputs are positive " +
          "and finite. The dilute-sphere Stokes model and zero-drift population moment law " +
          "are admitted. Gaussian calculus, measurement validity, finite-sample bias and " +
          "uncertainty coverage are outside this algebraic check.",
      },
    ],
  },
  "lq-wien-entropy-volume": {
    paper: "light-quanta",
    conclusion: lqVolumeRecord.id,
    title: "Follow Wien's law through the entropy boundary to its volume dependence",
    href: "/papers/light-quanta/s4/#lq-wien-entropy-derivation",
    records: [
      lqSpectrumRecord,
      lqInverseTemperatureRecord,
      lqEntropyTemperatureRecord,
      lqEntropyDensityRecord,
      lqVolumeRecord,
    ],
    chains: [lqWienEntropyDerivation],
    verify: verifyLqWienEntropy,
    premises: [
      {
        id: "arg-lq-wien-integration",
        label: "The admitted Wien approximation",
        explanation:
          "Use ρν = Aν³ exp(−Bν/T) in its dilute, large-ν/T regime. The calculation checks " +
          "consequences of this empirical approximation; its applicability remains a physical premise.",
      },
      {
        id: "arg-lq-entropy-temperature",
        label: "The thermodynamic entropy slope",
        explanation:
          "At each fixed frequency, use (∂sν/∂ρν)ν = 1/T. The equilibrium thermodynamic " +
          "argument that supplies this identity is a premise of this calculation.",
      },
      {
        id: "lq-positive-wien-domain",
        label: "Positive quantities and both states dilute",
        explanation:
          "A, B, ν, T, ρν, E, Δν and both volumes are positive. Every logarithm argument " +
          "and cancelled denominator is then defined. Both comparison states must remain " +
          "in Wien's regime; equal volumes are allowed and give zero entropy change.",
      },
      {
        id: "lq-zero-density-entropy-boundary",
        label: "Entropy vanishes at zero density",
        explanation:
          "Adopt sν(0) = 0 at each fixed frequency. The one-sided limit of the integrated " +
          "expression is C(ν), so this premise fixes C(ν) = 0. An unfixed C(ν) would leave " +
          "the extra volume term Δν C(ν)(V − V₀).",
      },
      {
        id: "lq-fixed-energy-frequency-band",
        label: "The same energy and narrow frequency band",
        explanation:
          "Compare equilibrium states with the same E, ν and narrow Δν, using E = VΔνρν " +
          "and S(V) = VΔνsν. Only V changes. A moving reflecting wall changes energy and " +
          "frequency and does not implement this comparison.",
      },
    ],
  },
  "lq-entropy-energy-scale": {
    paper: "light-quanta",
    conclusion: lqMolarEnergyRecord.id,
    title: "Follow the conditional entropy comparison to its energy scale",
    href: "/papers/light-quanta/s6/#lq-entropy-correspondence-derivation",
    records: [lqVolumeRecord, lqGasRecord, lqMolarEnergyRecord],
    chains: [lqCoefficientCorrespondence],
    verify: verifyLqCoefficientCorrespondence,
    premises: [
      {
        id: "arg-lq-fixed-band-volume",
        label: "The admitted radiation entropy law",
        explanation:
          "Use ΔS = [E/(Bν)] ln(V/V₀) for dilute radiation at fixed energy and frequency band. " +
          "The Wien-law integration and zero-density entropy boundary are separate premises.",
      },
      {
        id: "arg-lq-independent-configurations",
        label: "Independent points and the molar entropy coefficient",
        explanation:
          "The comparison gas has independently placed points and coefficient (R/N)n. " +
          "Its modern kB notation denotes R/N; the comparison uses no photon-energy law.",
      },
      {
        id: "lq-positive-wien-domain",
        label: "Positive quantities in the dilute regime",
        explanation:
          "E, R, N, B, ν and both volumes are positive. The effective count inferred from them " +
          "is positive, so the energy per element and every cancelled denominator are defined.",
      },
      {
        id: "lq-heuristic-independent-energy-elements",
        label: "A heuristic independent-element description",
        explanation:
          "Matching one entropy-volume law proposes a model of independent energy elements. " +
          "Taking E/n as its energy per element is conditional on that model; the match alone " +
          "does not establish every property of light or individual emission and absorption.",
      },
      {
        id: "lq-nontrivial-volume-ratio",
        label: "Unequal comparison volumes",
        explanation:
          "V/V₀ is positive and different from one, so ln(V/V₀) is nonzero. Equal volumes " +
          "give zero entropy change on both sides and cannot identify an effective count.",
      },
    ],
  },
  "sr-velocity-composition": {
    paper: "special-relativity",
    conclusion: composedVelocityXRecord.id,
    title: "Follow both velocity components from k to K",
    href: "/papers/special-relativity/s5/#sr-velocity-derivation",
    records: [
      velocityPositionRecord,
      velocityTimeRecord,
      velocityInverseTimeRecord,
      composedVelocityXRecord,
      composedVelocityYRecord,
    ],
    chains: srVelocityChains,
    verify: verifySRVelocityComposition,
    premises: [
      {
        id: "arg-sr-lorentz-map",
        label: "The admitted coordinate transformation",
        explanation:
          "The section 3 Lorentz map and its inverse describe the same events in inertial frames with identically normalized and oriented axes. The transverse equality eta = y is retained as an admitted result of that map.",
      },
      {
        id: "sr-velocity-straight-path-through-common-origin",
        label: "One uniform path through the common origin",
        explanation:
          "The given moving-frame motion is xi = w_xi tau and eta = w_eta tau. Dividing coordinates by elapsed time is valid for this uniform path from the common origin.",
      },
      {
        id: "sr-velocity-positive-light-speed-subluminal-frame-causal-point",
        label: "Positive light speed and a subluminal frame",
        explanation:
          "V is positive, |v| is less than V, and the point's speed is at most V. Hence the Lorentz factor and 1 + v w_xi/V squared are positive. These are domain premises, not consequences established by the algebra.",
      },
      {
        id: "sr-velocity-nonzero-elapsed-time",
        label: "A nonzero elapsed time for the velocity ratios",
        explanation:
          "The time used to form displacement divided by time is nonzero. The common origin's 0/0 does not define a velocity, and no step divides by the sideways velocity.",
      },
    ],
  },
  "sr-spherical-wave-compatibility": {
    paper: "special-relativity",
    conclusion: sphericalWaveRecord.id,
    title: "Check the spherical light wave in both frames",
    href: "/papers/special-relativity/s3/#sr-spherical-wave-check",
    records: [velocityPositionRecord, velocityTimeRecord, factorRecord, sphericalWaveRecord],
    chains: [srSphericalWaveChain],
    verify: (chain) => verifySRSphericalWave(chain, sphericalWaveRecord.tree as Expression),
    premises: srSphericalWavePremises,
  },
  "sr-synchronization-midpoint": {
    paper: "special-relativity",
    conclusion: syncMidpointRecord.id,
    title: "Follow the synchronization definition to the midpoint reading",
    href: "/papers/special-relativity/s1/#sr-synchronization-derivation",
    records: [syncCriterionRecord, syncMidpointRecord],
    chains: [srSynchronizationChain],
    premises: [
      {
        id: "arg-sr-synchronization",
        label: "Adopt the equal-travel-time definition",
        explanation:
          "Assign equal duration to the outward and return light journeys. The reading at B " +
          "is defined by that choice; the round-trip readings at A do not measure either " +
          "one-way duration independently.",
      },
      {
        id: "sr-synchronization-stationary-clocks-common-rate",
        label: "Compare clocks at rest with a common rate",
        explanation:
          "A and B are at rest in the same inertial system, and their clock readings use " +
          "the same time unit and rate. This calculation sets B's offset for one round trip.",
      },
      {
        id: "sr-synchronization-return-after-departure",
        label: "The signal returns after it leaves",
        explanation:
          "A records departure and return locally, with the return later than departure. " +
          "The assigned reflection reading is halfway between those two readings, " +
          "including when the departure reading is not zero.",
      },
    ],
  },
  "sr-light-complex-energy": {
    paper: "special-relativity",
    conclusion: energyRecord.id,
    title: "Follow the energy of the whole light packet",
    href: "/papers/special-relativity/s8/#sr-light-complex-derivation",
    records: [dopplerRecord, frequencyRecord, densityRecord, volumeRecord, energyRecord],
    chains: [srLightComplexDerivation],
  },
  "sr-electron-force-conventions": {
    paper: "special-relativity",
    conclusion: printedRecord.id,
    title: "Follow each force and acceleration back to its frame",
    href: "/papers/special-relativity/s10/#sr-electron-conventions-derivation",
    records: [longitudinalRecord, printedRecord, laboratoryRecord],
    chains: [srElectronLongitudinal, srElectronTransverse, srElectronLaboratory],
  },
  "sr-electron-work": {
    paper: "special-relativity",
    conclusion: workResultRecord.id,
    title: "Follow the force through the work integral",
    href: "/papers/special-relativity/s10/#sr-electron-work-derivation",
    records: [longitudinalRecord, workIntegralRecord, workResultRecord],
    chains: [srElectronLongitudinal, srElectronWork],
  },
};

/**
 * Authored routes for a result already admitted by checkedSupportFor. An empty
 * list means a separate calculation owner supplies the proof; it does not turn
 * that result into an assumption-free root or establish any dependency by itself.
 */
export function checkedResultChains(proofId: ResultProofId): readonly DerivationChain[] {
  return DERIVATION_PROOFS[proofId as DerivationProofId]?.chains ?? [];
}

function checkedDerivationSupport(
  cardId: string,
  declaration: Readonly<{ proofId: DerivationProofId; conclusion: string; scope: string }>,
  conclusion: EquationRecord,
  equations: readonly EquationRecord[],
): CheckedResultSupport {
  const proof = DERIVATION_PROOFS[declaration.proofId];
  if (conclusion.paper !== proof.paper || declaration.conclusion !== proof.conclusion)
    throw new ResultCardsError(
      "result-support-derivation-conclusion-missing",
      `${cardId}: ${declaration.proofId} does not establish ${declaration.conclusion}.`,
    );

  const records = proof.records.map((expected) => {
    const matches = equations.filter((equation) => equation.id === expected.id);
    const actual = matches[0];
    if (
      matches.length !== 1 ||
      !actual ||
      actual.paper !== expected.paper ||
      actual.argument !== expected.argument ||
      !structurallyEqual(actual.tree, expected.tree as Expression) ||
      JSON.stringify(actual.assumptions) !== JSON.stringify(expected.assumptions)
    )
      throw new ResultCardsError(
        "result-support-derivation-record-mismatch",
        `${cardId}: ${expected.id} is missing, repeated, or differs from the derivation's canonical equation or premises.`,
      );
    return actual;
  });

  for (const chain of proof.chains) {
    const report = proof.verify
      ? proof.verify(chain)
      : verifyChain(chain, { isPublicationGate: true });
    if (
      !report.passed ||
      !report.isPublicationReady ||
      report.stepReports.length !== chain.steps.length ||
      report.stepReports.length === 0 ||
      report.stepReports.some((step) => step.verificationStatus !== "verified")
    )
      throw new ResultCardsError(
        "result-support-derivation-not-checked",
        `${cardId}: ${chain.id} does not have a checked result for every transformation.`,
      );
  }

  // Preserve the premises authored with the equations, avoiding repeated copies when several
  // outputs share them. This is plain build output; the browser receives no checker or registry.
  const seen = new Set<string>();
  const assumptions = records.flatMap((record) => {
    const distinct = record.assumptions.filter((assumption) => {
      if (seen.has(assumption)) return false;
      seen.add(assumption);
      return true;
    });
    return distinct.length > 0
      ? [{ id: record.id, label: record.title, explanation: distinct.join(" ") }]
      : [];
  });
  return {
    kind: "checked-proof",
    proofId: declaration.proofId,
    title: proof.title,
    href: proof.href,
    conclusion: { equationId: conclusion.id, title: conclusion.title },
    scope: declaration.scope,
    assumptions: [...(proof.premises ?? []), ...assumptions],
  };
}

export function checkedSupportFor(
  card: Pick<ResultCardRecord, "id" | "paper" | "arguments" | "support">,
  equations: readonly EquationRecord[],
): CheckedResultSupport | undefined {
  const declaration = card.support;
  if (declaration.kind === "no-checked-proof") return undefined;
  const conclusion = equations.find((equation) => equation.id === declaration.conclusion);
  if (
    conclusion?.paper !== card.paper ||
    !conclusion.argument ||
    !card.arguments.includes(conclusion.argument)
  )
    throw new ResultCardsError(
      "result-support-conclusion-mismatch",
      `${card.id}: ${declaration.conclusion} is not an equation of this card's argument.`,
    );

  if (declaration.proofId === "bm-osmotic-volume")
    return checkedOsmoticSupport(card.id, declaration, conclusion, equations);

  if (declaration.proofId === "sr-field-covariance")
    return checkedFieldCovarianceSupport(card.id, declaration, conclusion, equations);

  if (declaration.proofId === "bm-gaussian-displacement")
    return checkedGaussianSupport(card.id, declaration, conclusion, equations);

  if (declaration.proofId === "bm-kernel-diffusion")
    return checkedKernelSupport(card.id, declaration, conclusion, equations);

  if (declaration.proofId === "bm-historical-displacement")
    return checkedPredictionSupport(card.id, declaration, conclusion, equations);

  if (
    declaration.proofId === "lq-classical-cutoff" ||
    declaration.proofId === "lq-independent-entropy"
  )
    return checkedLqFoundationsSupport(card.id, declaration, conclusion, equations);

  if (
    declaration.proofId === "lq-fluorescence-energy" ||
    declaration.proofId === "lq-ionization-energy-count"
  )
    return checkedClosingSupport(card.id, declaration, conclusion, equations);

  if (Object.hasOwn(DERIVATION_PROOFS, declaration.proofId))
    return checkedDerivationSupport(
      card.id,
      { ...declaration, proofId: declaration.proofId as DerivationProofId },
      conclusion,
      equations,
    );

  if (card.paper !== "mass-energy")
    throw new ResultCardsError(
      "result-support-conclusion-mismatch",
      `${card.id}: a mass-energy proof cannot establish this paper's result.`,
    );

  if (declaration.proofId === "me-ledger-elimination") {
    const proof = buildMassEnergyElimination(equations);
    if (!proof.certificate.steps.some((step) => step.equation === conclusion.id))
      throw new ResultCardsError(
        "result-support-elimination-conclusion-missing",
        `${card.id}: the ledger elimination does not establish ${conclusion.id}.`,
      );
    return {
      kind: "checked-proof",
      proofId: declaration.proofId,
      title: "Follow the two energy accounts, step by step",
      href: "/papers/mass-energy/#me-ledger-derivation",
      conclusion: { equationId: conclusion.id, title: conclusion.title },
      scope: declaration.scope,
      assumptions: proof.premises,
    };
  }

  if (declaration.proofId !== "me-low-speed-coefficient")
    throw new ResultCardsError(
      "result-support-owner-missing",
      `${card.id}: no calculation owner is registered for this proof.`,
    );
  const proof = buildMassEnergyLowSpeed(equations);
  // Use the conclusion's dependency set: the quadratic expansion does not need the
  // inertia-identification premise that the final mass conclusion requires.
  const requirements = proof.requirements.find(
    (step) =>
      step.step === (conclusion.id === "eq-model-me-mass-decrease" ? "identify" : "kinetic"),
  );
  // The factor and exact drop are inputs to this owner. Only the quadratic approximation and
  // the limiting mass coefficient are its conclusions; citing an input as proved is refused.
  if (
    !["eq-model-me-quadratic-drop", "eq-model-me-mass-decrease"].includes(conclusion.id) ||
    !proof.equationIds.includes(conclusion.id) ||
    !requirements
  )
    throw new ResultCardsError(
      "result-support-limit-conclusion-missing",
      `${card.id}: the low-speed argument does not establish ${conclusion.id}.`,
    );
  const needed = new Set(requirements.premises);
  return {
    kind: "checked-proof",
    proofId: declaration.proofId,
    title: "Follow the low-speed limit to the mass conclusion",
    href: "/papers/mass-energy/#me-low-speed-derivation",
    conclusion: { equationId: conclusion.id, title: conclusion.title },
    scope: declaration.scope,
    assumptions: proof.premises.filter((premise) => needed.has(premise.id)),
  };
}
