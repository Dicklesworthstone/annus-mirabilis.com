import { fileURLToPath } from "node:url";
import { computeBm02Snapshot, DEFAULT_BM02_INPUTS } from "../../experiments/bm02/session.ts";
import { createBm08Session } from "../../experiments/bm08/session.ts";
import {
  declaredDomains,
  refuseOutsideDeclaredDomain,
} from "../../experiments/controls/declaredDomain.ts";
import { computeLq02Snapshot } from "../../experiments/lq02/session.ts";
import { LQ05_DEFAULTS } from "../../experiments/lq05/definition.ts";
import { evaluateLq05 } from "../../experiments/lq05/session.ts";
import { LQ06_DEFAULTS } from "../../experiments/lq06/definition.ts";
import { lq06Outputs } from "../../experiments/lq06/session.ts";
import { LQ07_DEFAULTS } from "../../experiments/lq07/definition.ts";
import { evaluateLq07 } from "../../experiments/lq07/session.ts";
import { LQ08_DEFAULTS } from "../../experiments/lq08/definition.ts";
import { evaluateLq08 } from "../../experiments/lq08/session.ts";
import { ME01_DEFAULTS } from "../../experiments/me01/definition.ts";
import { snapshotOutputs as me01SnapshotOutputs } from "../../experiments/me01/session.ts";
import { ME03_DEFAULTS } from "../../experiments/me03/definition.ts";
import { snapshotOutputs as me03SnapshotOutputs } from "../../experiments/me03/session.ts";
import { SR01_DEFAULTS } from "../../experiments/sr01/definition.ts";
import { snapshotOutputs as sr01SnapshotOutputs } from "../../experiments/sr01/session.ts";
import { SR02_DEFAULTS } from "../../experiments/sr02/definition.ts";
import { snapshotOutputs as sr02SnapshotOutputs } from "../../experiments/sr02/session.ts";
import { SR05_DEFAULTS } from "../../experiments/sr05/definition.ts";
import { evaluateSr05 } from "../../experiments/sr05/session.ts";
import { SR09_DEFAULTS } from "../../experiments/sr09/definition.ts";
import { snapshotOutputs as sr09SnapshotOutputs } from "../../experiments/sr09/session.ts";
import { SR11_DEFAULTS } from "../../experiments/sr11/definition.ts";
import { snapshotOutputs as sr11SnapshotOutputs } from "../../experiments/sr11/session.ts";
import bm08Example from "../../generated/bm08-example.json";
import { MODEL_DOMAINS } from "../../generated/model-domains.ts";
import {
  createDeclaredConstantSet,
  getConstantSet,
  thermalConstant,
} from "../../physics/reference/constants.ts";
import {
  configurationVolumeTerm,
  decayLengths,
  equilibriumBalance,
  stokesMobility,
} from "../../physics/reference/diffusion/routeA.ts";
import {
  kernelDiffusivity,
  kernelMoments,
  type StepKernel,
  type WalkKernel,
} from "../../physics/reference/diffusion/walkLaws.ts";
import {
  apparentSpeed,
  gaussianPropagator,
  intervalProbability,
  osmoticPressure,
  rmsDisplacement,
  stokesEinsteinD,
} from "../../physics/reference/diffusion.ts";
import {
  ELECTRON_MASS,
  acceleratingPotential as electronAcceleratingPotential,
  electricRadius as electronElectricRadius,
  kineticEnergy as electronKineticEnergy,
  magneticRadius as electronMagneticRadius,
  longitudinalMass,
  threePrintedRelations,
  transverseFieldTrajectory,
  transverseMassComoving,
  transverseMassLaboratory,
} from "../../physics/reference/electron.ts";
import {
  desynchronizationObserved,
  lightClock,
  measureRodLength,
  movingRodLegs,
  movingRodLightLegs,
  properTime,
  selectSimultaneousEndpoints,
  synchronizationRound,
} from "../../physics/reference/events.ts";
import {
  C_SI,
  dipoleField,
  ELEMENTARY_CHARGE,
  evaluateSr02,
  fieldInvariants,
  forceConsistency,
  fourCurrentInvariants,
  maxwellResidualsPlaneWave,
  movingSphereTotalCharge,
  transformChargeCurrent,
  transformSI,
} from "../../physics/reference/fields.ts";
import {
  chiSquareInterval,
  empiricalCoverageFraction,
  identifiabilityFamily,
  inverseBias,
  invertToMolecularNumber,
} from "../../physics/reference/inference.ts";
import {
  alignedBoost,
  composeCollinear,
  composedSpeedShortfall,
  contractedLength,
  desynchronization,
  dilatedInterval,
  dilationLossPerSecond,
  gamma,
  gammaMinusOne,
  rapidity,
  speedForDailyLoss,
  transformEvent,
} from "../../physics/reference/kinematics.ts";
import {
  evaluateMe02,
  evaluatePhotonBox,
  initializeMassEnergyLedger,
  printedMassConversion,
} from "../../physics/reference/massEnergy.ts";
import {
  ionizationCount,
  stoppingPotentialFromEv,
  stoppingPotentialMagnitude,
} from "../../physics/reference/photoelectric.ts";
import {
  classicalCutoffEnergyDensity,
  classicalTotalEnergy,
} from "../../physics/reference/radiation/classical.ts";
import { wienSpectralEntropyDensity } from "../../physics/reference/radiation/entropy.ts";
import { twoSourceIntensity } from "../../physics/reference/radiation/waves.ts";
import {
  aperturePower,
  bandLimitedMeanQuantumEnergyWien,
  independentPointsProbability,
  meanQuantumEnergyWien,
  planckBandEnergyDensity,
  planckFrequencyEnergyDensity,
} from "../../physics/reference/radiation.ts";
import {
  fizeauFringeShift,
  fresnelDraggedSpeed,
  michelsonMorleyFringeShift,
  relativisticDraggedSpeed,
  waveEquationResidual,
} from "../../physics/reference/shelfOptics.ts";
import {
  aberration,
  aberrationAngleFromSpeedRatio,
  dopplerFactor,
  lightComplexFactors,
  lightComplexMaterialContractionCountermodel,
  lightComplexVolumeNumeric,
  mirrorFrameLedger,
  modernEarthOrbitAberration,
  movingMirror,
  secondOrderShift,
} from "../../physics/reference/waves.ts";
import {
  conductorFrameEmf,
  fresnelDraggedIncrement,
  halfScale,
  magnetFrameEmf,
  relativisticDraggedIncrement,
  rootTwoScale,
  timesTwoClosed,
  timesTwoFromAdd,
} from "../scenario-fixtures/evaluator.ts";
import { timesTwoWrapper } from "../scenario-fixtures/evaluatorWrapper.ts";

export type OwnerContext = Readonly<{
  inputs: Record<string, number>;
  constantSetId: string;
}>;
/**
 * WHAT AN OWNER MAY SAY WHEN IT WILL NOT GIVE A NUMBER (am-nxbq, dispatch 304). Until now an owner
 * returned numbers or threw, so a model that refuses, which is the one thing AGENTS.md makes
 * mandatory for an acceptance case, had nowhere to be recorded: `diffusionRms` threw away
 * `stokes-gas-medium` as "stokesEinsteinD did not return a value". A refusal returned this way is
 * compared against the scenario's own `expected.status`, which the schema has always declared and
 * nothing read.
 *
 * The three fields are the ones the schema names: the output that was refused, the typed result
 * status, and the reason code, which for a refusal is a code in the refusal registry.
 */
export type OwnerRefusal = Readonly<{
  refused: Readonly<{ outputId: string; status: string; reasonCode: string }>;
}>;

export type OwnerResult = Record<string, number> | OwnerRefusal;

/** Whether an owner refused rather than returning numbers. */
export function isOwnerRefusal(result: OwnerResult): result is OwnerRefusal {
  return typeof result === "object" && result !== null && "refused" in result;
}

/**
 * SYNCHRONOUS, AND WIDENING IT IS NOT A LOCAL CHANGE (am-nxbq).
 *
 * BM-05 is the one instrument whose typed non-numeric case no scenario can reach, and this type is why.
 * Its case is real and reader-reachable: `src/workers/operations/bm05.ts` at `p.n === 0` reports five
 * outputs as not-applicable together, with the reason that before any steps there is a point mass rather
 * than a finite-width Gaussian comparison, and the `n` control's declared range starts at 0. It is the
 * same physics as bm-06's t = 0 limit, which IS a scenario. But reaching it means `measureBm05`, which is
 * async and needs a `WalkRecording` from `createBm05Recording`, and no synchronous owner can await one.
 * The prepared-example shape that worked for bm-08 does not help, because bm-05's arrival example carries
 * no non-value output.
 *
 * WHAT THE WIDENING COSTS, measured rather than guessed, because I first asserted it without checking.
 * Allowing `OwnerResult | Promise<OwnerResult>` here is backward compatible on its own: a synchronous
 * owner still satisfies the union. What is not backward compatible is the RUNNER.
 * `runLoadedScenarios` in run.ts is synchronous, returning a plain object and calling `runOne` in a plain
 * loop, so it and `runOne` would both become async and every call site that consumes them would need to
 * await, including scripts/run-scenarios.ts, `runScenariosIsolated`, and the scenario test files.
 *
 * That is one unit of work with a real blast radius, not a line to slip into another change, which is why
 * bm-05 is recorded as open rather than closed with an invented scenario.
 */
export type OwnerFn = (ctx: OwnerContext) => OwnerResult;
export type OwnerRecord = Readonly<{
  id: string;
  fn: OwnerFn;
  sourcePath: string;
}>;

const C = 299792458;
const evaluatorPath = fileURLToPath(new URL("../scenario-fixtures/evaluator.ts", import.meta.url));
const wrapperPath = fileURLToPath(
  new URL("../scenario-fixtures/evaluatorWrapper.ts", import.meta.url),
);
const diffusionPath = fileURLToPath(
  new URL("../../physics/reference/diffusion/distributions.ts", import.meta.url),
);
const walkLawsPath = fileURLToPath(
  new URL("../../physics/reference/diffusion/walkLaws.ts", import.meta.url),
);
const kinematicsPath = fileURLToPath(
  new URL("../../physics/reference/kinematics.ts", import.meta.url),
);
const eventsPath = fileURLToPath(new URL("../../physics/reference/events.ts", import.meta.url));
const fieldsPath = fileURLToPath(new URL("../../physics/reference/fields.ts", import.meta.url));
const electronPath = fileURLToPath(new URL("../../physics/reference/electron.ts", import.meta.url));
const shelfOpticsPath = fileURLToPath(
  new URL("../../physics/reference/shelfOptics.ts", import.meta.url),
);

