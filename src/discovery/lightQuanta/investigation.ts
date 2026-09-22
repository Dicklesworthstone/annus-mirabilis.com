/** Journey I teaching composition. Numerical laws remain in the existing LQ owners.
 * This is an executable explanatory preview, not a publication of the reviewed journey.
 */
import { LQ04_DEFAULTS, LQ04_OUTPUTS } from "../../experiments/lq04/definition.ts";
import { validateLq04Parameters } from "../../experiments/lq04/parameters.ts";
import { evaluateLq04 } from "../../experiments/lq04/session.ts";
import { LQ06_DEFAULTS, LQ06_OUTPUTS } from "../../experiments/lq06/definition.ts";
import { evaluateLq06 } from "../../experiments/lq06/session.ts";
import { LQ08_DEFAULTS, LQ08_OUTPUTS } from "../../experiments/lq08/definition.ts";
import { validateLq08Parameters } from "../../experiments/lq08/parameters.ts";
import { evaluateLq08 } from "../../experiments/lq08/session.ts";
import { ExperimentRuntimeError } from "../../experiments/refusal.ts";
import { decodeResult, encodeResult, parseResult } from "../../experiments/results/codec.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import {
  type AcceptedSnapshot,
  createInstanceStore,
  type OutputContract,
} from "../../experiments/store/instanceStore.ts";
import {
  independentPointsProbability,
  lockedPositionsProbability,
} from "../../physics/reference/radiation/configurations.ts";

export const LIGHT_INVESTIGATION_MODEL = "light-quanta-investigation-v1";
export const LIGHT_INVESTIGATION_CONSTANTS = "modern-si-2019";
export const LIGHT_INVESTIGATION_DEFAULTS = Object.freeze({
  frequency: 6e14,
  referenceTemperature: 3000,
  bandwidth: 1e12,
  referenceVolume: 1e-3,
  volumeRatio: 0.5,
  pointCount: 3,
  incidentPower: 0.001,
  workFunction: 2,
  quantumEfficiency: 0.1,
  collectorPotential: 0,
});
export type LightInvestigationParameters = {
  readonly [K in keyof typeof LIGHT_INVESTIGATION_DEFAULTS]: number;
};
export type LightInvestigationKey = keyof LightInvestigationParameters;
const KEYS = Object.keys(LIGHT_INVESTIGATION_DEFAULTS) as LightInvestigationKey[];

const ENTROPY_FIELDS = [
  "radiationEnergy",
  "radiationEntropy",
  "entropyVolumeCoefficient",
  "initialTemperature",
  "finalTemperature",
  "initialX",
  "finalX",
] as const;
const MATCH_FIELDS = ["effectiveIndependentCount", "quantumEnergy", "quantumEnergyEv"] as const;
const PHOTO_FIELDS = [
  "maxKineticEnergy",
  "stoppingPotentialMagnitude",
  "quantumRate",
  "emissionRate",
  "photocurrent",
] as const;
const contract = (semanticKind: string, ownerId: string): OutputContract =>
  Object.freeze({
    unit: "1",
    semanticKind,
    ownerId,
    statuses: ["value"] as const,
  });
function existing(source: Readonly<Record<string, OutputContract>>, id: string): OutputContract {
  const result = source[id];
  if (!result)
    throw new ExperimentRuntimeError("missing-output-contract", `Missing ${id} contract.`);
  return result;
}
export const LIGHT_INVESTIGATION_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  ...Object.fromEntries(
    ENTROPY_FIELDS.map((id) => [
      id,
      {
        ...existing(LQ04_OUTPUTS, id),
        statuses: ["value", "outside-domain"],
      },
    ]),
  ),
  ...Object.fromEntries(
    MATCH_FIELDS.map((id) => [
      id,
      {
        ...existing(LQ06_OUTPUTS, id),
        statuses: ["value", "outside-domain"],
      },
    ]),
  ),
  ...Object.fromEntries(PHOTO_FIELDS.map((id) => [id, existing(LQ08_OUTPUTS, id)])),
  independentProbability: contract("probability", "radiation.independentPointsProbability"),
  lockedProbability: contract("probability", "radiation.lockedPositionsProbability"),
  logIndependentProbability: contract("log-probability", "radiation.independentPointsProbability"),
  logLockedProbability: contract("log-probability", "radiation.lockedPositionsProbability"),
});

function entropyParameters(p: LightInvestigationParameters) {
  return {
    ...LQ04_DEFAULTS,
    frequency: p.frequency,
    referenceTemperature: p.referenceTemperature,
    bandwidth: p.bandwidth,
    referenceVolume: p.referenceVolume,
    volumeRatio: p.volumeRatio,
  };
}
function photoParameters(p: LightInvestigationParameters) {
  return {
    ...LQ08_DEFAULTS,
    frequency: p.frequency,
    incidentPower: p.incidentPower,
    workFunction: p.workFunction,
    quantumEfficiency: p.quantumEfficiency,
    collectorPotential: p.collectorPotential,
  };
}

