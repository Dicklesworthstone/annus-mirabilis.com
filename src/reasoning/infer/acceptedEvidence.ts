import { BM07_OUTPUTS } from "../../experiments/bm07/definition.ts";
import { observationDigest } from "../../experiments/bm07/digest.ts";
import { BM08_OUTPUTS } from "../../experiments/bm08/definition.ts";
import { throwApplyFailure } from "../../experiments/results/applyFailure.ts";
import { makeRefusal } from "../../experiments/results/refusals.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { INFERENCE_CONSTANTS } from "../../physics/reference/inference/synthetic.ts";
import { type InferenceEvidence, parseInferenceEvidence } from "./evidence.ts";
import {
  CAMERA_DEFAULTS,
  evaluateCamera,
  evaluateRadius,
  RADIUS_DEFAULTS,
  RADIUS_EXAMPLE,
} from "./model.ts";

export type PinnedInferenceEvidence = Readonly<{
  provenance: "synthetic-laboratory";
  evidence: InferenceEvidence;
  source: Readonly<
    Pick<
      AcceptedSnapshot,
      "experimentId" | "instanceId" | "runId" | "snapshotVersion" | "actionIndex" | "revisions"
    >
  >;
}>;

function refuse(requirements: string): never {
  throwApplyFailure({
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { capabilityId: "diffusion.inference" },
      { details: { requirements } },
    ),
  });
}

/** Copy one complete accepted record, never requested parameters, latent paths or generator truth.
 * This boundary admits the two synthetic owners only. Imported observations require their own
 * provenance, calibration and model admission; a file cannot become synthetic evidence here.
 */
export function evidenceFromAccepted(
  snapshot: AcceptedSnapshot,
  sourceDigest: string,
): PinnedInferenceEvidence {
  if (!snapshot.final || !["bm-07", "bm-08"].includes(snapshot.experimentId))
    refuse("Choose a complete accepted BM-07 or BM-08 synthetic observation record.");
  const ideal = snapshot.experimentId === "bm-07";
  const p = snapshot.parameters;
  if (ideal && (p.observationSet !== "synthetic" || p.constantSetId !== INFERENCE_CONSTANTS.id))
    refuse(
      "Imported and historical observations keep their own inference workflow and constant provenance.",
    );
  const quantityId = ideal ? "observationIncrements" : "increments";
  const contract = (ideal ? BM07_OUTPUTS : BM08_OUTPUTS)[quantityId];
  const matches = snapshot.outputs.filter((output) => output.quantityId === quantityId);
  const observed = matches[0];
  if (
    !contract ||
    matches.length !== 1 ||
    !observed ||
    observed.status !== "value" ||
    typeof observed.value === "number" ||
    observed.unit !== contract.unit ||
    observed.semanticKind !== contract.semanticKind ||
    observed.ownerId !== contract.ownerId
  )
    refuse(
      "The accepted snapshot must contain one synthetic displacement series in metres from its registered owner.",
    );
  if (
    typeof p.M !== "number" ||
    !Number.isSafeInteger(p.M) ||
    p.M < 1 ||
    p.M > 1000 ||
    typeof p.d !== "number" ||
    ![1, 2].includes(p.d) ||
    observed.value.length !== p.M * p.d
  )
    refuse(
      "The complete accepted displacement array must match its declared frame and coordinate counts.",
    );
  const increments = observed.value.copy();
  const provisional = parseInferenceEvidence({
    schemaVersion: 1,
    kind: ideal ? "ideal" : "camera",
    sourceDigest,
    observationDigest: "0".repeat(64),
    seed: p.seed,
    dt: p.dt,
    d: p.d,
    T: ideal ? p.T : 1,
    eta: ideal ? p.eta : 1,
    exposure: ideal ? 0 : p.exposure,
    knownDrift: ideal ? 0 : Number(p.flowDrift) + Number(p.stageDrift),
    increments: Array.from(increments),
  });
  // Exactly the same projection as generate-inference-workbench.mjs: the observation identity
  // changes with timing, exposure or known drift, but not with an added radius assumption.
  const digest = observationDigest(
    new Float64Array(),
    JSON.stringify({
      kind: provisional.kind,
      dt: provisional.dt,
      d: provisional.d,
      exposure: provisional.exposure,
      knownDrift: provisional.knownDrift,
      increments: provisional.increments,
    }),
  ).slice("sha256:".length);
  const evidence = parseInferenceEvidence({ ...provisional, observationDigest: digest });
  // Admit every result the initial case will render before replacing a healthy pinned view.
  // A complete finite record can still be outside the inverse model's numerical domain.
  const evaluations = ideal
    ? [evaluateRadius(evidence, RADIUS_DEFAULTS), evaluateRadius(evidence, RADIUS_EXAMPLE)]
    : [
        evaluateCamera(evidence, CAMERA_DEFAULTS),
        evaluateCamera(evidence, { information: "covariance" }),
      ];
  for (const evaluation of evaluations) {
    if (evaluation.kind === "refused" || evaluation.kind === "outcome")
      throwApplyFailure(evaluation);
    if (evaluation.kind === "no-value") refuse(evaluation.reason);
  }
  return Object.freeze({
    provenance: "synthetic-laboratory",
    evidence,
    source: Object.freeze({
      experimentId: snapshot.experimentId,
      instanceId: snapshot.instanceId,
      runId: snapshot.runId,
      snapshotVersion: snapshot.snapshotVersion,
      actionIndex: snapshot.actionIndex,
      revisions: Object.freeze({ ...snapshot.revisions }),
    }),
  });
}
