/**
 * Radiation and light-quanta reference physics types (am-ref-radiation-15c).
 * Conventions and quantity IDs follow am-not-quantity-registry-2f7.
 */

import type { ExecutionOutcome } from "../../../experiments/results/outcomes.ts";
import type {
  DomainKind,
  LimitRepresentation,
  ParameterAction,
} from "../../../experiments/results/types.ts";

/** Cyclic frequency (nu) in Hz (branded to prevent unit/frequency-kind confusion with angular frequency). */
export type CyclicFrequency = number & { readonly __brand?: "CyclicFrequencyHz" };

/** Angular frequency (omega = 2*pi*nu) in rad/s. */
export type AngularFrequency = number & { readonly __brand?: "AngularFrequencyRadS" };

/** Wavelength (lambda) in metres. */
export type Wavelength = number & { readonly __brand?: "WavelengthM" };

/** Temperature (T) in Kelvin. */
export type Temperature = number & { readonly __brand?: "TemperatureK" };

export function asCyclicFrequency(nu: number): CyclicFrequency {
  return nu as CyclicFrequency;
}

export function asAngularFrequency(omega: number): AngularFrequency {
  return omega as AngularFrequency;
}

export function asWavelength(lambda: number): Wavelength {
  return lambda as Wavelength;
}

export function asTemperature(T: number): Temperature {
  return T as Temperature;
}

/** Linear representability flag and log-space representation fields. */
export type DensityRepresentation = Readonly<{
  linearRepresentable: boolean;
  /** Natural logarithm of linear SI value, ln(u_nu) or ln(u_lambda). */
  logValue?: number | undefined;
  /** Base-10 logarithm of linear SI value, log10(u_nu) or log10(u_lambda). */
  log10Value?: number | undefined;
}>;

export type QuantityStatus =
  | "value"
  | "outside-domain"
  | "not-applicable"
  | "analytic-limit"
  | "symbolic"
  | "divergent"
  | "underdetermined";

export type RadiationOkResult<T> = Readonly<{
  status: "value";
  value: T;
  quantityId: string;
  unit: string;
  linearRepresentable: boolean;
  logFrequencyEnergyDensity?: number | undefined;
  log10FrequencyEnergyDensity?: number | undefined;
  logWavelengthEnergyDensity?: number | undefined;
  log10WavelengthEnergyDensity?: number | undefined;
  lnW?: number | undefined;
  log10W?: number | undefined;
  historicalStatus?: string | undefined;
}>;

export type RadiationOutsideDomain = Readonly<{
  status: "outside-domain";
  quantityId: string;
  unit: string;
  condition: string;
  domainKind: DomainKind;
  reason: string;
  boundary?: ParameterAction | Readonly<{ alternativeModel: string }> | undefined;
}>;

export type RadiationAnalyticLimit<T = number> = Readonly<{
  status: "analytic-limit";
  quantityId: string;
  unit: string;
  value: T;
  description: string;
  representation: LimitRepresentation;
}>;

export type RadiationSymbolic = Readonly<{
  status: "symbolic";
  quantityId: string;
  unit: string;
  expressionRef: string;
  unspecifiedSymbols: readonly string[];
}>;

export type RadiationNotApplicable = Readonly<{
  status: "not-applicable";
  quantityId: string;
  unit: string;
  reason: string;
}>;

export type RadiationResult<T> =
  | RadiationOkResult<T>
  | RadiationOutsideDomain
  | RadiationAnalyticLimit<T>
  | RadiationSymbolic
  | RadiationNotApplicable;

export type SpectralRegime = "wien" | "rayleigh-jeans" | "intermediate";

export type RegimeReport = Readonly<{
  x: number;
  wienRelativeError: number;
  rayleighJeansRelativeError: number;
  regime: SpectralRegime;
  wienAdmitted: boolean;
  rayleighJeansAdmitted: boolean;
  wienBoundaryX: number;
  rayleighJeansBoundaryX: number;
}>;

export type Rational = Readonly<{
  numerator: bigint;
  denominator: bigint;
}>;

export type BinomialTerm = Readonly<{
  k: number;
  exactProbability: Rational;
  probability: number;
}>;

export type BinomialDistribution = Readonly<{
  n: number;
  f: number;
  terms: readonly BinomialTerm[];
}>;

export type EnumerationOutcome =
  | Readonly<{
      status: "value";
      n: number;
      cells: number;
      totalConfigurations: number;
      favorableConfigurations: number;
      probability: number;
    }>
  | Readonly<{
      status: "execution-outcome";
      outcome: ExecutionOutcome;
    }>;

export type SeededPointSamplingResult = Readonly<{
  n: number;
  f: number;
  trials: number;
  successCount: number;
  sampleFraction: number;
  drawCountBefore: number;
  drawCountAfter: number;
  streamKernelId: number;
  allocationId: string;
  seed: string;
}>;

export type AvogadroReadout = Readonly<{
  status: "value";
  avogadroConstant: number;
  printedAvogadroConstant: number;
  hydrogenAtomMassGrams: number;
  printedHydrogenAtomMassGrams: number;
  unroundedHydrogenAtomMassGrams: number;
  rOverN: number;
  printedROverN: number;
  unroundedROverN: number;
  markers: Readonly<
    Record<string, { printedStatus: string; sensitivity?: string; reason?: string }>
  >;
  modernComparisons: Readonly<{
    modernAvogadro: number;
    modernReciprocalGram: number;
    modernHydrogenAtomMassGrams: number;
    modernBoltzmannConstant: number;
  }>;
}>;

export type MeanQuantumEnergyWienResult = Readonly<{
  status: "value";
  meanQuantumEnergyWien: number;
  meanQuantumEnergyWienEv: number;
  meanResonatorEnergy: number;
  meanResonatorEnergyEv: number;
  moleculeKineticEnergyEv: number;
  ratioToMoleculeKinetic: number;
  ratioAt600THz: number;
}>;

export type BandLimitedMeanQuantumEnergyResult =
  | Readonly<{
      status: "value";
      modelStatus: "editorial-variant";
      meanQuantumEnergyWien: number;
      meanQuantumEnergyWienEv: number;
      xMin: number;
      xMax: number;
      wienAdmittedBoundaryX: number;
      energyShareBelowBoundary: number;
      countShareBelowBoundary: number;
    }>
  | RadiationOutsideDomain;

export type WaveParameters = Readonly<{
  amplitude: number;
  wavelength: number;
  direction?: number | undefined;
  position?: readonly [number, number] | readonly [number, number, number] | undefined;
  phase?: number | undefined;
}>;

export type TwoSourceParameters = Readonly<{
  A1: number;
  A2: number;
  r1: number;
  r2: number;
  wavelength: number;
  delta?: number | undefined;
  readout?: "time-average" | "instantaneous" | undefined;
  t?: number | undefined;
  kappa?: number | undefined;
}>;

export type TwoSourceIntensityResult = Readonly<{
  status: "value";
  intensity: number;
  readoutKind: "time-average" | "instantaneous";
  normalized: boolean;
  delta: number;
  unit: string;
  modelNote: string;
}>;

export type ShellPowerResult = Readonly<{
  status: "value";
  enclosedPower: number;
  expectedPower: number;
  relativeDifference: number;
}>;

export type AperturePowerResult = Readonly<{
  status: "value";
  smallAperturePower: number;
  exactDiskPower: number;
  relativeDifference: number;
  r: number;
  apertureArea: number;
}>;
