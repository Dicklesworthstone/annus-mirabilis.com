/** Portable, versioned settings and accepted evidence. Private prediction notes never enter this wire format. */
import { LQ06_DEFAULTS } from "../../experiments/lq06/definition.ts";
import { encodeLq06Settings } from "../../experiments/lq06/permalink.ts";
import { ExperimentRuntimeError } from "../../experiments/refusal.ts";
import { decodeResult, encodeResult } from "../../experiments/results/codec.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { parseScaledDecimal } from "../../units/decimalScale.ts";
import {
  changedInvestigationInputs,
  LIGHT_INVESTIGATION_CONSTANTS,
  LIGHT_INVESTIGATION_DEFAULTS,
  LIGHT_INVESTIGATION_MODEL,
  LIGHT_INVESTIGATION_OUTPUTS,
  type LightInvestigationParameters,
  validateLightInvestigation,
} from "./investigation.ts";

export const LIGHT_INVESTIGATION_PATH = "/discover/light-quanta/investigate/";
const KEYS = Object.keys(LIGHT_INVESTIGATION_DEFAULTS);
const DIGEST = /^source:sha256:[a-f0-9]{64}$/;
const REQUIRED = ["investigation", "model", "source", ...KEYS];

export type SharedLightInvestigation =
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "invalid"; message: string }>
  | Readonly<{ kind: "settings"; parameters: LightInvestigationParameters; sourceDigest: string }>;

export function encodeLightInvestigationSettings(
  input: LightInvestigationParameters,
  sourceDigest: string,
): string {
  const p = validateLightInvestigation(input);
  if (!DIGEST.test(sourceDigest))
    throw new ExperimentRuntimeError(
      "source-digest-invalid",
      "The shared calculation needs its source digest.",
    );
  const q = new URLSearchParams({
    investigation: "1",
    model: LIGHT_INVESTIGATION_MODEL,
    source: sourceDigest,
  });
  for (const key of KEYS) {
    const value = p[key as keyof LightInvestigationParameters];
    q.set(key, Object.is(value, -0) ? "-0" : String(value));
  }
  return `?${q}`;
}

export function decodeLightInvestigationSettings(search: string): SharedLightInvestigation {
  const invalid = (): SharedLightInvestigation => ({
    kind: "invalid",
    message:
      "This investigation link is incomplete or unsupported. The worked result is unchanged.",
  });
  if (!search || search === "?") return { kind: "absent" };
  if (search.length > 4096) return invalid();
  const q = new URLSearchParams(search);
  if (![...q.keys()].some((key) => REQUIRED.includes(key))) return { kind: "absent" };
  if (
    REQUIRED.some((key) => q.getAll(key).length !== 1) ||
    [...q.keys()].some((key) => !REQUIRED.includes(key)) ||
    q.get("investigation") !== "1" ||
    q.get("model") !== LIGHT_INVESTIGATION_MODEL
  )
    return invalid();
  try {
    const sourceDigest = q.get("source") ?? "";
    if (!DIGEST.test(sourceDigest)) return invalid();
    const parameters = validateLightInvestigation(
      Object.fromEntries(KEYS.map((key) => [key, parseScaledDecimal(q.get(key) ?? "", 0)])),
    );
    return { kind: "settings", parameters, sourceDigest };
  } catch {
    return invalid();
  }
}

/** A same-session accepted result is the input boundary. No physics is rerun to export it. */
function evidenceSnapshot(snapshot: AcceptedSnapshot) {
  const fail = (): never => {
    throw new ExperimentRuntimeError(
      "evidence-snapshot-invalid",
      "Only a complete accepted investigation snapshot can be exported.",
    );
  };
  if (
    snapshot.experimentId !== "light-quanta-investigation" ||
    !snapshot.final ||
    !Number.isSafeInteger(snapshot.snapshotVersion) ||
    snapshot.snapshotVersion < 1 ||
    !snapshot.instanceId ||
    !snapshot.runId ||
    snapshot.outputs.length !== Object.keys(LIGHT_INVESTIGATION_OUTPUTS).length
  )
    return fail();
  const parameters = validateLightInvestigation(snapshot.parameters);
  const seen = new Set<string>();
  const results = snapshot.outputs.map((output) => {
    const result = decodeResult(output);
    const contract = LIGHT_INVESTIGATION_OUTPUTS[result.quantityId];
    if (
      !contract ||
      seen.has(result.quantityId) ||
      result.ownerId !== contract.ownerId ||
      result.unit !== contract.unit ||
      result.semanticKind !== contract.semanticKind ||
      !contract.statuses.includes(result.status) ||
      (result.status === "value" && typeof result.value !== "number")
    )
      return fail();
    seen.add(result.quantityId);
    return JSON.parse(encodeResult(result)) as unknown;
  });
  return {
    instanceId: snapshot.instanceId,
    runId: snapshot.runId,
    snapshotVersion: snapshot.snapshotVersion,
    parameters,
    results,
  };
}

export function exportLightInvestigationEvidence(
  baseline: AcceptedSnapshot,
  current: AcceptedSnapshot,
  sourceDigest: string,
): string {
  if (!DIGEST.test(sourceDigest))
    throw new ExperimentRuntimeError(
      "source-digest-invalid",
      "The exported calculation needs its source digest.",
    );
  if (baseline.instanceId !== current.instanceId)
    throw new ExperimentRuntimeError(
      "evidence-instance-mismatch",
      "Compare snapshots from the same investigation placement.",
    );
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      modelId: LIGHT_INVESTIGATION_MODEL,
      constantSetId: LIGHT_INVESTIGATION_CONSTANTS,
      sourceDigest,
      evidenceKind: "model-consequence",
      reviewStatus: "explanatory-preview",
      privateNotesIncluded: false,
      changedSettings: changedInvestigationInputs(baseline, current),
      baseline: evidenceSnapshot(baseline),
      current: evidenceSnapshot(current),
    },
    null,
    2,
  )}\n`;
}

/** Hand the already accepted energy to the specialist instrument, not a rounded preset.
 * An unavailable inference has no live handoff. Neither a prediction nor an interpretation is supplied. */
export function lightInvestigationCoefficientHref(snapshot: AcceptedSnapshot): string | null {
  const p = validateLightInvestigation(snapshot.parameters);
  const required = ["radiationEnergy", "radiationEntropy", "effectiveIndependentCount"];
  if (
    !required.every((id) =>
      snapshot.outputs.some(
        (r) => r.quantityId === id && r.status === "value" && typeof r.value === "number",
      ),
    )
  )
    return null;
  const energy = snapshot.outputs.find((r) => r.quantityId === "radiationEnergy");
  if (!energy || energy.status !== "value" || typeof energy.value !== "number") return null;
  return `/lab/lq-06/${encodeLq06Settings({
    ...LQ06_DEFAULTS,
    radiationEnergy: energy.value,
    frequency: p.frequency,
    volumeRatio: p.volumeRatio,
    temperature: p.referenceTemperature,
    gasParticles: p.pointCount,
    constantSetId: LIGHT_INVESTIGATION_CONSTANTS,
  })}`;
}