function num(inputs: Record<string, number>, key: string): number {
  const value = inputs[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Owner input "${key}" is missing or nonfinite.`);
  }
  return value;
}

function printedBrownianSet() {
  return createDeclaredConstantSet({
    id: "scenario-einstein-1905-brownian-printed",
    era: 1905,
    provenance:
      "Declared editorial inputs matching Einstein 1905 printed R and N. Reserved historical set einstein-1905-brownian-printed is not registered (am-ref-constants-xik).",
    precisionNote: "Printed-era declared inputs, not 2019 SI definitions.",
    gasConstantProvenance: "measured-without-counting-molecules",
    entries: [
      {
        quantityId: "molarGasConstant",
        value: 8.31,
        exactDecimal: "8.31",
        unit: "J/(mol K)",
        kind: "declared-scenario",
        evidentialRole: "measured-observation",
        provenance: "Paper 2 does not print R; editorial input 8.31 J mol^-1 K^-1.",
        dependsOn: [],
        uncertainty: 0.005,
      },
      {
        quantityId: "avogadroConstant",
        value: 6e23,
        exactDecimal: "6e23",
        unit: "1/mol",
        kind: "declared-scenario",
        evidentialRole: "measured-observation",
        provenance: "Paper 2 printed N = 6e23 mol^-1.",
        dependsOn: [],
        uncertainty: 1e22,
      },
    ],
  });
}

/**
 * am-bm-05-random-steps-ntzl: a symmetric, unbiased step kernel (coin, uniform, or Gaussian),
 * so kernelDiffusivity's mean is always 0 and diffusion is always a "value" (never
 * outside-domain). `kernel` is encoded numerically (0 coin, 1 uniform, 3 gaussian), reusing
 * WALK_KERNELS' own export-kernel-id numbering (src/physics/reference/diffusion/walkLaws.ts),
 * the same convention content/experiments/tapes/coin-to-bell.yaml uses, because OwnerContext's
 * inputs are Record<string, number> and Bm05Parameters' kernel field is not.
 */
function walkKernelDiffusivity(ctx: OwnerContext): Record<string, number> {
  const kernelCode = num(ctx.inputs, "kernel");
  const kind: WalkKernel = kernelCode === 0 ? "coin" : kernelCode === 1 ? "uniform" : "gaussian";
  const stepRms = num(ctx.inputs, "stepRms");
  const tau = num(ctx.inputs, "tau");
  const moments = kernelMoments({ kind, stepRms });
  const diffusivity = kernelDiffusivity({ kind, stepRms }, tau);
  if (moments.secondMoment.status !== "value" || typeof moments.secondMoment.value !== "number") {
    throw new Error("kernelMoments did not return a second moment value.");
  }
  if (moments.fourthMoment.status !== "value" || typeof moments.fourthMoment.value !== "number") {
    throw new Error("kernelMoments did not return a fourth moment value.");
  }
  if (diffusivity.diffusion.status !== "value" || typeof diffusivity.diffusion.value !== "number") {
    throw new Error("kernelDiffusivity did not return a diffusion value for a symmetric kernel.");
  }
  return {
    stepSecondMoment: moments.secondMoment.value,
    stepFourthMoment: moments.fourthMoment.value,
    diffusionCoefficient: diffusivity.diffusion.value,
  };
}
/**
 * am-bm-06-gaussian-spread-982y: the Gaussian interval probability at t > 0, D > 0 (always
 * "value" status; the t = 0 / D = 0 analytic-limit point-mass case is proven directly against
 * gaussianPropagator/intervalProbability by src/testing/diffusion.*.test.ts files, not through
 * this OwnerFn, which returns Record<string, number> and cannot represent a non-numeric status).
 */
function gaussianIntervalProbability(ctx: OwnerContext): Record<string, number> {
  const D = num(ctx.inputs, "diffusionCoefficient");
  const t = num(ctx.inputs, "elapsedTime");
  const x1 = num(ctx.inputs, "lower");
  const x2 = num(ctx.inputs, "upper");
  const p = intervalProbability(x1, x2, t, D);
  if (p.result.status !== "value" || typeof p.result.value !== "number") {
    throw new Error("intervalProbability did not return a value.");
  }
  return { intervalProbability: p.result.value };
}
/**
 * BM-02's osmotic pressure, and the refusal it gives for an inadmissible input (am-nxbq, dispatch
 * 304). The reference evaluator refuses a temperature at or below zero, which is a value a reader
 * can set from the instrument's own temperature control, and this carries that refusal out where a
 * scenario's `expected.status` can be compared against it.
 */
/**
 * A caller of `nonNumericOr` that named the wrong key, carried as a code rather than a bare throw.
 *
 * Typed for two reasons. The bare-throw ratchet refused the first version, correctly: a throw with no
 * code is invisible to the refusal ratchet, so nothing could tell whether this guard was ever
 * exercised. And the condition is a CONTRACT error rather than a model result, so it must not be
 * mistakable for one of the typed statuses the adapter exists to carry.
 */
export type OwnerContractCode =
  /** A laboratory session asked for a worker where the arrival snapshot should need none. */
  | "owner-session-wants-a-worker"
  | "owner-value-key-unnamed"
  | "owner-assessment-without-data"
  /** A session returned its outputs and the one this owner reads is not among them. */
  | "owner-session-output-absent"
  /** Two registry entries claim one id, so a scenario naming it gets whichever the Map kept. */
  | "owner-id-duplicated";

export class OwnerContractError extends Error {
  readonly code: OwnerContractCode;
  constructor(code: OwnerContractCode, message: string) {
    super(message);
    this.name = "OwnerContractError";
    this.code = code;
  }
}

/**
 * A REFERENCE EVALUATION, TURNED INTO THE OWNER PROTOCOL WITHOUT LOSING ITS STATUS (am-nxbq, item 2).
 *
 * The evaluators return a typed `ScientificResult`: `value` with a number, or one of the non-numeric
 * statuses AGENTS.md tabulates -- `analytic-limit`, `underdetermined`, `not-applicable`,
 * `outside-domain`, `symbolic`, `divergent`. Owners mostly THREW those away ("apparentSpeed did not
 * return a value"), which is why 32 of 33 instruments had no resolvable non-numeric acceptance case
 * while their own evaluators produce them: the information existed and had nowhere to go.
 *
 * The reason code is read from the result itself, preferring the most specific thing it carries: the
 * `condition` a domain refusal states, then the `kind` of representation a limit offers (`point-mass`,
 * `coefficient`), then the status. Never a string this file invents, so a scenario pins what the
 * evaluator said and not a label added on the way past.
 */
export function nonNumericOr(
  result: Readonly<Record<string, unknown>>,
  outputId: string,
  /** The key the accepted number sits under, where it is not `value` (events puts it in its own). */
  valueKey = "value",
): OwnerRefusal | number {
  const accepted = result[valueKey];
  if (result.status === "value") {
    // A "value" result whose number is under a key this caller did not name is a CALLER error, and
    // saying so is the whole point: the first version returned the refusal branch here, which produced
    // `{refused: {status: "value"}}` -- a refusal claiming to be a value, which no scenario could
    // sensibly expect and which would have read as a working non-numeric case.
    if (typeof accepted !== "number")
      throw new OwnerContractError(
        "owner-value-key-unnamed",
        `${outputId}: the evaluator returned status "value" and no number under "${valueKey}". ` +
          "Name the key the accepted number sits under.",
      );
    return accepted;
  }
  const representation = result.representation;
  const kind =
    representation && typeof representation === "object" && "kind" in representation
      ? String((representation as { kind: unknown }).kind)
      : undefined;
  return {
    refused: {
      outputId,
      status: String(result.status),
      reasonCode:
        "condition" in result && result.condition !== undefined
          ? String(result.condition)
          : (kind ?? String(result.status)),
    },
  };
}

/**
 * ONE LABORATORY SESSION'S OUTPUT, BY ITS QUANTITY ID (am-nxbq, item 2).
 *
 * Several instruments state their non-numeric result in the SESSION rather than in a reference evaluator,
 * because the statement is the laboratory's rather than the physics': that the one-way light speed is a
 * convention, that free radiation is assigned no rest mass, that a model with no circuit has no current.
 * Measured on am-nxbq, most of the instruments still without a non-numeric acceptance case are in that
 * position, so this is the shape they follow.
 *
 * BY QUANTITY ID, NEVER BY POSITION. A session returns a list, and a list's order is not a contract; an
 * owner reading `outputs[9]` would silently follow whatever moved there. An absent id is a typed contract
 * error rather than an undefined, so a renamed output says so instead of producing nothing.
 */
function sessionOutput<P>(
  snapshot: (p: P) => readonly unknown[],
  defaults: P,
  ctx: OwnerContext,
  quantityId: string,
): OwnerResult {
  // Delegated rather than repeated, and the reason is a gate rather than taste: the two functions each
  // carried their own `owner-session-output-absent` throw, which put one code at two sites, and the
  // refusal ratchet credits a code only where EVERY site carrying it is cited. One site is the honest
  // fix, since the condition is the same one.
  return sessionOutputsOf(snapshot({ ...defaults, ...ctx.inputs }), quantityId);
}

/**
 * One output of an already-evaluated snapshot, by its quantity id.
 *
 * `sessionOutput` merges defaults and calls the session itself; some sessions take their parameters
 * differently or return a record with an `outputs` list beside other fields, and this is the half that
 * reads such a list. The id lookup and the contract error are the same, for the reason given there: a
 * list's order is not a contract.
 */
export function sessionOutputsOf(outputs: readonly unknown[], quantityId: string): OwnerResult {
  const found = outputs.find(
    (o) => (o as { quantityId?: string } | null)?.quantityId === quantityId,
  );
  if (!found)
    throw new OwnerContractError(
      "owner-session-output-absent",
      `${quantityId}: the snapshot carried ${outputs.length} output(s) and none of them is it.`,
    );
  const got = nonNumericOr(found as Record<string, unknown>, quantityId);
  return typeof got === "number" ? { [quantityId]: got } : got;
}

/**
 * THE INFERENCE FAMILY'S RESULT SHAPE, WHICH IS A DIFFERENT ONE (am-nxbq, item 2).
 *
 * `src/physics/reference/inference*` does not return a `ScientificResult`. It returns an `Assessment`:
 * `{kind: "accepted", data}` or `{kind: "no-value", status, reason}`, where the status is one of
 * `underdetermined`, `not-applicable` and `outside-domain`. `nonNumericOr` cannot read it, because an
 * accepted assessment carries no `status` field at all and would therefore look non-numeric -- the exact
 * shape of error the guard in that function exists to catch, one layer out.
 *
 * So this is its own adapter rather than a widened one. The reason code is the status, for the same
 * reason as the prose-only cases: an assessment carries a sentence rather than a code, and pinning the
 * sentence would make rewording it turn a scenario red.
 */
export function assessmentOr<T>(
  assessment: Readonly<{ kind: string; status?: string; reason?: string; data?: T }>,
  outputId: string,
  pick: (data: T) => number,
): OwnerRefusal | number {
  if (assessment.kind === "accepted") {
    if (assessment.data === undefined)
      throw new OwnerContractError(
        // ITS OWN CODE, not the one above. The two conditions are different -- a number under a key the
        // caller did not name, and an accepted assessment with nothing in it -- and the refusal ratchet
        // credits a code only where every site carrying it is cited, so sharing one made BOTH invisible.
        "owner-assessment-without-data",
        `${outputId}: the assessment was accepted and carries no data to read.`,
      );
    return pick(assessment.data);
  }
  return {
    refused: {
      outputId,
      status: String(assessment.status ?? "no-value"),
      reasonCode: String(assessment.status ?? "no-value"),
    },
  };
}

function osmoticPressureOwner(ctx: OwnerContext): OwnerResult {
  const set =
    ctx.constantSetId === "modern-si-2019"
      ? getConstantSet("modern-si-2019")
      : printedBrownianSet();
  const evaluation = osmoticPressure(
    { n: num(ctx.inputs, "numberDensity"), T: num(ctx.inputs, "temperature") },
    set,
  );
  if (evaluation.result.status !== "value" || typeof evaluation.result.value !== "number")
    return {
      refused: {
        outputId: "osmoticPressure",
        status: evaluation.result.status,
        reasonCode:
          "condition" in evaluation.result
            ? String(evaluation.result.condition)
            : evaluation.result.status,
      },
    };
  return { osmoticPressure: evaluation.result.value };
}

/**
 * LQ-02's snapshot, from the laboratory's own session (am-nxbq, item 1).
 *
 * The three controls are read from the scenario rather than defaulted, because every LQ-02 case turns
 * on one of them: the cutoff is what makes the total finite, the probe is what can be asked for above
 * the cutoff, and the temperature is what can be asked for at zero.
 */
function lq02Snapshot(ctx: OwnerContext) {
  return computeLq02Snapshot({
    T: num(ctx.inputs, "T"),
    nuCutoff: num(ctx.inputs, "nuCutoff"),
    probeFrequency: num(ctx.inputs, "probeFrequency"),
    constantSetId: "modern-si-2019",
  });
}

/** One named field of that snapshot, keeping its typed status rather than throwing it away. */
function lq02Field(
  ctx: OwnerContext,
  field:
    | "meanResonatorEnergy"
    | "energyUpToCutoff"
    | "energyUpToProbe"
    | "shareAboveProbe"
    | "tenfoldWidenedEnergy",
): OwnerResult {
  const got = nonNumericOr(lq02Snapshot(ctx)[field] as unknown as Record<string, unknown>, field);
  return typeof got === "number" ? { [field]: got } : got;
}

/**
 * BM-02's partition, from the laboratory's own session (am-nxbq, item 1).
 *
 * THE MODEL IS AN INPUT AND IT IS ENCODED AS A NUMBER, because an owner takes numeric inputs only:
 * 0 is the molecular-kinetic model and 1 is classical thermodynamics of suspended bodies, which is a
 * labelled ALTERNATIVE rather than a wrong answer and predicts zero pressure. Encoding a model choice
 * the way bm-05 encodes its step kernel keeps the two readings comparable in one scenario family.
 *
 * All five outputs come back together when they are values, because the laboratory's claim is the chain:
 * a number density gives a pressure, the pressure gives a force on a stated area, and the force gives a
 * head of liquid. A scenario pinning the pressure alone would pass while the area was being misapplied.
 */
function bm02Partition(ctx: OwnerContext): OwnerResult {
  const snapshot = computeBm02Snapshot({
    ...DEFAULT_BM02_INPUTS,
    Np: num(ctx.inputs, "Np"),
    V_um3: num(ctx.inputs, "V_um3"),
    T: num(ctx.inputs, "T"),
    a_um: num(ctx.inputs, "a_um"),
    A_um2: num(ctx.inputs, "A_um2"),
    model:
      num(ctx.inputs, "model") === 1
        ? "classical-thermodynamics-suspended-bodies"
        : "molecular-kinetic",
  });
  const numbers: Record<string, number> = {};
  for (const field of [
    "numberDensity",
    "volumeFraction",
    "osmoticPressure",
    "partitionForce",
    "hydrostaticHead",
  ] as const) {
    const held = snapshot[field] as unknown as { result?: unknown };
    const record = (held.result ?? held) as Record<string, unknown>;
    const got = nonNumericOr(record, field);
    if (typeof got !== "number") return got;
    numbers[field] = got;
  }
  return numbers;
}

function diffusionRms(ctx: OwnerContext): OwnerResult {
  const set =
    ctx.constantSetId === "modern-si-2019"
      ? getConstantSet("modern-si-2019")
      : printedBrownianSet();
  const D = stokesEinsteinD(
    {
      T: num(ctx.inputs, "temperature"),
      eta: num(ctx.inputs, "viscosity"),
      a: num(ctx.inputs, "particleRadius"),
    },
    set,
  );
  if (D.result.status !== "value" || typeof D.result.value !== "number") {
    // The model refused, and the code it refused with is the thing an acceptance case is for.
    return {
      refused: {
        outputId: "diffusionCoefficient",
        status: D.result.status,
        reasonCode: "condition" in D.result ? String(D.result.condition) : D.result.status,
      },
    };
  }
  const rms = rmsDisplacement(D.result.value, num(ctx.inputs, "elapsedTime"));
  if (rms.result.status !== "value" || typeof rms.result.value !== "number") {
    throw new Error("rmsDisplacement did not return a value.");
  }
  return { diffusionCoefficient: D.result.value, rmsDisplacement1d: rms.result.value };
}

const OWNERS: OwnerRecord[] = [
  {
    id: "selfTest.timesTwoClosed",
    sourcePath: evaluatorPath,
    fn: (ctx) => ({ value: timesTwoClosed(num(ctx.inputs, "x")) }),
  },
  {
    id: "selfTest.timesTwoFromAdd",
    sourcePath: evaluatorPath,
    fn: (ctx) => ({ value: timesTwoFromAdd(num(ctx.inputs, "x")) }),
  },
  {
    id: "selfTest.timesTwoWrapper",
    sourcePath: wrapperPath,
    fn: (ctx) => ({ value: timesTwoWrapper(num(ctx.inputs, "x")) }),
  },
  {
    id: "selfTest.identityRatio",
    sourcePath: evaluatorPath,
    fn: (ctx) => {
      const a = apparentSpeed(num(ctx.inputs, "D"), num(ctx.inputs, "tau"));
      const b = apparentSpeed(num(ctx.inputs, "D"), num(ctx.inputs, "tau") / 4);
      if (a.result.status !== "value" || b.result.status !== "value") {
        throw new Error("apparentSpeed did not return a value.");
      }
      return { ratio: (b.result.value as number) / (a.result.value as number) };
    },
  },
  {
    id: "selfTest.identityExponent",
    sourcePath: evaluatorPath,
    fn: () => ({ ratio: 2 }),
  },
  {
    id: "selfTest.rootTwoScale",
    sourcePath: evaluatorPath,
    fn: (ctx) => ({ rmsDisplacement1d: rootTwoScale(num(ctx.inputs, "baselineRms")) }),
  },
  {
    id: "selfTest.halfScale",
    sourcePath: evaluatorPath,
    fn: (ctx) => ({ rmsDisplacement1d: halfScale(num(ctx.inputs, "baselineRms")) }),
  },
  {
    id: "selfTest.constant",
    sourcePath: evaluatorPath,
    fn: (ctx) => ({ value: num(ctx.inputs, "value") }),
  },
  {
    id: "selfTest.magnetFrameEmf",
    sourcePath: evaluatorPath,
    fn: (ctx) => ({
      emf: magnetFrameEmf(num(ctx.inputs, "B"), num(ctx.inputs, "v"), num(ctx.inputs, "ell")),
    }),
  },
  {
    id: "selfTest.conductorFrameEmf",
    sourcePath: evaluatorPath,
    fn: (ctx) => ({
      emf: conductorFrameEmf(num(ctx.inputs, "B"), num(ctx.inputs, "v"), num(ctx.inputs, "ell"), C),
    }),
  },
  {
    id: "selfTest.fresnelDrag",
    sourcePath: evaluatorPath,
    fn: (ctx) => ({
      increment: fresnelDraggedIncrement(num(ctx.inputs, "n"), num(ctx.inputs, "flow")),
    }),
  },
  {
    id: "selfTest.relativisticDrag",
    sourcePath: evaluatorPath,
    fn: (ctx) => ({
      increment: relativisticDraggedIncrement(num(ctx.inputs, "n"), num(ctx.inputs, "flow"), C),
    }),
  },
  {
    id: "diffusion.stokesEinsteinRms",
    sourcePath: diffusionPath,
    fn: diffusionRms,
  },
  /**
   * THE OSMOTIC PARTITION, WHOLE (am-nxbq, item 1).
   *
   * BM-02 asks whether suspended particles press on a partition the way dissolved molecules do, and
   * whether their SIZE changes that pressure at the same number per volume. Both halves need the same
   * owner: the pressure comes from the number density and the volume fraction comes from the radius, so
   * only a reading that carries both can show that doubling the radius moves one and not the other.
   */
  {
    id: "diffusion.bm02Partition",
    sourcePath: fileURLToPath(new URL("../../experiments/bm02/session.ts", import.meta.url)),
    fn: bm02Partition,
  },
  {
    id: "diffusion.osmoticPressure",
    sourcePath: diffusionPath,
    fn: osmoticPressureOwner,
  },
  {
    id: "diffusion.walkKernelDiffusivity",
    sourcePath: walkLawsPath,
    fn: walkKernelDiffusivity,
  },
  {
    id: "diffusion.gaussianIntervalProbability",
    sourcePath: diffusionPath,
    fn: gaussianIntervalProbability,
  },
  /**
   * THE SPREADING CURVE, INCLUDING AT t = 0 WHERE IT IS NOT A CURVE (am-nxbq, item 2).
   *
   * AGENTS.md names this case in its own table of typed results: "The point distribution at t = 0" is
   * an `analytic-limit`, not a value and not an error. `gaussianPropagator` returns it with a
   * representation of kind `point-mass`, and until now no owner could report that: the density would
   * have been a division by zero and an owner that threw would have read as a broken evaluator.
   */
  {
    id: "diffusion.gaussianPropagator",
    sourcePath: diffusionPath,
    fn: (ctx) => {
      const evaluation = gaussianPropagator(
        num(ctx.inputs, "x"),
        num(ctx.inputs, "elapsedTime"),
        num(ctx.inputs, "diffusionCoefficient"),
      );
      const got = nonNumericOr(
        evaluation.result as unknown as Record<string, unknown>,
        "probabilityDensity",
      );
      return typeof got === "number" ? { probabilityDensity: got } : got;
    },
  },
  /**
   * THE GAS CARD, WHICH THE LIQUID STOKES MODEL REFUSES (am-nxbq, item 2).
   *
   * AGENTS.md names this case by name: "a gas card refuses because Stokes drag without the Cunningham
   * slip correction is invalid when the mean free path is comparable to the radius". `stokesEinsteinD`
   * states it as `stokes-gas-medium`, an `outside-domain` result with a model domainKind rather than an
   * input one, and `diffusionRms` threw it away as "stokesEinsteinD did not return a value" -- which is
   * the defect that left the Brownian labs with no typed non-numeric case while their own evaluator
   * produced one.
   *
   * `medium` arrives as a number because the owner protocol carries numbers: 0 is the liquid the model
   * covers, anything else is a gas. The same encoding `massEnergy.box` uses for its own flag.
   */
  {
    id: "diffusion.stokesEinsteinTyped",
    sourcePath: diffusionPath,
    fn: (ctx) => {
      const set =
        ctx.constantSetId === "modern-si-2019"
          ? getConstantSet("modern-si-2019")
          : printedBrownianSet();
      const evaluation = stokesEinsteinD(
        {
          T: num(ctx.inputs, "temperature"),
          eta: num(ctx.inputs, "viscosity"),
          a: num(ctx.inputs, "radius"),
          medium: (ctx.inputs.medium ?? 0) === 0 ? "liquid" : "gas",
        },
        set,
      );
      const got = nonNumericOr(
        evaluation.result as unknown as Record<string, unknown>,
        "diffusionCoefficient",
      );
      return typeof got === "number" ? { diffusionCoefficient: got } : got;
    },
  },
  {
    id: "diffusion.apparentSpeedRatio",
    sourcePath: diffusionPath,
    /**
     * THE RATIO CARRIES A STATUS RATHER THAN THROWING IT AWAY (am-nxbq).
     *
     * This threw `new Error("apparentSpeed did not return a value.")` on either leg being non-numeric,
     * which turned a typed evaluation into a bare exception: a scenario driving it got a stack trace
     * instead of a comparable status, and the ratchet could not see the refusal either. The evaluator's
     * own domain condition for a non-positive interval is what a reader would reach, and it now arrives.
     *
     * Whichever leg refuses is reported, not a conflation of the two: they are different intervals, tau
     * and tau over four, and a reader told only "the ratio is unavailable" cannot tell which.
     */
    fn: (ctx) => {
      const D = num(ctx.inputs, "D");
      const tau = num(ctx.inputs, "tau");
      const a = apparentSpeed(D, tau);
      const b = apparentSpeed(D, tau / 4);
      // The two legs' numbers come back FROM the adapter rather than being read off the results again:
      // reading them twice is how a narrowed status and an unnarrowed value end up in one expression.
      const legs: number[] = [];
      for (const [leg, evaluation] of [
        ["apparentSpeedAtTau", a],
        ["apparentSpeedAtQuarterTau", b],
      ] as const) {
        const got = nonNumericOr(evaluation.result as unknown as Record<string, unknown>, leg);
        if (typeof got !== "number") return got;
        legs.push(got);
      }
      return { ratio: (legs[1] as number) / (legs[0] as number) };
    },
  },
  {
    id: "diffusion.apparentSpeedExponent",
    sourcePath: evaluatorPath,
    fn: () => ({ ratio: 2 }),
  },
  {
    id: "radiation.meanQuantumEnergyExtrapolation",
    sourcePath: fileURLToPath(new URL("../../physics/reference/radiation.ts", import.meta.url)),
    fn: (ctx) => {
      const set = getConstantSet(ctx.constantSetId || "modern-si-2019");
      const res = meanQuantumEnergyWien(num(ctx.inputs, "temperature"), set);
      return {
        meanQuantumEnergyWien: res.meanQuantumEnergyWien,
        ratioToMoleculeKinetic: res.ratioToMoleculeKinetic,
      };
    },
  },
  {
    id: "radiation.meanQuantumEnergyBand",
    sourcePath: fileURLToPath(new URL("../../physics/reference/radiation.ts", import.meta.url)),
    fn: (ctx) => {
      const set = getConstantSet(ctx.constantSetId || "modern-si-2019");
      const res = bandLimitedMeanQuantumEnergyWien(
        num(ctx.inputs, "temperature"),
        num(ctx.inputs, "xMin"),
        num(ctx.inputs, "xMax"),
        set,
      );
      if (res.status !== "value")
        throw new Error("bandLimitedMeanQuantumEnergyWien refused inputs.");
      return {
        meanQuantumEnergyWien: res.meanQuantumEnergyWien,
        energyShareBelowBoundary: res.energyShareBelowBoundary,
        countShareBelowBoundary: res.countShareBelowBoundary,
      };
    },
  },
  {
    id: "radiation.spectra",
    sourcePath: fileURLToPath(new URL("../../physics/reference/radiation.ts", import.meta.url)),
    fn: (ctx) => {
      const set = getConstantSet(ctx.constantSetId || "modern-si-2019");
      const nu = num(ctx.inputs, "frequency");
      const T = num(ctx.inputs, "temperature");
      const res = planckFrequencyEnergyDensity(nu, T, set);
      if (res.status !== "value") throw new Error("planckFrequencyEnergyDensity refused inputs.");
      return {
        frequencyEnergyDensity: res.value,
        logFrequencyEnergyDensity: res.logFrequencyEnergyDensity ?? 0,
      };
    },
  },
  {
    id: "radiation.bandEnergy",
    sourcePath: fileURLToPath(new URL("../../physics/reference/radiation.ts", import.meta.url)),
    fn: (ctx) => {
      const set = getConstantSet(ctx.constantSetId || "modern-si-2019");
      const res = planckBandEnergyDensity(
        num(ctx.inputs, "nuMin"),
        num(ctx.inputs, "nuMax"),
        num(ctx.inputs, "temperature"),
        set,
      );
      if (res.status !== "value") throw new Error("planckBandEnergyDensity refused inputs.");
      return {
        bandEnergy: res.value,
      };
    },
  },
  {
    id: "radiation.configurations",
    sourcePath: fileURLToPath(new URL("../../physics/reference/radiation.ts", import.meta.url)),
    fn: (ctx) => {
      const res = independentPointsProbability(num(ctx.inputs, "n"), num(ctx.inputs, "f"));
      return {
        configurationProbability: res.value,
        lnW: res.lnW,
        log10W: res.log10W,
      };
    },
  },
  {
    id: "radiation.waves",
    sourcePath: fileURLToPath(new URL("../../physics/reference/radiation.ts", import.meta.url)),
    fn: (ctx) => {
      const res = aperturePower({
        P: num(ctx.inputs, "P"),
        r: num(ctx.inputs, "r"),
        apertureArea: num(ctx.inputs, "apertureArea"),
      });
      if (res.status !== "value") throw new Error("aperturePower refused inputs.");
      return {
        smallAperturePower: res.value.smallAperturePower,
        exactDiskPower: res.value.exactDiskPower,
        relativeDifference: res.value.relativeDifference,
      };
    },
  },
  {
    id: "waves",
    sourcePath: fileURLToPath(new URL("../../physics/reference/waves.ts", import.meta.url)),
    fn: (ctx: OwnerContext) => {
      const out: Record<string, number> = {};
      const beta = ctx.inputs.beta;

      if (typeof ctx.inputs.speedRatio === "number") {
        out.aberrationAngleArcsec = aberrationAngleFromSpeedRatio(ctx.inputs.speedRatio);
      }

      if (typeof beta === "number") {
        if (typeof ctx.inputs.theta === "number") {
          const theta = ctx.inputs.theta;
          out.dopplerFactor = dopplerFactor(beta, theta);
          const ab = aberration(beta, theta);
          out.cosThetaPrime = ab.cosThetaPrime;
          out.sinThetaPrime = ab.sinThetaPrime;
          out.thetaPrimeRad = ab.thetaPrimeRad;
          out.thetaPrimeDeg = (ab.thetaPrimeRad * 180) / Math.PI;

          const lc = lightComplexFactors(beta, theta);
          out.amplitudeFactor = lc.amplitudeFactor;
          out.energyDensityFactor = lc.energyDensityFactor;
          out.volumeFactor = lc.volumeFactor;
          out.energyFactor = lc.energyFactor;
          out.numericVolumeFactor = lightComplexVolumeNumeric(beta, theta);

          const cm = lightComplexMaterialContractionCountermodel(beta, theta);
          out.countermodelFactor = cm.factor;
          out.countermodelVolumeFactor = cm.volumeFactor;
        }

        if (typeof ctx.inputs.phi === "number") {
          const phi = ctx.inputs.phi;
          const mm = movingMirror(beta, phi, {
            u: ctx.inputs.u ?? 1.0,
            c: ctx.inputs.c ?? 1.0,
            Am: ctx.inputs.Am ?? 1.0,
          });
          if (mm.status === "value") {
            out.frequencyRatio = mm.frequencyRatio;
            out.reflectedFrequencyRatio = mm.frequencyRatio;
            out.cosPhiReflected = mm.cosPhiReflected;
            out.phiReflectedRad = mm.phiReflectedRad;
            out.amplitudeRatio = mm.amplitudeRatio;
            out.radiationPressure = mm.radiationPressure;
            out.radiationForce = mm.radiationForce;
            out.incidentPower = mm.incidentPower;
            out.reflectedPower = mm.reflectedPower;
            out.workRate = mm.workRate;
            out.energyBalanceResidual = mm.energyBalanceResidual;
          }
        }

        if (typeof ctx.inputs.secondOrderSpeed === "number") {
          out.secondOrderShift = secondOrderShift(ctx.inputs.secondOrderSpeed);
        } else if (
          typeof beta === "number" &&
          ctx.inputs.theta === undefined &&
          ctx.inputs.phi === undefined
        ) {
          out.secondOrderShift = secondOrderShift(beta);
        }
      }

      return out;
    },
  },
  /**
   * THE STOPPING POTENTIAL, FROM THE EVALUATOR THAT OWNS IT (am-nxbq, am-muyh).
   *
   * THIS OWNER DID NOT CALL THE PHOTOELECTRIC EVALUATOR AT ALL. It computed h*nu/e inline from constants
   * written into the function body, which is the QUANTUM ENERGY in volts and not the stopping potential:
   * the work function was subtracted nowhere. Its sourcePath named radiation.ts, so "show the code"
   * pointed at a module that does not contain the calculation.
   *
   * MEASURED BEFORE AND AFTER, which is what made the repair safe to land. The one scenario on this owner,
   * photoelectric-einstein-1905-printed, supplies a work function of ZERO, because Einstein neglected P'
   * for the order-of-magnitude comparison and the scenario records that in its editorialInputs. At zero
   * the two agree exactly, 4.259737727831575 V against the printed "ca. 4,3 Volt", so the printed check is
   * unaffected. At a work function of 2 eV the evaluator gives 2.2597 V and the old owner still returned
   * 4.2597 V: it silently dropped the input. That is the defect, and it is why agreeing on one scenario
   * was never evidence that the owner computed the quantity it was named for.
   *
   * It carries a non-value status now rather than returning a number regardless, so the below-threshold
   * case is reachable here too.
   */
  {
    id: "photoelectric.stoppingPotentialMagnitude",
    sourcePath: fileURLToPath(new URL("../../physics/reference/photoelectric.ts", import.meta.url)),
    fn: (ctx) => {
      const result = stoppingPotentialMagnitude(
        num(ctx.inputs, "frequency"),
        typeof ctx.inputs.workFunction === "number" ? ctx.inputs.workFunction : 0,
      );
      const got = nonNumericOr(
        result as unknown as Record<string, unknown>,
        "stoppingPotentialMagnitude",
      );
      return typeof got === "number" ? { stoppingPotentialMagnitude: got } : got;
    },
  },
  /**
   * THE STOPPING POTENTIAL WHERE THERE IS NO ELECTRON TO STOP (am-nxbq, item 2).
   *
   * AGENTS.md's table of typed results names this case in its `not-applicable` row: "A stopping
   * potential when no electron is emitted". `kMax` returns exactly that below threshold, with the reason
   * "no emitted electron in this model", and `stoppingPotentialMagnitude` passes it through.
   *
   * WHY TWO ENTRIES OVER ONE EVALUATOR, now that the other one is repaired. This entry was written first
   * BECAUSE `photoelectric.stoppingPotentialMagnitude` did not call this evaluator at all, computing
   * h*nu/e inline and omitting the work function. That has since been fixed in place, with the printed
   * check measured unchanged, so the law has one owner and the two entries differ only in the units their
   * scenarios find convenient: this one takes the work function in electronvolts, the other in joules.
   * Neither reimplements anything.
   *
   * `reasonCode` falls through to the status here, because a `not-applicable` result carries a prose
   * `reason` and no code. Pinning the prose would make rewording it turn the scenario red, and the
   * triple the runner compares is still discriminating: the output, the status, and which output.
   */
  /**
   * NO VERDICT UNTIL A SUBEXPRESSION IS SELECTED (am-nxbq, item 2).
   *
   * LQ-06 asks a reader to pick a subexpression of the entropy-volume relation and says whether it
   * corresponds to a count of independent quanta. Before anything is picked there is no verdict to give,
   * and the laboratory reports it as not applicable with the reason "No subexpression selected yet."
   *
   * THIS IS A SELECTION STATE, NOT A PHYSICAL BOUNDARY, and the scenario says so plainly rather than
   * dressing it as one. It is still worth a typed result: the alternative is a verdict of false before the
   * reader has chosen, which would read as "the correspondence fails" rather than "nothing has been
   * asked", and that is precisely the difference between not-applicable and a value the typed-result
   * discipline exists to keep.
   *
   * `subexpressionSelected` is a numeric flag because the owner protocol carries numbers: 0 leaves the
   * laboratory's own default of none, and 1 selects the ratio N E over R beta nu, which is the one the
   * paper's section 6 comparison turns on. Measured: none gives the not-applicable verdict, that ratio
   * gives 1, and the presentation subexpression gives 0, so all three branches are real.
   */
  /**
   * COUNTING INDEPENDENT POSSIBILITIES, AND WHAT HAPPENS WHEN THEY ARE NOT (am-nxbq, item 1).
   *
   * LQ-05 is section 5 of paper 1 as arithmetic: if n things are independently somewhere in a volume,
   * the chance of finding them all in a fraction f of it is f to the n, so the entropy change is
   * n k ln f - linear in n, which is what makes the gas comparison in LQ-06 possible at all.
   *
   * `locked` IS A NUMERIC FLAG because the owner protocol carries numbers, 1 for locked and 0 for
   * independent, and it is the control this laboratory exists to offer: lock the points together and the
   * probability is f rather than f to the n, with no n in it. The EXACT combinatorial outputs are
   * returned and the sampled ones are not, because a seeded sample count is a statement about stream
   * semantics rather than about the counting law, and mixing the two in one reading would invite a
   * scenario to assert a statistic as though it were arithmetic.
   */
  /**
   * THE MAGNET AND THE CONDUCTOR, WITH THE PATH AND THE FIELD MODEL AS CONTROLS (am-nxbq, item 1).
   *
   * SR-02 is the opening paragraph of paper 3: the same relative motion of a magnet and a conductor is
   * described two incompatible ways by the older theory, and gives one measurable current either way.
   * The laboratory's two structural controls are the FIELD MODEL, uniform or dipole, and the PATH
   * ORIENTATION, transverse or along the motion, and both are encoded numerically here because an owner
   * takes numbers: fieldModel 0 uniform and 1 dipole, pathOrientation 0 transverse and 1 along-motion.
   *
   * THE CONDUCTOR-FRAME READINGS ARE CONDITIONAL, for the same reason lq07.budget's leftover energy is.
   * A path along the motion has endpoints that are not simultaneous in the other frame, so the
   * electromotive force "around that path" is not one quantity in both frames and the laboratory reports
   * it as not applicable rather than as a number. That is the physics rather than a gap, so including the
   * field strengths and the magnet-frame reading unconditionally and these two only when they are values
   * is what lets one owner serve both the transverse and the along-motion case.
   */
  {
    id: "sr02.fieldsAndPath",
    sourcePath: fileURLToPath(new URL("../../experiments/sr02/session.ts", import.meta.url)),
    fn: (ctx) => {
      const outputs = sr02SnapshotOutputs({
        ...SR02_DEFAULTS,
        ...ctx.inputs,
        fieldModel: (ctx.inputs.fieldModel ?? 0) === 1 ? "dipole" : "uniform",
        pathOrientation: (ctx.inputs.pathOrientation ?? 0) === 1 ? "along-motion" : "transverse",
      } as never);
      const numbers: Record<string, number> = {};
      for (const outputId of [
        "magneticFieldStationary",
        "magneticFieldMoving",
        "electricFieldMoving",
        "electromotiveForceMagnetFrame",
        "lorentzFactor",
        "pathBoostParallelComponent",
        "endpointSimultaneityOffset",
      ]) {
        const got = sessionOutputsOf(outputs, outputId);
        if (isOwnerRefusal(got)) return got;
        Object.assign(numbers, got);
      }
      for (const outputId of ["electromotiveForceConductorFrame", "electromotiveForceExcess"]) {
        const got = sessionOutputsOf(outputs, outputId);
        if (!isOwnerRefusal(got)) Object.assign(numbers, got);
      }
      return numbers;
    },
  },
  {
    id: "lq05.session",
    sourcePath: fileURLToPath(new URL("../../experiments/lq05/session.ts", import.meta.url)),
    fn: (ctx) => {
      const evaluated = evaluateLq05({
        ...LQ05_DEFAULTS,
        n: num(ctx.inputs, "n"),
        f: num(ctx.inputs, "f"),
        locked: num(ctx.inputs, "locked") === 1,
      });
      const numbers: Record<string, number> = {};
      for (const outputId of [
        "configurationProbability",
        "lnW",
        "log10W",
        "deltaSOverKb",
        "expectedTrialsToOne",
        "lockedProbability",
      ]) {
        const got = sessionOutputsOf(evaluated.outputs, outputId);
        if (isOwnerRefusal(got)) return got;
        Object.assign(numbers, got);
      }
      return numbers;
    },
  },
  {
    id: "lq06.session",
    sourcePath: fileURLToPath(new URL("../../experiments/lq06/session.ts", import.meta.url)),
    fn: (ctx) => {
      const code = ctx.inputs.subexpressionSelected ?? 0;
      // 2 IS A SUBEXPRESSION THAT DOES NOT MATCH, and it had to be added as its own code rather than as
      // "anything but 1": E/(beta nu) is the quantum COUNT before the N over R factor, which is the
      // tempting slip rather than an arbitrary wrong answer, and a reader who selects it gets a verdict
      // of 0 instead of a refusal. E, nu and V give 0 the same way; this is the instructive one.
      const selected = code === 1 ? "N_E_over_R_beta_nu" : code === 2 ? "E_over_beta_nu" : "none";
      // The printed set is Einstein's own R, beta and N, which the session admits by name. Keeping it a
      // numeric code is the owner protocol's constraint, and the historical and modern readings must stay
      // separable, since AGENTS.md forbids mixing the two sets in one calculation without saying so.
      const constantSetId =
        (ctx.inputs.printedConstants ?? 0) === 1
          ? "einstein-1905-light-quanta-printed"
          : "modern-si-2019";
      const outputs = lq06Outputs({
        ...LQ06_DEFAULTS,
        ...ctx.inputs,
        selectedSubexpression: selected,
        constantSetId,
      });
      const verdict = sessionOutputsOf(outputs, "correspondenceVerdict");
      if (isOwnerRefusal(verdict)) return verdict;
      const numbers: Record<string, number> = { ...verdict };
      for (const outputId of ["quantumEnergy", "quantumEnergyEv", "effectiveIndependentCount"]) {
        const got = sessionOutputsOf(outputs, outputId);
        if (isOwnerRefusal(got)) return got;
        Object.assign(numbers, got);
      }
      return numbers;
    },
  },
  /**
   * THE NAIVE INTERVAL DOES NOT APPLY TO NOISY, EXPOSED OR DRIFTING OBSERVATIONS (am-nxbq, item 2).
   *
   * BM-08 is the camera, and its subject is that a real observation is not a clean sample of a latent
   * path: localization error correlates neighbouring increments, a finite exposure averages the motion
   * during it, and stage drift adds a trend. The zero-drift independent-increment interval is the textbook
   * one and it is the wrong one here, so the laboratory reports it as `not-applicable` with that reason
   * while keeping its point estimate visible "as a deliberately naive comparison". It is the arrival state
   * of the prepared example, not a boundary a reader has to find.
   *
   * A THIRD OWNER SHAPE, and the last one this item needs: BM-05 and BM-08 build a full instance store
   * from a PREPARED EXAMPLE and a worker factory rather than evaluating a pure function. The worker is
   * never reached for the arrival snapshot, which is why a factory that throws is the honest argument to
   * pass: it proves nothing here consumes one. AGENTS.md's own labelling rule is the reason this is sound
   * rather than a shortcut, since on arrival every laboratory shows its static worked example and fetches
   * no WASM.
   */
  {
    id: "bm08.session",
    sourcePath: fileURLToPath(new URL("../../experiments/bm08/session.ts", import.meta.url)),
    fn: () => {
      const session = createBm08Session("am-nxbq-acceptance", bm08Example as never, () => {
        throw new OwnerContractError(
          "owner-session-wants-a-worker",
          "bm-08's arrival snapshot must not need a worker.",
        );
      });
      const accepted = session.getServerSnapshot().accepted;
      return sessionOutputsOf(accepted?.outputs ?? [], "naiveInterval");
    },
  },
  /**
   * A CLOCK AT THE SPEED OF LIGHT HAS NO PROPER TIME (am-nxbq, item 2).
   *
   * SR-05 is the moving clock. At |v| = c there is no inertial frame for the clock to be at rest in, so
   * there is no proper time along its worldline, no coordinate time between its ticks, and no dilation
   * loss to report. The session's evaluator states `superluminal-observer` on all three together, which
   * is the honest shape: a reader must not be shown a proper time of zero beside a dilation loss, because
   * zero is a duration and the claim is that there is no duration to give.
   *
   * THE OVER-DECLARATION HYPOTHESIS WAS WRONG, and recording that is worth more than the scenario. The
   * last note on am-nxbq suggested sr-05 and sr-09 might DECLARE a status their laboratories never
   * produce, which would have been the same defect as the bead itself. A sweep of every numeric control
   * at nine values each, 54 settings per laboratory, found the status reachable in both: sr-05 at
   * speed 1 and sr-09 at beta 1. The declaration is honest and the probe was too narrow before.
   */
  {
    id: "sr05.session",
    sourcePath: fileURLToPath(new URL("../../experiments/sr05/session.ts", import.meta.url)),
    fn: (ctx) => {
      // evaluateSr05 returns the output LIST itself rather than a record holding one.
      return sessionOutputsOf(evaluateSr05({ ...SR05_DEFAULTS, ...ctx.inputs }), "properTime");
    },
  },
  /**
   * THE DOPPLER FACTOR AT THE SPEED OF LIGHT, AND ELEVEN QUANTITIES WITH IT (am-nxbq, item 2).
   *
   * SR-09 draws the Doppler shift and the aberration of a plane wave between two frames. At beta 1 there
   * is no second frame, so ALL TWELVE of its outputs go outside the domain together with the condition
   * `superluminal-speed`: not only the Doppler factor but the propagation angles in both frames, the two
   * frequencies, the phase, the Lorentz factor and the four classical comparison factors. That is the
   * shape worth pinning, because a page showing a frequency ratio beside an angle it could not have been
   * measured at is the failure a per-output refusal would hide.
   */
  {
    id: "sr09.session",
    sourcePath: fileURLToPath(new URL("../../experiments/sr09/session.ts", import.meta.url)),
    fn: (ctx) => sessionOutput(sr09SnapshotOutputs, SR09_DEFAULTS, ctx, "dopplerFactor"),
  },
  /**
   * LIGHT THAT NEVER REACHES A RECEDING MIRROR (am-nxbq, item 2).
   *
   * SR-11 is paper 3 section 8's moving mirror: light falls on a mirror that is itself moving, and the
   * reflected frequency, the radiation pressure and the energy balance all follow. The geometry has a
   * boundary the laboratory must state rather than compute through. If the mirror recedes faster than the
   * component of the light's velocity along its motion, the light never catches it: the condition is
   * cos(phi) <= beta, and at beta 0.5 it is already reached by phi = 80 degrees.
   *
   * ALL TEN of the laboratory's outputs are then not applicable together, which is the honest shape: there
   * is no reflection, so there is no reflected frequency AND no pressure AND no work rate, rather than a
   * pressure of zero beside a frequency ratio of something. sr-11's manifest admits both not-applicable
   * and outside-domain on all ten, and its own kernel note distinguishes three refusals that are three
   * different facts, this interception condition being one of them.
   */
  {
    id: "sr11.session",
    sourcePath: fileURLToPath(new URL("../../experiments/sr11/session.ts", import.meta.url)),
    fn: (ctx) => sessionOutput(sr11SnapshotOutputs, SR11_DEFAULTS, ctx, "frequencyRatio"),
  },
  /**
   * STOKES'S RULE: ONE QUANTUM CANNOT MAKE A MORE ENERGETIC ONE (am-nxbq, item 2).
   *
   * Section 7 of the light-quanta paper derives Stokes's rule from the quantum hypothesis: the emitted
   * frequency cannot exceed the exciting frequency, because a single absorbed quantum has only its own
   * energy to give. LQ-07 lets a reader set the two frequencies independently, and asking for an emitted
   * frequency above the exciting one asks for something the hypothesis forbids. The session reports the
   * emitted rate, the emitted power and the dissipated heat as not applicable with the reason "One quantum
   * of the exciting light has too little energy to produce light of the emitted frequency", and lq-07's
   * manifest admits that status on ten outputs.
   *
   * The multi-quantum control is why this is a rule rather than an arithmetic check: with k absorbed
   * quanta the ceiling moves, which is the deviation case the paper itself anticipates, so the refusal is
   * conditional on the model a reader has selected rather than on the frequencies alone.
   */
  /**
   * THE FLUORESCENCE ENERGY BUDGET, IN ALL FOUR REGIMES LQ-07 OFFERS (am-nxbq, item 1).
   *
   * Section 7 of paper 1 derives Stokes's rule from the quantum hypothesis - emitted light cannot
   * exceed the exciting frequency, because one absorbed quantum has only its own energy to give - and
   * then names the conditions under which it may be broken. The laboratory's `regime` control selects
   * among the paper's own cases and one modern lens, and this owner returns the BUDGET rather than the
   * rates: the verdict, the ceiling on the emitted frequency, the energy left over for other channels
   * and the deficit when there is none. lq07.session beside it reports the rates, which are a different
   * question and refuse under different conditions.
   *
   * THE REGIME IS ENCODED AS A NUMBER, as bm-02's model and bm-05's kernel are, because an owner takes
   * numeric inputs only: 0 standard-stokes, 1 deviation-multi-quantum, 2 deviation-non-wien, 3
   * modern-thermal. Anything else is the paper's own case, which is the safe default for a control that
   * selects between a historical claim and its exceptions.
   */
  {
    id: "lq07.budget",
    sourcePath: fileURLToPath(new URL("../../experiments/lq07/session.ts", import.meta.url)),
    fn: (ctx) => {
      const code = num(ctx.inputs, "regime");
      const regime =
        code === 1
          ? "deviation-multi-quantum"
          : code === 2
            ? "deviation-non-wien"
            : code === 3
              ? "modern-thermal"
              : "standard-stokes";
      const evaluated = evaluateLq07({ ...LQ07_DEFAULTS, ...ctx.inputs, regime } as never);
      const numbers: Record<string, number> = {};
      for (const outputId of ["allowed", "nu2Max", "energyDeficitEv"]) {
        const got = sessionOutputsOf(evaluated.outputs, outputId);
        if (isOwnerRefusal(got)) return got;
        Object.assign(numbers, got);
      }
      // eOtherEv IS CONDITIONAL AND THAT IS NOT A PARTIAL RESULT. The energy left over for non-optical
      // channels exists only when the transition is allowed; when it is refused the evaluator reports
      // not-applicable, which is the right answer and a different statement from zero left over. The
      // three fields above are the verdict and are always numbers, so including this one when it is a
      // value adds a reading rather than completing a broken one, and a scenario asserting it where it
      // is absent fails on a missing output rather than passing on a substitute.
      const other = sessionOutputsOf(evaluated.outputs, "eOtherEv");
      if (!isOwnerRefusal(other)) Object.assign(numbers, other);
      return numbers;
    },
  },
  {
    id: "lq07.session",
    sourcePath: fileURLToPath(new URL("../../experiments/lq07/session.ts", import.meta.url)),
    fn: (ctx) => {
      const evaluated = evaluateLq07({ ...LQ07_DEFAULTS, ...ctx.inputs });
      return sessionOutputsOf(evaluated.outputs, "emittedRate");
    },
  },
  /**
   * FREE RADIATION IS NOT ASSIGNED A REST MASS (am-nxbq, item 2).
   *
   * ME-03 is the 1906 box: a pulse crosses from one wall to the other and the box recoils, and the
   * argument assigns a mass change to the EMITTING BODY from the energy it lost. It does not assign a rest
   * mass to the radiation in flight, and 1905 kinematics gives it none, so the session reports the
   * radiation's mass change as not applicable with the reason "Free radiation is not assigned an inertial
   * rest mass in 1905 kinematics." That is an editorial position about what the paper claims, held in
   * every setting, which is why no control reaches it and why a number there would be a claim the paper
   * does not make.
   */
  {
    id: "me03.session",
    sourcePath: fileURLToPath(new URL("../../experiments/me03/session.ts", import.meta.url)),
    fn: (ctx) => sessionOutput(me03SnapshotOutputs, ME03_DEFAULTS, ctx, "radiationMassChange"),
  },
  /**
   * THE TWO LEDGERS, AT THE SETTINGS A READER ARRIVES ON (am-nxbq, item 1).
   *
   * ME-01 is paper 4's whole argument in three numbers, and this owner returns all three at once because
   * the argument is the RELATION between them rather than any one: the rest ledger books L of light, the
   * moving ledger books gamma L, and the difference between the two balances is a loss of L(gamma - 1)
   * from the body's kinetic energy at unchanged velocity. Pinning only the moving balance would pass
   * while the subtraction that carries the inference was wrong.
   *
   * If any of the three is non-numeric it RETURNS that refusal rather than the partial record, and
   * deliberately does not throw: run.ts already answers a golden holding a refusal with "this route
   * compares numbers and has no expected.status to compare it against", naming the owner and the code,
   * so a throw here would be a second, worse copy of a diagnostic that exists. What must not happen is
   * the third case, a record carrying two numbers and a refusal, which would let a scenario pass having
   * compared two thirds of its subject.
   */
  {
    id: "me01.twoLedgers",
    sourcePath: fileURLToPath(new URL("../../experiments/me01/session.ts", import.meta.url)),
    fn: (ctx) => {
      const outputs = me01SnapshotOutputs({ ...ME01_DEFAULTS, ...ctx.inputs });
      const numbers: Record<string, number> = {};
      for (const quantityId of [
        "emittedEnergyRestFrame",
        "lightComplexEnergyMoving",
        "kineticEnergyDifference",
      ]) {
        const got = sessionOutputsOf(outputs, quantityId);
        if (isOwnerRefusal(got)) return got;
        Object.assign(numbers, got);
      }
      return numbers;
    },
  },
  /**
   * NO OBSERVER AT THE SPEED OF LIGHT, SAID BY THE EVALUATOR AND NOT ONLY BY THE CONTROL (am-nxbq, item 2).
   *
   * ME-01 already has a declared-range refusal: its observer-speed control stops at 0.95, and
   * me-01-framespeed-outside-declared-range-refused pins a reader typing 0.96. That is a TEACHING range,
   * and its scenario says so, naming the physical bound as "a different statement the instrument makes
   * elsewhere". This owner is that elsewhere. At |beta| >= 1 the reference evaluator refuses on its own,
   * with the condition "|beta| < 1", independently of whether any control gate ran.
   *
   * The two layers matter separately because a parameter can reach the evaluator without passing a
   * control: a permalink, a teaching tape and an embed all carry values no field offers. Pinning only the
   * control gate would leave the evaluator free to return a number through those routes.
   */
  {
    id: "me01.session",
    sourcePath: fileURLToPath(new URL("../../experiments/me01/session.ts", import.meta.url)),
    fn: (ctx) => sessionOutput(me01SnapshotOutputs, ME01_DEFAULTS, ctx, "lightComplexEnergyMoving"),
  },
  /**
   * NO CURRENT, BECAUSE THERE IS NO CIRCUIT (am-nxbq, item 2).
   *
   * SR-02 is the opening asymmetry of paper 3: a magnet and a conductor in relative motion, where the
   * electromotive force is the same and the two descriptions of where it comes from are not. The model is
   * the field and the force on a test charge; it has no circuit, no resistance and no load, so there is no
   * current to report. The session says exactly that, "Current in a real circuit is not modeled; this
   * model has no circuit", rather than reporting a current of zero, which would say the circuit exists
   * and carries nothing.
   */
  {
    id: "sr02.session",
    sourcePath: fileURLToPath(new URL("../../experiments/sr02/session.ts", import.meta.url)),
    fn: (ctx) => sessionOutput(sr02SnapshotOutputs, SR02_DEFAULTS, ctx, "inducedCircuitCurrent"),
  },
  /**
   * THE ONE-WAY SPEED OF LIGHT IS A CONVENTION, NOT A MEASUREMENT (am-nxbq, item 2).
   *
   * This is paper 3 section 1's own point, and SR-01 already states it: `snapshotOutputs` pushes
   * `oneWayLightSpeed` as `not-applicable` with the reason "The model defines the one-way light speed by
   * convention (Einstein's synchronization procedure), rather than measuring it independently." It is the
   * state in every setting, because no control can turn a convention into a measurement.
   *
   * A SESSION-LEVEL OWNER, which is a new shape here and the reason this entry is worth its length. Every
   * owner above calls a reference evaluator. This one calls a LABORATORY SESSION, because that is where
   * the result lives: the measurement of the two-way speed is an evaluator's business and the statement
   * that the one-way speed is conventional is the laboratory's. Most of the instruments still without a
   * non-numeric acceptance case are in the same position, measured on am-nxbq, so this is the shape they
   * will follow: the lab's own defaults merged with the scenario's inputs, the session called once, and
   * the output found BY ITS QUANTITY ID rather than by position, because a session returns a list and a
   * list's order is not a contract.
   */
  {
    id: "sr01.session",
    sourcePath: fileURLToPath(new URL("../../experiments/sr01/session.ts", import.meta.url)),
    fn: (ctx) => sessionOutput(sr01SnapshotOutputs, SR01_DEFAULTS, ctx, "oneWayLightSpeed"),
  },
  /**
   * WITH NO FORCE THERE IS NO DECAY LENGTH, NOT AN INFINITE ONE (am-nxbq, item 2).
   *
   * BM-04 balances an external force against diffusion and reports the length over which the equilibrium
   * density falls by a factor e. Set the force to zero and the profile is UNIFORM: there is no fall, so
   * there is no length over which it happens. `decayLengths` returns `not-applicable` with the reason "no
   * force, no gradient: the equilibrium profile is uniform", and bm-04's manifest admits that status on
   * three outputs including the osmotic decay length.
   *
   * The dangerous answer is an infinity, which would plot as a decay length larger than the cell and read
   * as "the density falls very slowly" rather than "it does not fall". The force control's declared range
   * includes zero, so a reader reaches this by dragging the force to the middle.
   */
  /**
   * THE EQUILIBRIUM BALANCE, AND NAEGELI'S BRANCH THROUGH IT (am-nxbq, item 1).
   *
   * BM-04 is section 3 of paper 2: a directional force is set against random spreading, and the balance
   * between them fixes how fast the particles diffuse. The laboratory's control `m` is the KICK STRENGTH,
   * the factor by which the molecular kicks supply more or less diffusivity than the equilibrium
   * relation D = mu k_B T requires, so m = 1 is Einstein's balance and m = 0 is Naegeli's hypothesis that
   * molecular impacts do nothing at all. This owner takes m and forms the kick diffusivity from it, the
   * way the laboratory does, rather than making a scenario state an absolute diffusivity whose
   * relationship to the balance a reader would have to work out.
   *
   * `kickStrength` IS THE NUMERIC CARRIER OF `agree`. The evaluator also returns a boolean, and a
   * boolean is exactly what a scenario's expected outputs cannot express; kickStrength is 1 when and
   * only when the kicks match the relation, so asserting the number asserts the agreement and says by
   * how much it fails when it fails.
   */
  {
    id: "diffusion.equilibriumBalance",
    sourcePath: fileURLToPath(
      new URL("../../physics/reference/diffusion/routeA.ts", import.meta.url),
    ),
    fn: (ctx) => {
      const eta = num(ctx.inputs, "eta");
      const a = num(ctx.inputs, "a");
      const temperature = num(ctx.inputs, "T");
      const set = getConstantSet("modern-si-2019");
      const muEval = stokesMobility(eta, a);
      const mu = nonNumericOr(muEval.result as unknown as Record<string, unknown>, "mobility");
      if (typeof mu !== "number") return mu;
      // The same product the evaluator forms internally, so m scales the kicks against the relation
      // rather than against some other diffusivity.
      const mobilityD = mu * thermalConstant(set).value * temperature;
      const balance = equilibriumBalance(
        {
          force: num(ctx.inputs, "F"),
          temperature,
          eta,
          a,
          kickDiffusivity: num(ctx.inputs, "m") * mobilityD,
        },
        set,
      );
      if (!("mobilityD" in balance)) {
        // equilibriumBalance returns a flat evaluation rather than the balance record when its own
        // domain check refuses, so the refusal is reported on the diffusion coefficient it would have
        // produced. A number here would mean the shape changed and is a contract error, not a result.
        const refused = nonNumericOr(
          (balance as { result?: unknown }).result as Record<string, unknown>,
          "diffusionCoefficient",
        );
        // A number cannot arrive here: the flat shape is only returned by the domain guard, which
        // always refuses. Reporting it as a refusal rather than throwing keeps this owner free of a
        // throw site, and any scenario that met it would fail loudly on an unrecognised reason.
        return typeof refused === "number"
          ? {
              refused: {
                outputId: "diffusionCoefficient",
                status: "outside-domain",
                reasonCode: "balance-record-absent",
              },
            }
          : refused;
      }
      const held = balance as {
        mobilityD: { result?: Record<string, unknown> } & Record<string, unknown>;
        balanceD: { result?: Record<string, unknown> } & Record<string, unknown>;
        kickStrength: number;
      };
      const numbers: Record<string, number> = {};
      for (const [outputId, carrier] of [
        ["mobilityD", held.mobilityD],
        ["balanceD", held.balanceD],
      ] as const) {
        const got = nonNumericOr((carrier.result ?? carrier) as Record<string, unknown>, outputId);
        if (typeof got !== "number") return got;
        numbers[outputId] = got;
      }
      numbers.kickStrength = held.kickStrength;
      return numbers;
    },
  },
  {
    id: "diffusion.decayLengths",
    sourcePath: fileURLToPath(
      new URL("../../physics/reference/diffusion/routeA.ts", import.meta.url),
    ),
    fn: (ctx) => {
      const result = decayLengths(
        {
          force: num(ctx.inputs, "force"),
          temperature: num(ctx.inputs, "temperature"),
          kickDiffusivity: num(ctx.inputs, "kickDiffusivity"),
          mobility: num(ctx.inputs, "mobility"),
        },
        getConstantSet("modern-si-2019"),
      );
      const got = nonNumericOr(
        (result.osmotic as unknown as { result?: Record<string, unknown> }).result ??
          (result.osmotic as unknown as Record<string, unknown>),
        "osmoticDecayLength",
      );
      return typeof got === "number" ? { osmoticDecayLength: got } : got;
    },
  },
  /**
   * THE VOLUME-INDEPENDENT FACTOR IS A SYMBOL, AND THAT IS WHY THE PRESSURE IS COMPUTABLE (am-nxbq, item 2).
   *
   * BM-03's configuration integral has a factor that does not depend on the volume: the momentum
   * integrals and the free-energy offset. Its value is unknown, and the laboratory never needs it,
   * because every quantity it reports is a RATIO or a DIFFERENCE between two volumes in which that factor
   * cancels. `configurationVolumeTerm` therefore returns it as a `symbolic` result carrying its
   * unspecified symbols, beside the numbers it does report, and bm-03's manifest admits `symbolic` on
   * three outputs.
   *
   * AGENTS.md names the adversarial version of this in its fixture list, "an arbitrary entropy-density
   * constant cancels": a reader who is handed a number for the factor can no longer see that the result
   * does not depend on it, which is the point section 3 of the Brownian paper turns on.
   */
  {
    id: "diffusion.configurationVolumeTerm",
    sourcePath: fileURLToPath(
      new URL("../../physics/reference/diffusion/routeA.ts", import.meta.url),
    ),
    fn: (ctx) => {
      const result = configurationVolumeTerm(
        {
          Np: num(ctx.inputs, "particleCount"),
          V: num(ctx.inputs, "volume"),
          V0: num(ctx.inputs, "referenceVolume"),
          T: num(ctx.inputs, "temperature"),
        },
        getConstantSet("modern-si-2019"),
      );
      // The input-domain branch returns a single evaluation rather than the record, so it is told apart
      // by the absence of the field this owner reads rather than by a type assertion.
      const record = result as unknown as Record<string, unknown>;
      const factor = record.volumeIndependentFactor;
      if (factor === undefined) {
        const got = nonNumericOr(
          (record.result ?? record) as Record<string, unknown>,
          "volumeIndependentFactor",
        );
        return typeof got === "number" ? { volumeIndependentFactor: got } : got;
      }
      const got = nonNumericOr(factor as Record<string, unknown>, "volumeIndependentFactor");
      return typeof got === "number" ? { volumeIndependentFactor: got } : got;
    },
  },
  /**
   * DIFFUSIVITY ALONE DOES NOT SETTLE A RADIUS OR A MOLECULAR NUMBER (am-nxbq, item 2).
   *
   * AGENTS.md's `underdetermined` row names this case: "Radius and molecular number from diffusivity
   * alone". The Stokes-Einstein relation ties the diffusion coefficient to the product of the molecular
   * number and the radius, so one measured coefficient fixes a FAMILY of pairs rather than either member,
   * and BM-07 draws that family. With no diffusion scale at all the family cannot be drawn either, and
   * `identifiabilityFamily` reports the information as insufficient with the sentence stating what is
   * needed. BM-07's manifest admits an underdetermined status on three outputs for this reason.
   *
   * The accepted branch returns the product, which is what the family is a curve of, so a scenario on the
   * other side pins a number rather than nothing.
   */
  {
    id: "inference.identifiabilityFamily",
    sourcePath: fileURLToPath(new URL("../../physics/reference/inference.ts", import.meta.url)),
    fn: (ctx) => {
      const assessment = identifiabilityFamily(
        {
          D: num(ctx.inputs, "diffusionCoefficient"),
          T: num(ctx.inputs, "temperature"),
          eta: num(ctx.inputs, "viscosity"),
          radiusRange: [num(ctx.inputs, "radiusMin"), num(ctx.inputs, "radiusMax")],
          synthetic: (ctx.inputs.synthetic ?? 1) !== 0,
        },
        getConstantSet("modern-si-2019"),
      );
      const got = assessmentOr(
        assessment as never,
        "molecularNumberRadiusProduct",
        (data: { product: number }) => data.product,
      );
      return typeof got === "number" ? { molecularNumberRadiusProduct: got } : got;
    },
  },
  /**
   * THE BODY'S ABSOLUTE ENERGY STAYS A SYMBOL (am-nxbq, item 2).
   *
   * AGENTS.md's `symbolic` row names this case: "An absolute internal energy in the historical ledger".
   * Paper 4 never needs the body's total energy, only the DIFFERENCE before and after emission, and the
   * circularity rule in the same document forbids initialising it with Mc^2 or gamma Mc^2, because that
   * assumes the conclusion the paper is deriving. So `initializeMassEnergyLedger` returns the rest and
   * moving body energies as `symbolic` results carrying the unspecified symbol E₀, with no number at all,
   * and ME-01's manifest admits `symbolic` on five of its outputs.
   *
   * The same function THROWS `absolute-energy-not-admitted` if a numeric absolute energy is supplied in
   * the historical mode, which is the anti-circularity gate rather than a typed result and is tested
   * elsewhere. This owner reads only the symbolic result, which is the honest answer a reader is shown.
   */
  {
    id: "massEnergy.historicalLedger",
    sourcePath: fileURLToPath(new URL("../../physics/reference/massEnergy.ts", import.meta.url)),
    fn: () => {
      const ledger = initializeMassEnergyLedger();
      const got = nonNumericOr(
        ledger.restBodyBefore as unknown as Record<string, unknown>,
        "restBodyBefore",
      );
      return typeof got === "number" ? { restBodyBefore: got } : got;
    },
  },
  /**
   * NO IONIZATION RATE BELOW THE IONIZATION THRESHOLD (am-nxbq, item 2).
   *
   * The same structure as LQ-08's stopping potential, on paper 1's section 9 rather than its section 8:
   * if one quantum carries less than the ionization energy, then under the hypothesis that each absorbed
   * quantum ionizes one molecule there is no single-quantum ionization at all. `ionizationCount` reports
   * `not-applicable` on its rate, its molecule count AND its gram-molecule count, with the reason "no
   * single-quantum ionization under this hypothesis", while the quantum rates beside them stay values:
   * quanta still arrive and are still absorbed, and none of them ionizes. That is a more interesting page
   * than a zero, because it separates what the light does from what the model says follows.
   */
  {
    id: "photoelectric.ionizationRateTyped",
    sourcePath: fileURLToPath(new URL("../../physics/reference/photoelectric.ts", import.meta.url)),
    fn: (ctx) => {
      const result = ionizationCount({
        nu: num(ctx.inputs, "frequency"),
        ionizationEnergyEv: num(ctx.inputs, "ionizationEnergyEv"),
        incidentPowerWatts: num(ctx.inputs, "incidentPowerWatts"),
        absorptionEfficiency: num(ctx.inputs, "absorptionEfficiency"),
      });
      const got = nonNumericOr(
        result.ionizationRatePerSecond as unknown as Record<string, unknown>,
        "ionizationRatePerSecond",
      );
      return typeof got === "number" ? { ionizationRatePerSecond: got } : got;
    },
  },
  /**
   * A SOURCE AT ZERO DISTANCE HAS NO INTENSITY (am-nxbq, item 2).
   *
   * LQ-01 draws the two-source interference pattern, and its intensity carries one over r squared from
   * each source. At r = 0 that is not a large intensity, it is no intensity: the inverse-square law places
   * the observer at the source, where the wave description the laboratory uses does not reach. The
   * evaluator states `nonpositive-radius` as an outside-domain result with a physical domain kind, and
   * lq-01's manifest admits that status on its centre-intensity output.
   */
  {
    id: "radiation.twoSourceIntensityTyped",
    sourcePath: fileURLToPath(
      new URL("../../physics/reference/radiation/waves.ts", import.meta.url),
    ),
    fn: (ctx) => {
      const result = twoSourceIntensity({
        A1: num(ctx.inputs, "amplitude1"),
        A2: num(ctx.inputs, "amplitude2"),
        r1: num(ctx.inputs, "distance1"),
        r2: num(ctx.inputs, "distance2"),
        wavelength: num(ctx.inputs, "wavelength"),
      });
      const got = nonNumericOr(result as unknown as Record<string, unknown>, "centerIntensity");
      return typeof got === "number" ? { centerIntensity: got } : got;
    },
  },
  /**
   * A SEPARATION BETWEEN NON-SIMULTANEOUS ENDPOINTS IS NOT A LENGTH (am-nxbq, item 2).
   *
   * This is paper 3's own insistence, made into a typed result. Section 1 defines a length measurement
   * as the distance between endpoint marks taken AT THE SAME TIME in the measuring frame, and the whole
   * contraction argument of section 2 rests on which frame's clocks call them simultaneous.
   * `measureRodLength` therefore returns `not-applicable` with the condition
   * `non-simultaneous-endpoints` and a repair naming a simultaneous pair, rather than subtracting two
   * coordinates and calling the difference a length.
   *
   * The dangerous answer here is again a NUMBER: the coordinate difference of two non-simultaneous events
   * is perfectly finite, and on the page it would be indistinguishable from a measured length. SR-03's
   * manifest admits `not-applicable` on `measuredLength` for exactly this.
   *
   * The events arrive as flat numbers because the owner protocol carries numbers: t1, x1, t2, x2, with
   * the frames and the rest length beside them. `frameIsMoving` picks which frame does the measuring,
   * 0 for the stationary system K and anything else for the moving system k.
   */
  /**
   * THE CONTRACTION AS A MEASUREMENT RATHER THAN A FORMULA (am-nxbq, item 1).
   *
   * SR-03's subject is that a length is a measurement made at ONE TIME in the measuring frame, and that
   * which pair of endpoint events counts as "at one time" depends on the frame. So this owner does both
   * halves of the laboratory's chain: it asks the kinematics which endpoint events are simultaneous in
   * the measuring frame, and then measures the separation of exactly those events.
   *
   * THAT ORDER IS WHY THE NUMBER MEANS ANYTHING. events.measureRodLengthTyped beside it takes the two
   * events as inputs, which is right for the case where a reader supplies a pair and asks whether it is a
   * length at all. Supplying the contracted separation to it and then asserting the contraction would be
   * asserting the scenario's own arithmetic. Here the separation is COMPUTED by the selection and the
   * measurement only confirms it was simultaneous, so a contraction factor applied in the wrong place
   * would change the answer.
   */
  {
    id: "events.rodSignature",
    sourcePath: fileURLToPath(new URL("../../physics/reference/events.ts", import.meta.url)),
    fn: (ctx) => {
      const measuring = (ctx.inputs.frameIsMoving ?? 0) === 0 ? "K" : "k";
      const rest = (ctx.inputs.rodRestFrameIsMoving ?? 0) === 0 ? "K" : "k";
      const v = num(ctx.inputs, "frameSpeed");
      const L0 = num(ctx.inputs, "properLength");
      const pair = selectSimultaneousEndpoints(rest, measuring, v, L0);
      // NOT nonNumericOr HERE, and the reason is worth the line: the selection's accepted value is a PAIR
      // OF EVENTS, not a number, so that helper's guard correctly throws owner-value-key-unnamed on it.
      // A refusal is built by hand from the kinematics' own condition instead.
      if (pair.status !== "value") {
        const held = pair as unknown as Record<string, unknown>;
        return {
          refused: {
            outputId: "endpointPair",
            status: String(held.status),
            reasonCode:
              "condition" in held && held.condition !== undefined
                ? String(held.condition)
                : String(held.status),
          },
        };
      }
      const measured = measureRodLength(pair.value.e1, pair.value.e2, measuring, rest, v, L0);
      const got = nonNumericOr(
        measured as unknown as Record<string, unknown>,
        "measuredLength",
        "measuredLength",
      );
      return typeof got === "number" ? { measuredLength: got, properLength: L0 } : got;
    },
  },
  {
    id: "events.measureRodLengthTyped",
    sourcePath: fileURLToPath(new URL("../../physics/reference/events.ts", import.meta.url)),
    fn: (ctx) => {
      const measuring = (ctx.inputs.frameIsMoving ?? 0) === 0 ? "K" : "k";
      const rest = (ctx.inputs.rodRestFrameIsMoving ?? 0) === 0 ? "K" : "k";
      const result = measureRodLength(
        { t: num(ctx.inputs, "t1"), x: num(ctx.inputs, "x1"), y: 0, z: 0 },
        { t: num(ctx.inputs, "t2"), x: num(ctx.inputs, "x2"), y: 0, z: 0 },
        measuring,
        rest,
        num(ctx.inputs, "frameSpeed"),
        num(ctx.inputs, "properLength"),
      );
      // The accepted branch carries the length under `measuredLength`, not `value`, so the key is named.
      const got = nonNumericOr(
        result as unknown as Record<string, unknown>,
        "measuredLength",
        "measuredLength",
      );
      return typeof got === "number" ? { measuredLength: got } : got;
    },
  },
  /**
   * A BAND THAT RUNS BACKWARDS HAS NO ENERGY IN IT (am-nxbq, item 2).
   *
   * LQ-03 gives a reader two band-edge controls and lets either be moved past the other. The integral
   * from the upper edge to the lower one is the negative of the real band's energy, so the dangerous
   * answer here is not a crash but a NEGATIVE ENERGY DENSITY, which would appear on the plot as a
   * physical claim. `planckBandEnergyDensity` states `inverted-frequency-range` as an outside-domain
   * result instead, and lq-03's manifest admits that status on frequencyEnergyDensity.
   *
   * A SECOND OWNER RATHER THAN A REPAIR: `radiation.bandEnergy`, above, THROWS on any non-value
   * ("planckBandEnergyDensity refused inputs"), so a scenario driving it would fail with an exception
   * rather than a compared status. One scenario references it, so changing it is its own decision.
   */
  {
    id: "radiation.bandEnergyTyped",
    sourcePath: fileURLToPath(
      new URL("../../physics/reference/radiation/bandIntegration.ts", import.meta.url),
    ),
    fn: (ctx) => {
      const result = planckBandEnergyDensity(
        num(ctx.inputs, "nuMin"),
        num(ctx.inputs, "nuMax"),
        num(ctx.inputs, "temperature"),
        getConstantSet("modern-si-2019"),
      );
      const got = nonNumericOr(result as unknown as Record<string, unknown>, "bandEnergy");
      return typeof got === "number" ? { bandEnergy: got } : got;
    },
  },
  /**
   * THE CLASSICAL ALLOCATION, WHICH HAS NO TOTAL (am-nxbq, item 2).
   *
   * This is the difficulty paper 1 opens from, and the honest form of it. Equipartition gives every
   * resonator mode k_B T, the mode count grows as the cube of the frequency, and the integral over all
   * frequencies has no finite value. `classicalTotalEnergy` therefore returns `outside-domain` with the
   * condition `classical-total-diverges` and the reason "the classical allocation assigns unbounded
   * total energy" at EVERY temperature: there is no number to give, and that is the point rather than a
   * limitation of the evaluator.
   *
   * ONE OWNER, BOTH DIRECTIONS, because the physics is the contrast. Supply a finite positive cutoff and
   * `classicalCutoffEnergyDensity` returns a value, which is what the laboratory plots; leave the cutoff
   * out and the total has no value. Removing the cutoff is exactly what removes the answer, so putting
   * both in one owner is the claim rather than a convenience.
   *
   * AGENTS.md's anachronism table applies to how a scenario WORDS this: "ultraviolet catastrophe" is
   * Ehrenfest's phrase from 1911 and the pre-1905 difficulty is not the later textbook narrative, so the
   * prose says what diverges and stops.
   */
  /**
   * HOW MUCH ENERGY THE CLASSICAL ALLOCATION PUTS BELOW A CUTOFF, AND WHERE IT PUTS IT (am-nxbq, item 1).
   *
   * LQ-02 asks what happens if every resonator gets the same mean energy whatever its frequency. Below a
   * stated cutoff the answer is a number, and the number is lopsided: the energy density goes as the cube
   * of the cutoff, so almost all of it sits just under the top. Both outputs come from one owner because
   * the share is computed FROM the two energies and reporting it beside a different pair would be a
   * different claim.
   */
  /**
   * THE PHOTOELECTRIC APPARATUS, ENERGY AND NUMBER TOGETHER (am-nxbq, item 1).
   *
   * LQ-08 asks "What changes the energy of the emitted electrons, and what changes their number?", and
   * the answer is only visible when both are read from the SAME evaluation: brighter light multiplies
   * the number and leaves the energy exactly where it was. An owner returning one of them could not
   * state that, and two owners evaluated separately would not be the same apparatus.
   *
   * The order of the fields is deliberate. Below the threshold frequency the kinetic energy is the
   * first thing that stops being a number, so a sub-threshold scenario gets its refusal named on
   * maxKineticEnergy, which is upstream of the stopping potential and is where the model's claim
   * actually bites.
   */
  {
    id: "lq08.session",
    sourcePath: fileURLToPath(new URL("../../experiments/lq08/session.ts", import.meta.url)),
    fn: (ctx) => {
      const outputs = evaluateLq08({ ...LQ08_DEFAULTS, ...ctx.inputs });
      const numbers: Record<string, number> = {};
      for (const quantityId of [
        "quantumEnergy",
        "maxKineticEnergy",
        "stoppingPotentialMagnitude",
        "quantumRate",
        "emissionRate",
        "photocurrent",
      ]) {
        const got = sessionOutputsOf(outputs, quantityId);
        if (isOwnerRefusal(got)) return got;
        Object.assign(numbers, got);
      }
      return numbers;
    },
  },
  {
    id: "lq02.allocation",
    sourcePath: fileURLToPath(new URL("../../experiments/lq02/session.ts", import.meta.url)),
    fn: (ctx) => {
      const numbers: Record<string, number> = {};
      for (const field of ["energyUpToCutoff", "shareAboveProbe"] as const) {
        const got = lq02Field(ctx, field);
        if (isOwnerRefusal(got)) return got;
        Object.assign(numbers, got);
      }
      return numbers;
    },
  },
  /**
   * WIDENING THE CUTOFF TENFOLD MULTIPLIES THE ENERGY BY A THOUSAND (am-nxbq, item 1).
   *
   * The ratio, not the two energies, because the ratio is the claim: it is the cube of ten for every
   * temperature and every starting cutoff, which is what shows the growth has no ceiling to approach.
   * The session computes it and nothing could read it until now.
   *
   * AGENTS.md's anachronism table governs how a scenario WORDS this: "ultraviolet catastrophe" is
   * Ehrenfest's phrase from 1911, so the prose says what grows and stops there.
   */
  {
    id: "lq02.growthRatio",
    sourcePath: fileURLToPath(new URL("../../experiments/lq02/session.ts", import.meta.url)),
    fn: (ctx) => {
      const ratio = lq02Snapshot(ctx).growthRatio;
      // null is the session's way of saying the two energies are not both values, which happens for a
      // nonpositive temperature. Reporting it as a refusal keeps that a typed outcome rather than a
      // missing output, and names the field a reader would be looking at.
      if (ratio === null)
        return {
          refused: {
            outputId: "growthRatio",
            status: "outside-domain",
            reasonCode: "cutoff-energies-not-values",
          },
        };
      return { growthRatio: ratio };
    },
  },
  /**
   * A SHARE ABOVE A PROBE THAT SITS ABOVE THE CUTOFF (am-nxbq, item 2).
   *
   * The probe divides the energy below the cutoff into two parts, so a probe ABOVE the cutoff divides
   * nothing: there is no band between them. The session states `probe-above-cutoff` rather than
   * returning a negative share, which is what the arithmetic would give and what a reader would have no
   * way to recognise as meaningless.
   */
  {
    id: "lq02.shareAboveProbe",
    sourcePath: fileURLToPath(new URL("../../experiments/lq02/session.ts", import.meta.url)),
    fn: (ctx) => lq02Field(ctx, "shareAboveProbe"),
  },
  /**
   * NO MEAN RESONATOR ENERGY AT ZERO TEMPERATURE (am-nxbq, item 2).
   *
   * The mean energy per resonator is proportional to the temperature, so at T = 0 the arithmetic gives
   * zero and the physics gives nothing: the allocation this laboratory is about is a statement about a
   * body at a temperature, and zero kelvin is outside the model rather than a cold case of it. The
   * session's own guard exists because the bare owner function trusts its caller for T's domain, which
   * would have let a nonpositive T produce a negative energy beside a correctly refusing cutoff energy.
   */
  {
    id: "lq02.meanResonatorEnergy",
    sourcePath: fileURLToPath(new URL("../../experiments/lq02/session.ts", import.meta.url)),
    fn: (ctx) => lq02Field(ctx, "meanResonatorEnergy"),
  },
  {
    id: "radiation.classicalAllocation",
    sourcePath: fileURLToPath(
      new URL("../../physics/reference/radiation/classical.ts", import.meta.url),
    ),
    fn: (ctx) => {
      const set = getConstantSet("modern-si-2019");
      const T = num(ctx.inputs, "temperature");
      const cutoff = ctx.inputs.cutoffFrequency;
      const result =
        typeof cutoff === "number"
          ? classicalCutoffEnergyDensity(cutoff, T, set)
          : classicalTotalEnergy(T, set);
      const got = nonNumericOr(result as unknown as Record<string, unknown>, "radiationEnergy");
      return typeof got === "number" ? { radiationEnergy: got } : got;
    },
  },
  /**
   * THE LORENTZ FACTOR WHERE THERE IS NO OBSERVER TO HAVE ONE (am-nxbq, item 2).
   *
   * Every relativity laboratory declares `outside-domain` on at least one output, and the condition
   * their shared evaluator states is `superluminal-observer`: "No inertial observer at |v| >= c.
   * Evaluator domain is |beta| < 1." At |beta| = 1 the factor does not merely become large, it has no
   * value, and the evaluator says which kind of no-value that is.
   *
   * A SECOND OWNER RATHER THAN A REPAIR, for the reason recorded on am-nxbq: the `kinematics` owner a
   * few entries below DROPS every non-value result (`if (g.status === "value") out.gamma = ...`), so a
   * superluminal request returns an EMPTY record and a scenario fails with a missing output rather than
   * a typed refusal. Nine scenarios reference that owner, so changing what it returns is a separate
   * decision with its own evidence.
   */
  /**
   * THE DIFFUSIVITY A CAUCHY STEP LAW DOES NOT HAVE (am-nxbq, item 2).
   *
   * bm-05 is the one instrument with no resolvable NON-NUMERIC acceptance case, and it is correctly
   * unexcused: its manifest declares `cauchyDiffusion` with `allowedStatuses: ["outside-domain"]`
   * and nothing else, so that output can only ever be a typed no-value. A reader reaches it by
   * choosing the Cauchy step law on the kernel control.
   *
   * A SECOND OWNER RATHER THAN A REPAIR TO walkKernelDiffusivity, for the same reason
   * kinematics.gammaTyped sits beside kinematics: that function THROWS unless the diffusion is a
   * value ("kernelDiffusivity did not return a diffusion value for a symmetric kernel"), which is
   * correct for the symmetric kernels it is documented to serve and leaves it unable to express
   * this refusal at all. Scenarios already reference it, so changing what it returns is a separate
   * decision with its own evidence.
   *
   * THE KERNEL CODE EXTENDS walkKernelDiffusivity'S CONVENTION rather than inventing one: 0 coin,
   * 1 uniform, 3 gaussian are WALK_KERNELS' own export-kernel-id numbers, and 4 is cauchy, which
   * has no export-kernel id because it is not a WalkKernel. Taking a code at all is what lets ONE
   * owner serve both the refusal and its control, and the control is the point: with codes 0, 1
   * and 3 this same call returns 1.25e-12 m^2/s at stepRms 5e-7 and tau 0.1, so the no-value is a
   * property of the Cauchy law rather than of this owner.
   */
  {
    id: "diffusion.kernelDiffusivityTyped",
    sourcePath: walkLawsPath,
    fn: (ctx) => {
      const code = num(ctx.inputs, "kernel");
      const tau = num(ctx.inputs, "tau");
      const kernel: StepKernel =
        code === 4
          ? { kind: "cauchy", scale: num(ctx.inputs, "stepRms") }
          : {
              kind: code === 0 ? "coin" : code === 1 ? "uniform" : "gaussian",
              stepRms: num(ctx.inputs, "stepRms"),
            };
      const result = kernelDiffusivity(kernel, tau).diffusion;
      const got = nonNumericOr(result as unknown as Record<string, unknown>, "cauchyDiffusion");
      return typeof got === "number" ? { cauchyDiffusion: got } : got;
    },
  },
  {
    id: "kinematics.gammaTyped",
    sourcePath: kinematicsPath,
    fn: (ctx) => {
      const result = gamma(num(ctx.inputs, "beta"));
      const got = nonNumericOr(result as unknown as Record<string, unknown>, "lorentzFactor");
      return typeof got === "number" ? { lorentzFactor: got } : got;
    },
  },
  /**
   * The collinear composition, whose own refusal is the one paper 3 section 5 is about: two subluminal
   * speeds compose to a subluminal speed, so a composition that left the open unit interval would be a
   * defect in the composition rule rather than in the inputs. The evaluator states both cases.
   */
  {
    id: "kinematics.composeCollinearTyped",
    sourcePath: kinematicsPath,
    fn: (ctx) => {
      const result = composeCollinear(num(ctx.inputs, "beta"), num(ctx.inputs, "beta2"));
      // Named as sr-06's own output is named, so a scenario pins the lab's vocabulary.
      const got = nonNumericOr(result as unknown as Record<string, unknown>, "composedSpeedOverC");
      return typeof got === "number" ? { composedSpeedOverC: got } : got;
    },
  },
  /**
   * THE WIEN ENTROPY DENSITY, WHICH HAS A DOMAIN AND A LIMIT (am-nxbq, item 2).
   *
   * AGENTS.md's `outside-domain` row names this case: "A Wien-only entropy comparison in a dense
   * state". Wien's law is the high-frequency, low-density form, and the entropy expression paper 1
   * builds on it has no standing where the density reaches A*nu^3. The evaluator states that as
   * `outside-wien-regime` with a model domain kind, and a reader who raises the density into the
   * Rayleigh-Jeans region reaches it.
   *
   * The same function also carries an `analytic-limit` at exactly zero density, with the description
   * "Entropy density vanishes continuously at zero radiation density": the expression contains
   * rho*ln(rho), which is a 0*(-infinity) the evaluator will not perform, and the limit is zero. So one
   * owner serves two different non-numeric cases on one quantity, and a scenario picks which by moving
   * the density.
   */
  {
    id: "radiation.wienSpectralEntropyDensity",
    sourcePath: fileURLToPath(
      new URL("../../physics/reference/radiation/entropy.ts", import.meta.url),
    ),
    fn: (ctx) => {
      const result = wienSpectralEntropyDensity(
        num(ctx.inputs, "spectralEnergyDensity"),
        num(ctx.inputs, "frequency"),
        getConstantSet(
          ctx.constantSetId === "modern-si-2019" ? "modern-si-2019" : "modern-si-2019",
        ),
      );
      const got = nonNumericOr(
        result as unknown as Record<string, unknown>,
        "spectralEntropyDensity",
      );
      return typeof got === "number" ? { spectralEntropyDensity: got } : got;
    },
  },
  /**
   * THE MASS COEFFICIENT AT VANISHING SPEED (am-nxbq, item 2).
   *
   * AGENTS.md's `analytic-limit` row names it beside the diffusion case: "the mass coefficient at
   * v = 0". The kinetic-energy difference and the proxy that divides by v^2/2 both go to zero there, so
   * the coefficient is a 0/0 the evaluator refuses to perform. `evaluateMe02` returns the limit
   * identified analytically instead, with a `coefficient` representation carrying L/c^2, and its own
   * docstring says "with no 0/0 division". A number computed by letting v be small instead would be the
   * step size talking.
   *
   * The snapshot's `limitingCoefficient` is ALWAYS this limit, at any speed, which is why the scenario
   * for it moves the speed to zero and reads `finiteSpeedProxy` as well: the two agree in the limit,
   * and `proxyEqualsLimit` in the same module is the check that says so.
   */
  /**
   * ME-02's LEDGER AT ONE SPEED, EXACT AND APPROXIMATE SIDE BY SIDE (am-nxbq, item 1).
   *
   * ME-02 reads the body's lost inertia from the SMALL-SPEED coefficient of its kinetic energy, and the
   * instrument's job is to show why the qualifier is there. The exact difference L(gamma - 1) and the
   * quadratic proxy L v squared over 2 c squared are both reported, with the relative gap between them,
   * because the gap is the subject: it is what tells a reader that the paper's conclusion is drawn in a
   * limit rather than at the speed on the slider.
   *
   * The existing per-output owners beside this one each return ONE quantity, which is right for a refusal
   * or a typed limit. A golden about the DIFFERENCE between two routes needs both in one reading.
   */
  {
    id: "massEnergy.me02Ledger",
    sourcePath: fileURLToPath(new URL("../../physics/reference/massEnergy.ts", import.meta.url)),
    fn: (ctx) => {
      const snapshot = evaluateMe02({
        beta: num(ctx.inputs, "beta"),
        emittedEnergy: num(ctx.inputs, "emittedEnergy"),
      }) as unknown as Record<string, unknown>;
      const numbers: Record<string, number> = {};
      for (const key of [
        "exactDifference",
        "quadraticApproximation",
        "quadraticDiscrepancy",
        "inertialMassDecrease",
        "massChangeSigned",
      ]) {
        const got = nonNumericOr(snapshot[key] as Record<string, unknown>, key);
        if (typeof got !== "number") return got;
        numbers[key] = got;
      }
      return numbers;
    },
  },
  {
    id: "massEnergy.limitingCoefficient",
    sourcePath: fileURLToPath(new URL("../../physics/reference/massEnergy.ts", import.meta.url)),
    fn: (ctx) => {
      const snapshot = evaluateMe02({
        beta: num(ctx.inputs, "beta"),
        emittedEnergy: num(ctx.inputs, "emittedEnergy"),
      });
      const got = nonNumericOr(
        snapshot.limitingCoefficient as unknown as Record<string, unknown>,
        "limitingCoefficient",
      );
      return typeof got === "number" ? { limitingCoefficient: got } : got;
    },
  },
  /**
   * The finite-speed proxy at exactly zero speed, which is the other half of the same story: the proxy
   * divides by v^2/2, so at v = 0 it has no value either, and the evaluator says which kind of
   * no-value it is rather than returning a NaN.
   */
  {
    id: "massEnergy.finiteSpeedProxy",
    sourcePath: fileURLToPath(new URL("../../physics/reference/massEnergy.ts", import.meta.url)),
    fn: (ctx) => {
      const snapshot = evaluateMe02({
        beta: num(ctx.inputs, "beta"),
        emittedEnergy: num(ctx.inputs, "emittedEnergy"),
      });
      const got = nonNumericOr(
        snapshot.finiteSpeedProxy as unknown as Record<string, unknown>,
        "finiteSpeedProxy",
      );
      return typeof got === "number" ? { finiteSpeedProxy: got } : got;
    },
  },
  /**
   * HOW WRONG THE LOW-SPEED PROXY IS WHERE IT IS WRONG (am-nxbq, item 1).
   *
   * AGENTS.md lists "the low-speed proxy is the exact mass coefficient at every speed" among the
   * adversarial fixtures this edition must hold, and until now nothing could express it: ME-02 computed
   * the excess and no owner read it. The quantity is (2 dK / v^2) / (L / c^2) - 1, the fraction by which
   * the finite-speed proxy overstates the coefficient the paper identifies, and it is a NUMBER at every
   * admitted speed rather than a refusal, which is what makes it a fixture rather than a guard: the
   * mistake produces an answer, and the answer is wrong by an amount this reports.
   *
   * The evaluator names `massEnergy.proxyExcess` as its own ownerId, so this entry takes that id rather
   * than the manifest's output name.
   */
  {
    id: "massEnergy.proxyExcess",
    sourcePath: fileURLToPath(new URL("../../physics/reference/massEnergy.ts", import.meta.url)),
    fn: (ctx) => {
      const snapshot = evaluateMe02({
        beta: num(ctx.inputs, "beta"),
        emittedEnergy: num(ctx.inputs, "emittedEnergy"),
      });
      const got = nonNumericOr(
        snapshot.proxyExcess as unknown as Record<string, unknown>,
        "proxyExcess",
      );
      return typeof got === "number" ? { proxyExcess: got } : got;
    },
  },
  {
    id: "photoelectric.stoppingPotentialTyped",
    sourcePath: fileURLToPath(new URL("../../physics/reference/photoelectric.ts", import.meta.url)),
    fn: (ctx) => {
      const result = stoppingPotentialFromEv(
        num(ctx.inputs, "frequency"),
        num(ctx.inputs, "workFunctionEv"),
      );
      const got = nonNumericOr(
        result as unknown as Record<string, unknown>,
        "stoppingPotentialMagnitude",
      );
      return typeof got === "number" ? { stoppingPotentialMagnitude: got } : got;
    },
  },
  {
    id: "inference.molecularNumber",
    sourcePath: fileURLToPath(new URL("../../physics/reference/inference.ts", import.meta.url)),
    fn: (ctx) => {
      const out: Record<string, number> = {};
      if (typeof ctx.inputs.degreesOfFreedom === "number") {
        const bias = inverseBias(ctx.inputs.degreesOfFreedom);
        if (bias.kind === "accepted") out.inverseBiasFactor = bias.data.meanFactor;
      }
      if (typeof ctx.inputs.coverageTrials === "number") {
        const res = empiricalCoverageFraction({
          trials: ctx.inputs.coverageTrials,
          nominalCoverage: ctx.inputs.nominalCoverage,
          degreesOfFreedom: ctx.inputs.degreesOfFreedom,
        });
        if (res.kind === "accepted") {
          out.empiricalCoverageFraction = res.data;
        }
      }
      if (typeof ctx.inputs.diffusionCoefficient !== "number") return out;
      const set = getConstantSet(ctx.constantSetId);
      const dHat = ctx.inputs.diffusionCoefficient;
      const T = ctx.inputs.temperature ?? 293.15;
      const eta = ctx.inputs.viscosity ?? 0.001;
      const a = ctx.inputs.particleRadius ?? 0.5e-6;
      const q = ctx.inputs.degreesOfFreedom ?? 100;
      const family = identifiabilityFamily(
        {
          D: dHat,
          T,
          eta,
          radiusRange: [0.25e-6, 1e-6],
          synthetic: ctx.constantSetId !== "modern-si-2019",
        },
        set,
      );
      if (family.kind === "accepted") {
        out.radiusNumberProduct = family.data.product;
        out.radiusNumberProductMicrometrePerMol = family.data.product * 1e6;
      }
      const band = chiSquareInterval({ dHat, q, alpha: 0.05 });
      if (band.kind !== "accepted") return out;
      const inverse = invertToMolecularNumber(
        {
          T,
          eta,
          a,
          radiusProvenance: "independently-declared",
          dHat,
          interval: band.data,
          synthetic: ctx.constantSetId !== "modern-si-2019",
        },
        set,
      );
      if (inverse.kind === "accepted") {
        out.avogadroNumberEstimate = inverse.data.estimate;
        out.intervalLower = inverse.data.interval.lower;
        out.intervalUpper = inverse.data.interval.upper;
      }
      return out;
    },
  },
  {
    id: "kinematics",
    sourcePath: kinematicsPath,
    fn: (ctx: OwnerContext) => {
      const out: Record<string, number> = {};
      const c = C;

      if (typeof ctx.inputs.speedMetresPerSecond === "number") {
        const beta = ctx.inputs.speedMetresPerSecond / c;
        const gm1 = gammaMinusOne(beta);
        if (gm1.status === "value") out.gammaMinusOne = gm1.value;
      }

      if (typeof ctx.inputs.lossPerDayS === "number") {
        const spd = speedForDailyLoss(ctx.inputs.lossPerDayS);
        if (spd.status === "value") out.speedForDailyLossBeta = spd.value;
      }

      const beta = ctx.inputs.beta;
      if (typeof beta === "number") {
        const g = gamma(beta);
        if (g.status === "value") out.gamma = g.value;

        const r = rapidity(beta);
        if (r.status === "value") out.rapidity = r.value;

        if (typeof ctx.inputs.speedMetresPerSecond !== "number") {
          const gm1 = gammaMinusOne(beta);
          if (gm1.status === "value") out.gammaMinusOne = gm1.value;
        }

        const loss = dilationLossPerSecond(beta);
        if (loss.status === "value") {
          out.dilationLossPerSecond = loss.value.exact;
          out.printedSecondOrderLoss = loss.value.printedSecondOrder;
        }

        if (typeof ctx.inputs.beta2 === "number") {
          const comp = composeCollinear(beta, ctx.inputs.beta2);
          if (comp.status === "value") out.composedCollinearBeta = comp.value;

          const shortfall = composedSpeedShortfall(beta, ctx.inputs.beta2);
          if (shortfall.status === "value") out.composedSpeedShortfall = shortfall.value;
        }

        if (typeof ctx.inputs.rodLengthLs === "number") {
          const cl = contractedLength(ctx.inputs.rodLengthLs, beta);
          if (cl.status === "value") out.contractedLengthLs = cl.value;

          const desync = desynchronization(ctx.inputs.rodLengthLs, beta, 1);
          if (desync.status === "value") out.desynchronizationS = desync.value;
        }

        if (typeof ctx.inputs.properTimeS === "number") {
          const di = dilatedInterval(ctx.inputs.properTimeS, beta);
          if (di.status === "value") out.dilatedIntervalS = di.value;
        }

        if (typeof ctx.inputs.deltaX === "number") {
          const boost = alignedBoost(beta, 1);
          if (boost.status === "value") {
            const ev0 = transformEvent({ t: 0, x: 0, y: 0, z: 0 }, boost.value);
            const ev1 = transformEvent({ t: 0, x: ctx.inputs.deltaX, y: 0, z: 0 }, boost.value);
            if (ev0.status === "value" && ev1.status === "value") {
              out.deltaTPrimeS = ev1.value.t - ev0.value.t;
              out.deltaXPrimeLs = ev1.value.x - ev0.value.x;
            }
          }
        }
      }
      return out;
    },
  },
  {
    id: "events",
    sourcePath: eventsPath,
    fn: (ctx) => {
      const out: Record<string, number> = {};

      if (
        typeof ctx.inputs.emissionTimeA === "number" &&
        typeof ctx.inputs.receptionTimeA === "number"
      ) {
        const round = synchronizationRound({
          emissionTimeA: ctx.inputs.emissionTimeA,
          receptionTimeA: ctx.inputs.receptionTimeA,
          separationLs: ctx.inputs.separationLs ?? 5,
        });
        if (round.status === "value") {
          out.assignedRemoteTime = round.value.assignedRemoteTime;
          out.roundTripSpeedLsPerS = round.value.roundTripSpeedLsPerS;
          out.criterionOffset = round.value.criterionOffset;
        }
      }

      if (typeof ctx.inputs.separationLs === "number" && typeof ctx.inputs.beta === "number") {
        const legs = movingRodLegs({
          separationLs: ctx.inputs.separationLs,
          beta: ctx.inputs.beta,
        });
        if (legs.status === "value") {
          out.outboundLegS = legs.value.outboundLegS;
          out.returnLegS = legs.value.returnLegS;
          out.tRoundTrip = legs.value.outboundLegS + legs.value.returnLegS;
        }
        const lightLegs = movingRodLightLegs(ctx.inputs.separationLs, ctx.inputs.beta, 1.0);
        if (lightLegs.status === "value") {
          out.desynchronization = lightLegs.value.desynchronization;
        }
      }

      if (
        typeof ctx.inputs.properSeparationLs === "number" &&
        typeof ctx.inputs.beta === "number"
      ) {
        const desync = desynchronizationObserved({
          properSeparationLs: ctx.inputs.properSeparationLs,
          beta: ctx.inputs.beta,
        });
        if (desync.status === "value") {
          out.desyncMagnitudeS = desync.value.desyncMagnitudeS;
        }
      }

      if (typeof ctx.inputs.coordinateTime === "number" && typeof ctx.inputs.beta === "number") {
        const dt = ctx.inputs.coordinateTime;
        const beta = ctx.inputs.beta;
        const prop = properTime(
          {
            kind: "piecewise-inertial",
            segments: [{ t0: 0, t1: dt, vx: beta }],
          },
          0,
          dt,
        );
        if (prop.status === "value") {
          out.properTimeS = prop.value.properTimeS;
          out.timeLossS = prop.value.timeLossS;
          out.ratio = prop.value.ratio;
        }
      }

      if (
        typeof ctx.inputs.beta === "number" &&
        ctx.inputs.coordinateTime === undefined &&
        ctx.inputs.separationLs === undefined &&
        ctx.inputs.properSeparationLs === undefined &&
        ctx.inputs.L0 === undefined
      ) {
        const beta = ctx.inputs.beta;
        const loss = dilationLossPerSecond(beta);
        if (loss.status === "value") {
          out.lossRate = loss.value.exact;
        }
      }

      if (typeof ctx.inputs.L0 === "number" && typeof ctx.inputs.beta === "number") {
        const lc = lightClock(ctx.inputs.L0, ctx.inputs.beta);
        if (lc.status === "value") {
          out.properTickPeriodS = lc.value.properTickPeriodS;
          out.coordinateTickPeriodS = lc.value.coordinateTickPeriodS;
          out.roundTripPathLengthLs = lc.value.roundTripPathLengthLs;
          out.longitudinalDistanceMovedLs = lc.value.longitudinalDistanceMovedLs;
          out.oneWayLightPathLs = lc.value.oneWayLightPathLs;
        }
      }

      return out;
    },
  },
  {
    id: "fields",
    sourcePath: fieldsPath,
    fn: (ctx: OwnerContext) => {
      const out: Record<string, number> = {};

      // SI transform & invariants
      if (
        typeof ctx.inputs.Ex === "number" &&
        typeof ctx.inputs.Ey === "number" &&
        typeof ctx.inputs.Ez === "number" &&
        typeof ctx.inputs.Bx === "number" &&
        typeof ctx.inputs.By === "number" &&
        typeof ctx.inputs.Bz === "number" &&
        typeof ctx.inputs.beta === "number"
      ) {
        const c = typeof ctx.inputs.c === "number" ? ctx.inputs.c : C_SI;
        const E = { x: ctx.inputs.Ex, y: ctx.inputs.Ey, z: ctx.inputs.Ez };
        const B = { x: ctx.inputs.Bx, y: ctx.inputs.By, z: ctx.inputs.Bz };
        const boost = ctx.inputs.beta * c;

        const tf = transformSI({ E, B, boost, c });
        out.EprimeX = tf.E.x;
        out.EprimeY = tf.E.y;
        out.EprimeZ = tf.E.z;
        out.BprimeX = tf.B.x;
        out.BprimeY = tf.B.y;
        out.BprimeZ = tf.B.z;
        out.gamma = tf.gamma;

        const inv0 = fieldInvariants(E, B, c);
        const invP = fieldInvariants(tf.E, tf.B, c);
        out.eDotB = inv0.eDotB;
        out.e2MinusC2B2 = inv0.e2MinusC2B2;
        out.eDotBPrime = invP.eDotB;
        out.e2MinusC2B2Prime = invP.e2MinusC2B2;
      }

      // Force consistency scenario
      if (
        typeof ctx.inputs.q === "number" &&
        typeof ctx.inputs.ux === "number" &&
        typeof ctx.inputs.uy === "number" &&
        typeof ctx.inputs.uz === "number" &&
        typeof ctx.inputs.Ex === "number" &&
        typeof ctx.inputs.Bx === "number" &&
        typeof ctx.inputs.beta === "number"
      ) {
        const c = typeof ctx.inputs.c === "number" ? ctx.inputs.c : C_SI;
        const q = ctx.inputs.q;
        const E = { x: ctx.inputs.Ex, y: ctx.inputs.Ey ?? 0, z: ctx.inputs.Ez ?? 0 };
        const B = { x: ctx.inputs.Bx, y: ctx.inputs.By ?? 0, z: ctx.inputs.Bz ?? 0 };
        const u = { x: ctx.inputs.ux, y: ctx.inputs.uy, z: ctx.inputs.uz };
        const res = forceConsistency(q, { E, B }, u, ctx.inputs.beta, c);
        out.FK_x = res.F_K.x;
        out.FK_y = res.F_K.y;
        out.FK_z = res.F_K.z;
        out.Fprime_x = res.F_prime_transformed.x;
        out.Fprime_y = res.F_prime_transformed.y;
        out.Fprime_z = res.F_prime_transformed.z;
        out.maxRelError = res.maxRelError;
      }

      // Dipole preset scenario
      if (typeof ctx.inputs.momentZ === "number" && typeof ctx.inputs.posX === "number") {
        const moment = { x: 0, y: 0, z: ctx.inputs.momentZ };
        const pos = { x: ctx.inputs.posX, y: 0, z: 0 };
        const B = dipoleField(moment, pos);
        out.Bz = B.z;
        out.Bmag = Math.abs(B.z);
        if (typeof ctx.inputs.speedY === "number") {
          const q = ELEMENTARY_CHARGE;
          const F = {
            x: -q * ctx.inputs.speedY * B.z,
            y: 0,
            z: 0,
          };
          out.forceMagnitude = Math.abs(F.x);
        }
      }

      // SR-02 EMF scenario
      if (
        typeof ctx.inputs.speed === "number" &&
        typeof ctx.inputs.magneticField === "number" &&
        typeof ctx.inputs.segmentLength === "number"
      ) {
        const snap = evaluateSr02({
          mode: "analytic",
          descriptionFrame: "magnet-rest",
          speed: ctx.inputs.speed,
          fieldModel: "uniform",
          magneticField: ctx.inputs.magneticField,
          dipoleMoment: 1,
          testPointDistance: 0.05,
          segmentLength: ctx.inputs.segmentLength,
          testCharge: ELEMENTARY_CHARGE,
          pathOrientation: "transverse",
          sliceDeclared: false,
        });
        if (snap.emfMagnet.status === "value") out.emfMagnet = snap.emfMagnet.value as number;
        if (snap.emfConductor.status === "value")
          out.emfConductor = snap.emfConductor.value as number;
        if (snap.emfExcess.status === "value") out.emfExcess = snap.emfExcess.value as number;
        if (snap.lorentzFactor.status === "value")
          out.lorentzFactor = snap.lorentzFactor.value as number;
      }

      // SR-08 frame change scenario
      if (
        typeof ctx.inputs.Ey === "number" &&
        typeof ctx.inputs.beta === "number" &&
        ctx.inputs.Ex === undefined
      ) {
        const beta = ctx.inputs.beta;
        const boost = beta * C_SI;
        const E = { x: 0, y: ctx.inputs.Ey, z: 0 };
        const B = { x: 0, y: 0, z: 0 };
        const tf = transformSI({ E, B, boost, c: C_SI });
        out.EprimeY = tf.E.y;
        out.BprimeZ = tf.B.z;
        out.gamma = tf.gamma;
      }

      // SR-12 neutral conductor scenario
      if (
        typeof ctx.inputs.rho === "number" &&
        typeof ctx.inputs.Jx === "number" &&
        typeof ctx.inputs.beta === "number" &&
        ctx.inputs.Ex === undefined
      ) {
        const c = typeof ctx.inputs.c === "number" ? ctx.inputs.c : C_SI;
        const boost = ctx.inputs.beta * c;
        const res = transformChargeCurrent({
          rho: ctx.inputs.rho,
          J: { x: ctx.inputs.Jx, y: 0, z: 0 },
          boost,
          c,
        });
        out.rhoPrime = res.rho;
        out.JprimeX = res.J.x;
        const inv = fourCurrentInvariants(res.rho, res.J, c);
        out.fourCurrentInvariant = inv.si;
      }

      // SR-12 moving sphere scenario
      if (
        typeof ctx.inputs.rho0 === "number" &&
        typeof ctx.inputs.radius === "number" &&
        typeof ctx.inputs.u === "number" &&
        typeof ctx.inputs.observerBeta === "number"
      ) {
        const res = movingSphereTotalCharge({
          rho0: ctx.inputs.rho0,
          radius: ctx.inputs.radius,
          u: ctx.inputs.u,
          observerBeta: ctx.inputs.observerBeta,
        });
        out.observedDensity = res.observedDensity;
        out.observedVolume = res.observedVolume;
        out.totalChargeAnalytic = res.totalChargeAnalytic;
        out.totalChargeQuadrature = res.totalChargeQuadrature;
        out.relativeGamma = res.relativeGamma;
      }

      // Plane wave residuals scenario
      if (
        typeof ctx.inputs.planeWaveBeta === "number" &&
        typeof ctx.inputs.E0 === "number" &&
        typeof ctx.inputs.omega === "number"
      ) {
        const res = maxwellResidualsPlaneWave({
          beta: ctx.inputs.planeWaveBeta,
          wave: "plus-x",
          polarization: "primary",
          E0: ctx.inputs.E0,
          omega: ctx.inputs.omega,
        });
        out.maxResidual = res.maxResidual;
        out.amplitudeFactor = res.amplitudeFactor;
        out.frequencyFactor = res.frequencyFactor;
      }

      return out;
    },
  },
  {
    id: "electron",
    sourcePath: electronPath,
    fn: (ctx: OwnerContext) => {
      const out: Record<string, number> = {};

      // Mass conventions scenario
      if (
        typeof ctx.inputs.beta === "number" &&
        ctx.inputs.eField === undefined &&
        ctx.inputs.t === undefined &&
        ctx.inputs.transverseE === undefined &&
        ctx.inputs.relationsBeta === undefined
      ) {
        const mass = typeof ctx.inputs.mass === "number" ? ctx.inputs.mass : ELECTRON_MASS;
        const beta = ctx.inputs.beta;
        const longM = longitudinalMass(mass, beta);
        const transMCom = transverseMassComoving(mass, beta);
        const transMLab = transverseMassLaboratory(mass, beta);
        if (longM.status === "value") out.longitudinalMass = longM.value as number;
        if (transMCom.status === "value") out.transverseMassComoving = transMCom.value as number;
        if (transMLab.status === "value") out.transverseMassLaboratory = transMLab.value as number;
      }

      // Energy & fixtures scenario (W, P, Rm, Re)
      if (
        typeof ctx.inputs.beta === "number" &&
        (typeof ctx.inputs.bField === "number" || typeof ctx.inputs.eField === "number")
      ) {
        const mass = typeof ctx.inputs.mass === "number" ? ctx.inputs.mass : ELECTRON_MASS;
        const charge =
          typeof ctx.inputs.charge === "number" ? ctx.inputs.charge : ELEMENTARY_CHARGE;
        const beta = ctx.inputs.beta;
        const ke = electronKineticEnergy(mass, beta);
        if (ke.exact.status === "value") out.kineticEnergyExact = ke.exact.value as number;
        if (ke.newtonian.status === "value")
          out.kineticEnergyNewtonian = ke.newtonian.value as number;
        out.kineticEnergyRatio = ke.ratio;

        const pot = electronAcceleratingPotential(beta, charge, mass);
        if (pot.exact.status === "value")
          out.acceleratingPotentialExact = pot.exact.value as number;
        if (pot.newtonian.status === "value")
          out.acceleratingPotentialNewtonian = pot.newtonian.value as number;

        if (typeof ctx.inputs.bField === "number") {
          const rm = electronMagneticRadius(beta, ctx.inputs.bField, charge, mass);
          if (rm.exact.status === "value")
            out.radiusCurvatureMagneticExact = rm.exact.value as number;
          if (rm.newtonian.status === "value")
            out.radiusCurvatureMagneticNewtonian = rm.newtonian.value as number;
        }

        if (typeof ctx.inputs.eField === "number") {
          const re = electronElectricRadius(beta, ctx.inputs.eField, charge, mass);
          if (re.exact.status === "value")
            out.radiusCurvatureElectricExact = re.exact.value as number;
          if (re.newtonian.status === "value")
            out.radiusCurvatureElectricNewtonian = re.newtonian.value as number;
        }
      }

      // Transverse field trajectory scenario
      if (
        typeof ctx.inputs.transverseE === "number" &&
        typeof ctx.inputs.v0x === "number" &&
        typeof ctx.inputs.t === "number"
      ) {
        const mass = typeof ctx.inputs.mass === "number" ? ctx.inputs.mass : ELECTRON_MASS;
        const charge =
          typeof ctx.inputs.charge === "number" ? ctx.inputs.charge : -ELEMENTARY_CHARGE;
        const pts = transverseFieldTrajectory(
          ctx.inputs.transverseE,
          ctx.inputs.v0x,
          ctx.inputs.t,
          1,
          charge,
          mass,
        );
        const last = pts[pts.length - 1];
        if (last) {
          out.x = last.x;
          out.y = last.y;
          out.speedRatio = last.speedRatio;
          out.gamma = last.gamma;
        }
      }

      // Relations scenario
      if (typeof ctx.inputs.relationsBeta === "number") {
        const beta = ctx.inputs.relationsBeta;
        const eMag = typeof ctx.inputs.relationsE === "number" ? ctx.inputs.relationsE : 1e5;
        const bMag = typeof ctx.inputs.relationsB === "number" ? ctx.inputs.relationsB : 0.01;
        const rel = threePrintedRelations(beta, eMag, bMag);
        if (rel.deflectabilityRatio.status === "value")
          out.deflectabilityRatio = rel.deflectabilityRatio.value as number;
        if (rel.potentialDifference.status === "value")
          out.potentialDifference = rel.potentialDifference.value as number;
        if (rel.magneticRadius.status === "value")
          out.magneticRadius = rel.magneticRadius.value as number;
        if (rel.electricRadius.status === "value")
          out.electricRadius = rel.electricRadius.value as number;
      }

      return out;
    },
  },
  {
    id: "massEnergy.box",
    sourcePath: fileURLToPath(new URL("../../physics/reference/massEnergy.ts", import.meta.url)),
    fn(ctx: OwnerContext): Record<string, number> {
      const M = typeof ctx.inputs.boxMass === "number" ? ctx.inputs.boxMass : 1.0;
      const ell = typeof ctx.inputs.boxLength === "number" ? ctx.inputs.boxLength : 1.0;
      const E = typeof ctx.inputs.pulseEnergy === "number" ? ctx.inputs.pulseEnergy : 1.0;
      const assignLightMass =
        typeof ctx.inputs.assignLightMass === "boolean"
          ? ctx.inputs.assignLightMass
          : ctx.inputs.assignLightMass !== 0;
      const box = evaluatePhotonBox({ M, ell, E, assignLightMass });
      const out: Record<string, number> = {};
      if (box.centerOfMassShift.status === "value")
        out.centerOfMassShift = box.centerOfMassShift.value as number;
      if (box.boxDisplacement.status === "value")
        out.boxDisplacement = box.boxDisplacement.value as number;
      if (box.recoilSpeed.status === "value") out.recoilSpeed = box.recoilSpeed.value as number;
      if (box.pulseFlightTime.status === "value")
        out.pulseFlightTime = box.pulseFlightTime.value as number;
      if (box.pulseMomentum.status === "value")
        out.pulseMomentum = box.pulseMomentum.value as number;
      if (box.lightMassAssigned.status === "value")
        out.lightMassAssigned = box.lightMassAssigned.value as number;
      return out;
    },
  },
  {
    id: "mass-energy",
    sourcePath: fileURLToPath(new URL("../../physics/reference/massEnergy.ts", import.meta.url)),
    fn(ctx: OwnerContext): Record<string, number> {
      const emittedEnergyJoules =
        ctx.inputs.emittedEnergyJoules ??
        ctx.inputs.emittedEnergy ??
        (typeof ctx.inputs.emittedEnergyErg === "number"
          ? ctx.inputs.emittedEnergyErg / 1e7
          : undefined);
      if (emittedEnergyJoules === undefined) {
        throw new Error('Owner "mass-energy" requires emittedEnergyJoules or emittedEnergy input.');
      }
      const res = printedMassConversion({ emittedEnergyJoules });
      if (res.status !== "value") {
        throw new Error(`printedMassConversion returned status "${res.status}".`);
      }
      return {
        printed: res.printed.value,
        modern: res.modern.value,
        ratioModernToPrinted: res.comparison.ratioModernToPrinted,
        ratio: res.comparison.ratio,
        relativeDifference: res.comparison.relativeDifference,
      };
    },
  },
  {
    id: "massEnergy.printedFactor",
    sourcePath: fileURLToPath(new URL("../../physics/reference/massEnergy.ts", import.meta.url)),
    fn(ctx: OwnerContext): Record<string, number> {
      const emittedEnergyJoules =
        ctx.inputs.emittedEnergyJoules ??
        ctx.inputs.emittedEnergy ??
        (typeof ctx.inputs.emittedEnergyErg === "number"
          ? ctx.inputs.emittedEnergyErg / 1e7
          : undefined);
      if (emittedEnergyJoules === undefined) {
        throw new Error(
          'Owner "massEnergy.printedFactor" requires emittedEnergyJoules or emittedEnergy input.',
        );
      }
      const res = printedMassConversion({ emittedEnergyJoules });
      if (res.status !== "value") {
        throw new Error(`printedMassConversion returned status "${res.status}".`);
      }
      return {
        printed: res.printed.value,
        modern: res.modern.value,
        ratioModernToPrinted: res.comparison.ratioModernToPrinted,
        ratio: res.comparison.ratio,
        relativeDifference: res.comparison.relativeDifference,
      };
    },
  },
  {
    id: "shelf-optics",
    sourcePath: shelfOpticsPath,
    fn: (ctx: OwnerContext) => {
      const out: Record<string, number> = {};

      // Michelson-Morley
      if (
        typeof ctx.inputs.waterPathPerBeam !== "number" &&
        (typeof ctx.inputs.length === "number" ||
          typeof ctx.inputs.lengthParallel === "number" ||
          typeof ctx.inputs.pathInWavelengths === "number")
      ) {
        const contraction = Boolean(ctx.inputs.contraction);
        const shiftRes = michelsonMorleyFringeShift({
          length: ctx.inputs.length,
          lengthParallel: ctx.inputs.lengthParallel,
          lengthPerpendicular: ctx.inputs.lengthPerpendicular,
          pathInWavelengths: ctx.inputs.pathInWavelengths,
          wavelength: ctx.inputs.wavelength,
          windSpeed: ctx.inputs.windSpeed,
          beta: ctx.inputs.beta,
          contraction,
          constantSet: ctx.constantSetId,
        });

        if (shiftRes.timeParallel.status === "value") {
          out.timeParallel = shiftRes.timeParallel.value as number;
        }
        if (shiftRes.timePerpendicular.status === "value") {
          out.timePerpendicular = shiftRes.timePerpendicular.value as number;
        }
        if (shiftRes.timeDifference.status === "value") {
          out.timeDifference = shiftRes.timeDifference.value as number;
        }
        if (shiftRes.fringeShift.status === "value") {
          out.fringeShift = shiftRes.fringeShift.value as number;
        }
        if (Number.isFinite(shiftRes.expectedFringeShiftFirstOrder)) {
          out.expectedFringeShiftFirstOrder = shiftRes.expectedFringeShiftFirstOrder;
        }
        if (Number.isFinite(shiftRes.gamma)) {
          out.gamma = shiftRes.gamma;
        }
        if (Number.isFinite(shiftRes.beta)) {
          out.beta = shiftRes.beta;
        }
      }

      // Fizeau moving water
      if (typeof ctx.inputs.waterPathPerBeam === "number") {
        const dragHypothesis =
          ctx.inputs.dragHypothesis === 1
            ? "full-drag"
            : ctx.inputs.dragHypothesis === 0
              ? "no-drag"
              : "fresnel-drag";
        const reversal = Boolean(ctx.inputs.reversal);

        const fizeau = fizeauFringeShift({
          waterPathPerBeam: ctx.inputs.waterPathPerBeam,
          waterSpeed: ctx.inputs.waterSpeed,
          waterSpeedFractionOfC: ctx.inputs.waterSpeedFractionOfC,
          refractiveIndex: ctx.inputs.refractiveIndex ?? 1.333,
          wavelength: ctx.inputs.wavelength ?? 5.3e-7,
          dragHypothesis,
          reversal,
          constantSet: ctx.constantSetId,
        });

        if (fizeau.fringeShift.status === "value") {
          out.fringeShift = fizeau.fringeShift.value as number;
        }
        if (fizeau.fringeShiftFirstOrder.status === "value") {
          out.fringeShiftFirstOrder = fizeau.fringeShiftFirstOrder.value as number;
        }
        if (fizeau.dragCoefficient.status === "value") {
          out.dragCoefficient = fizeau.dragCoefficient.value as number;
        }
        if (fizeau.timeDifference.status === "value") {
          out.timeDifference = fizeau.timeDifference.value as number;
        }
        if (fizeau.speedAlongFlow.status === "value") {
          out.speedAlongFlow = fizeau.speedAlongFlow.value as number;
        }
        if (fizeau.speedAgainstFlow.status === "value") {
          out.speedAgainstFlow = fizeau.speedAgainstFlow.value as number;
        }
      }

      // Standalone dragged speeds
      if (typeof ctx.inputs.draggedWaterSpeed === "number") {
        const n = ctx.inputs.refractiveIndex ?? 1.333;
        const v = ctx.inputs.draggedWaterSpeed;

        const fresnel = fresnelDraggedSpeed({
          refractiveIndex: n,
          waterSpeed: v,
          constantSet: ctx.constantSetId,
        });
        if (fresnel.draggedSpeed.status === "value") {
          out.draggedSpeed = fresnel.draggedSpeed.value as number;
        }
        if (fresnel.velocityIncrement.status === "value") {
          out.velocityIncrement = fresnel.velocityIncrement.value as number;
        }
        if (fresnel.dragCoefficient.status === "value") {
          out.dragCoefficient = fresnel.dragCoefficient.value as number;
        }

        const rel = relativisticDraggedSpeed({
          refractiveIndex: n,
          waterSpeed: v,
          constantSet: ctx.constantSetId,
        });
        if (rel.velocityIncrement.status === "value") {
          out.relativisticVelocityIncrement = rel.velocityIncrement.value as number;
        }
        if (rel.relativeDifferenceToFresnel.status === "value") {
          out.relativeDifferenceToFresnel = rel.relativeDifferenceToFresnel.value as number;
        }
        if (rel.secondOrderTerm.status === "value") {
          out.secondOrderTerm = rel.secondOrderTerm.value as number;
        }
      }

      // Wave equation residual
      if (typeof ctx.inputs.wavenumber === "number") {
        const map = ctx.inputs.isLorentz === 1 ? "lorentz" : "galilean";
        const wave = waveEquationResidual({
          map,
          beta: ctx.inputs.beta,
          frameSpeed: ctx.inputs.frameSpeed,
          wavenumber: ctx.inputs.wavenumber,
          constantSet: ctx.constantSetId,
        });

        if (wave.relativeResidual.status === "value") {
          out.relativeResidual = wave.relativeResidual.value as number;
        }
        if (wave.maxResidual.status === "value") {
          out.maxResidual = wave.maxResidual.value as number;
        }
        if (Number.isFinite(wave.crossTermCoefficient)) {
          out.crossTermCoefficient = wave.crossTermCoefficient;
        }
      }

      return out;
    },
  },
];

/**
 * ONE OWNER PER LABORATORY FOR THE DECLARED-DOMAIN REFUSAL (am-nxbq, items 2 and 3).
 *
 * AGENTS.md makes a refusal acceptance case mandatory, and the census said 0 of 33 instruments had
 * one. The reason was not that the labs do not refuse: every lab's parameters module calls
 * `refuseOutsideDeclaredDomain`, which raises the registry code `outside-model-domain` with the
 * manifest's own range and reason, and that is the refusal a READER reaches by typing a value into a
 * control. What was missing was a way for a scenario to drive it, because no owner reached a
 * `makeRefusal` path at all; the reference evaluators return typed `outside-domain` EVALUATIONS, which
 * are non-numeric results and a different thing.
 *
 * THE RANGES ARE NOT RESTATED HERE. `src/generated/model-domains.ts` is generated from
 * `content/experiments/<id>.yaml`, so a bound is written once in the manifest, and this reads the same
 * table every lab reads. A scenario that moved a control outside a range this file had copied would be
 * testing the copy.
 *
 * `reasonCode` is the bound that was broken, written as `below-min` or `above-max`, rather than the
 * requirement SENTENCE. The sentence is assembled from the manifest's label, range and reason and is
 * reworded whenever the prose is improved; pinning it in 33 scenarios would make correct editorial
 * work turn them red, which is the brittleness AGENTS.md describes when it says a count is for
 * reporting and a property is for asserting. Which side of the range was broken is a property.
 *
 * THE ACCEPTED BRANCH ECHOES THE SETTINGS, deliberately and with nothing hidden in it. This owner is a
 * domain gate, not a physical model: its two answers are "that setting is outside the declared range,
 * here is the refusal" and "every setting you gave me is inside it, here they are unchanged". No
 * scenario asserts physics through the echo, and a scenario declaring a refusal that does not arrive
 * fails on the runner's fourth branch, which is what stops a stale expectation passing the day a range
 * widens.
 */
function declaredDomainOwner(labId: string): OwnerFn {
  return (ctx) => {
    const refusal = refuseOutsideDeclaredDomain(labId, ctx.inputs);
    if (refusal) {
      const parameterId = refusal.refusal.affected.parameterIds?.[0] ?? "";
      const domain = declaredDomains(labId)[parameterId];
      const value = ctx.inputs[parameterId];
      // Which side, computed from the same predicate the lab uses rather than guessed from the sign.
      const belowMin =
        domain?.min !== undefined &&
        value !== undefined &&
        (domain.minInclusive === false ? value <= domain.min : value < domain.min);
      return {
        refused: {
          outputId: parameterId,
          status: refusal.refusal.code,
          reasonCode: belowMin ? "below-min" : "above-max",
        },
      };
    }
    return { ...ctx.inputs };
  };
}

const declaredDomainPath = fileURLToPath(
  new URL("../../experiments/controls/declaredDomain.ts", import.meta.url),
);

for (const labId of Object.keys(MODEL_DOMAINS)) {
  OWNERS.push({
    id: `declaredDomain.${labId}`,
    sourcePath: declaredDomainPath,
    fn: declaredDomainOwner(labId),
  });
}

/**
 * Ids appearing more than once, in first-seen order.
 *
 * Exported and pure so the guard below can be proved in BOTH directions from a test that does not
 * depend on the registry being broken: a list with a repeat must be reported and a list without one
 * must come back empty. A gate whose only proof is the population it guards cannot be shown to work
 * until it is already failing.
 */
export function duplicateOwnerIds(ids: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) repeated.add(id);
    seen.add(id);
  }
  return [...repeated];
}

/**
 * TWO ENTRIES WITH ONE ID ARE A SILENT SUBSTITUTION, WHICH IS WHY THIS THROWS AT LOAD (am-nxbq).
 *
 * `new Map(entries)` keeps the LAST entry for a repeated key, so a second owner added under an
 * existing id does not collide, does not warn, and does not lose: it quietly replaces the other one
 * for every scenario that names it, or is itself replaced depending on which appears later in the
 * file. Found by making the mistake: a second "sr02.session" meant a scenario was evaluated by the
 * wrong owner and refused on an output the intended owner never reads, with nothing to say so.
 *
 * Refusing at module load rather than at lookup is deliberate. The defect is in the REGISTRY and is
 * the same for every caller, so the first import should state it, and a per-lookup check would only
 * fire for scenarios that happened to name the shadowed id.
 */
const repeatedOwnerIds = duplicateOwnerIds(OWNERS.map((owner) => owner.id));
if (repeatedOwnerIds.length > 0)
  throw new OwnerContractError(
    "owner-id-duplicated",
    `${repeatedOwnerIds.length} scenario owner id(s) are registered twice: ${repeatedOwnerIds.join(", ")}. ` +
      "A repeated id is resolved by position rather than refused, so one of the two owners is silently " +
      "unreachable and scenarios naming it are evaluated by the other. Give each owner its own id.",
  );

export const OWNER_REGISTRY: ReadonlyMap<string, OwnerRecord> = new Map(
  OWNERS.map((owner) => [owner.id, owner]),
);

export function getOwner(id: string): OwnerRecord {
  const owner = OWNER_REGISTRY.get(id);
  if (!owner) throw new Error(`Unknown scenario owner "${id}".`);
  return owner;
}

export function ownerSourceMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const owner of OWNER_REGISTRY.values()) out[owner.id] = owner.sourcePath;
  return out;
}