/** Reject malformed input before issuing a request; a failed edit never erases accepted evidence. */
export function validateLightInvestigation(input: unknown): LightInvestigationParameters {
  const fail = (message: string): never => {
    throw new ExperimentRuntimeError("parameters-rejected", message, "light-quanta-investigation");
  };
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    return fail("Use a complete investigation settings record.");
  const fields = Reflect.ownKeys(input);
  if (
    fields.length !== KEYS.length ||
    fields.some((key) => typeof key !== "string" || !KEYS.includes(key as LightInvestigationKey))
  )
    return fail("Use only the complete, named investigation settings.");
  for (const key of KEYS) {
    const d = Object.getOwnPropertyDescriptor(input, key);
    if (
      !d?.enumerable ||
      !Object.hasOwn(d, "value") ||
      typeof d.value !== "number" ||
      !Number.isFinite(d.value)
    )
      return fail(`${key} must be a finite number stored as data.`);
  }
  const p = input as LightInvestigationParameters;
  if (p.frequency < 3e14 || p.frequency > 1.2e15)
    return fail("Use a frequency from 300 to 1200 THz in this investigation.");
  if (p.referenceTemperature < 1200 || p.referenceTemperature > 10000)
    return fail("Use a reference temperature from 1200 to 10000 K.");
  if (p.volumeRatio > 1 || p.volumeRatio < 0.0001)
    return fail("The counting comparison uses a subvolume fraction from 0.0001 to 1.");
  if (!Number.isSafeInteger(p.pointCount) || p.pointCount < 1 || p.pointCount > 60)
    return fail("Use 1 to 60 independently placed points.");
  if (p.incidentPower < 0 || p.incidentPower > 0.01 || p.workFunction < 0 || p.workFunction > 6)
    return fail("Use optical power from 0 to 10 mW and exit cost from 0 to 6 eV.");
  const entropy = validateLq04Parameters(entropyParameters(p));
  const photo = validateLq08Parameters(photoParameters(p));
  for (const check of [entropy, photo]) {
    if (check.kind !== "accepted")
      return fail(
        check.kind === "refused"
          ? String(check.refusal.details?.requirements ?? check.refusal.message)
          : "These settings exceed the laboratory's supported range.",
      );
  }
  return Object.freeze({ ...p });
}

function value(quantityId: string, number: number): ScientificResult {
  const c = existing(LIGHT_INVESTIGATION_OUTPUTS, quantityId);
  return decodeResult({
    quantityId,
    ownerId: c.ownerId,
    semanticKind: c.semanticKind,
    unit: c.unit,
    status: "value",
    value: number,
  });
}

/** One calculation produces the entire chain, with a model-domain gate on the inference edge.
 * Counting remains a separate toy model. The photoelectric branch explicitly ASSUMES complete
 * single-quantum transfer; it is not used as evidence that the entropy interpretation is unique.
 */
export function evaluateLightInvestigation(input: unknown): readonly ScientificResult[] {
  const p = validateLightInvestigation(input);
  const entropy = evaluateLq04(entropyParameters(p));
  const outputs: ScientificResult[] = [];
  if (entropy.status === "outside-domain") {
    for (const quantityId of [...ENTROPY_FIELDS, ...MATCH_FIELDS]) {
      const c = existing(LIGHT_INVESTIGATION_OUTPUTS, quantityId);
      outputs.push(
        decodeResult({
          quantityId,
          ownerId: c.ownerId,
          semanticKind: c.semanticKind,
          unit: c.unit,
          status: "outside-domain",
          condition: entropy.condition,
          domainKind: entropy.domainKind,
          reason: entropy.reason,
          boundary: {
            alternativeModel:
              "Return to a narrow, dilute Wien state before matching its entropy coefficient.",
          },
        }),
      );
    }
  } else {
    for (const quantityId of ENTROPY_FIELDS) {
      const field = quantityId === "radiationEnergy" ? "energy" : quantityId;
      outputs.push(value(quantityId, entropy[field]));
    }
    // Handoff the actual LQ-04 energy, never LQ-06's rounded default or a stale prior result.
    const matched = evaluateLq06({
      ...LQ06_DEFAULTS,
      radiationEnergy: entropy.energy,
      frequency: p.frequency,
      volumeRatio: p.volumeRatio,
      gasParticles: p.pointCount,
      temperature: p.referenceTemperature,
      constantSetId: LIGHT_INVESTIGATION_CONSTANTS,
    });
    outputs.push(
      ...matched.filter((o) => (MATCH_FIELDS as readonly string[]).includes(o.quantityId)),
    );
  }
  const independent = independentPointsProbability(p.pointCount, p.volumeRatio);
  const locked = lockedPositionsProbability(p.pointCount, p.volumeRatio);
  outputs.push(
    value("independentProbability", independent.value),
    value("logIndependentProbability", independent.lnW),
    value("lockedProbability", locked.value),
    value("logLockedProbability", Math.log(locked.value)),
  );
  outputs.push(
    ...evaluateLq08(photoParameters(p)).filter((o) =>
      (PHOTO_FIELDS as readonly string[]).includes(o.quantityId),
    ),
  );
  return Object.freeze(outputs.map(decodeResult));
}

export type PreparedLightInvestigation = Readonly<{
  modelId: typeof LIGHT_INVESTIGATION_MODEL;
  constantSetId: typeof LIGHT_INVESTIGATION_CONSTANTS;
  sourceDigest: string;
  parameters: LightInvestigationParameters;
  results: readonly string[];
}>;

/** Preserve build-time values on hydration. Transcendentals may differ by last bits across
 * engines, but status, identity, zero/nonzero, and the bounded scalar values must agree. */
function equivalentPreparedResults(
  a: readonly ScientificResult[],
  b: readonly ScientificResult[],
): boolean {
  return (
    a.length === b.length &&
    a.every((x, i) => {
      const y = b[i];
      if (!y) return false;
      if (x.status !== "value" || y.status !== "value") return encodeResult(x) === encodeResult(y);
      if (typeof x.value !== "number" || typeof y.value !== "number") return false;
      const { value: xv, ...xi } = x,
        { value: yv, ...yi } = y;
      return (
        JSON.stringify(xi) === JSON.stringify(yi) &&
        (xv === 0 || yv === 0
          ? xv === yv
          : Math.abs(xv - yv) <= 1e-12 * Math.max(Math.abs(xv), Math.abs(yv)))
      );
    })
  );
}

export function createLightInvestigationSession(
  instanceId: string,
  example?: PreparedLightInvestigation,
) {
  const parameters = validateLightInvestigation(
    example?.parameters ?? LIGHT_INVESTIGATION_DEFAULTS,
  );
  const evaluated = evaluateLightInvestigation(parameters);
  const outputs = example ? example.results.map(parseResult) : evaluated;
  if (
    example &&
    (example.modelId !== LIGHT_INVESTIGATION_MODEL ||
      example.constantSetId !== LIGHT_INVESTIGATION_CONSTANTS ||
      !/^source:sha256:[a-f0-9]{64}$/.test(example.sourceDigest) ||
      !equivalentPreparedResults(outputs, evaluated))
  )
    throw new ExperimentRuntimeError(
      "prepared-example-mismatch",
      "The worked example does not match this investigation owner.",
    );
  const store = createInstanceStore({
    experimentId: "light-quanta-investigation",
    instanceId,
    initialParameters: parameters,
    parameterClasses: Object.fromEntries(KEYS.map((k) => [k, "input" as const])),
    outputs: LIGHT_INVESTIGATION_OUTPUTS,
    allowPartial: true,
  });
  const initial = store.issue("setup-change");
  const first = store.publish({
    ...initial,
    outputs,
    stepIndex: 0,
    simulationTime: 0,
    final: true,
  });
  if (!first.accepted) throw new ExperimentRuntimeError("publication-refused", first.reason);
  const serverSnapshot = store.getSnapshot();
  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    apply(input: unknown) {
      let p: LightInvestigationParameters;
      let next: readonly ScientificResult[];
      try {
        p = validateLightInvestigation(input);
        next = evaluateLightInvestigation(p);
      } catch (error) {
        return {
          kind: "refused" as const,
          message:
            error instanceof Error ? error.message : "The calculation could not be completed.",
        };
      }
      const request = store.issue("setup-change", p);
      const accepted = store.publish({
        ...request,
        outputs: next,
        stepIndex: 0,
        simulationTime: 0,
        final: true,
      });
      if (!accepted.accepted)
        throw new ExperimentRuntimeError("publication-refused", accepted.reason);
      return { kind: "accepted" as const };
    },
  });
}

export type InvestigationPerturbation =
  | "halve-volume"
  | "double-power"
  | "raise-frequency"
  | "raise-exit-cost";
export function perturbInvestigation(
  p: LightInvestigationParameters,
  action: InvestigationPerturbation,
): LightInvestigationParameters {
  switch (action) {
    case "halve-volume":
      return validateLightInvestigation({ ...p, volumeRatio: p.volumeRatio / 2 });
    case "double-power":
      return validateLightInvestigation({ ...p, incidentPower: p.incidentPower * 2 });
    case "raise-frequency":
      return validateLightInvestigation({ ...p, frequency: p.frequency * 1.1 });
    case "raise-exit-cost":
      return validateLightInvestigation({ ...p, workFunction: p.workFunction + 0.5 });
    default:
      throw new ExperimentRuntimeError(
        "unknown-perturbation",
        "Choose a named investigation change.",
      );
  }
}

/** Comparisons name all changed settings, rather than implying a one-variable test after free edits. */
export function changedInvestigationInputs(
  before: AcceptedSnapshot,
  after: AcceptedSnapshot,
): readonly LightInvestigationKey[] {
  return KEYS.filter((key) => !Object.is(before.parameters[key], after.parameters[key]));
}
