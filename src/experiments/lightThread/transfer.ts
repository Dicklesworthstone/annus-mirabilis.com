/** Export the accepted cross-paper comparison, with its declared constants and source identity. */
import { getConstantSet } from "../../physics/reference/constants.ts";
import { validateLightThreadParameters } from "../../physics/reference/lightThread.ts";
import { ExperimentRuntimeError } from "../refusal.ts";
import { decodeResult, encodeResult } from "../results/codec.ts";
import type { AcceptedSnapshot } from "../store/instanceStore.ts";
import { LIGHT_THREAD_OUTPUTS } from "./session.ts";

/** No recalculation: a download describes the numbers the reader actually accepted. */
export function exportLightThreadEvidence(
  snapshot: AcceptedSnapshot,
  sourceDigest: string,
): string {
  const fail = (): never => {
    throw new ExperimentRuntimeError(
      "evidence-snapshot-invalid",
      "Only a complete accepted light-thread comparison can be exported.",
      "light-thread",
    );
  };
  if (!/^source:sha256:[a-f0-9]{64}$/.test(sourceDigest)) {
    throw new ExperimentRuntimeError(
      "source-digest-invalid",
      "The exported light-thread comparison needs its source digest.",
      "light-thread",
    );
  }
  const checked = validateLightThreadParameters(snapshot.parameters);
  if (
    checked.kind !== "accepted" ||
    snapshot.experimentId !== "light-thread" ||
    !snapshot.final ||
    !Number.isSafeInteger(snapshot.snapshotVersion) ||
    snapshot.snapshotVersion < 1 ||
    !snapshot.instanceId ||
    !snapshot.runId ||
    snapshot.outputs.length !== Object.keys(LIGHT_THREAD_OUTPUTS).length
  ) {
    return fail();
  }
  const seen = new Set<string>();
  const results = snapshot.outputs.map((output) => {
    const result = decodeResult(output);
    const contract = LIGHT_THREAD_OUTPUTS[result.quantityId];
    if (
      !contract ||
      seen.has(result.quantityId) ||
      result.ownerId !== contract.ownerId ||
      result.unit !== contract.unit ||
      result.semanticKind !== contract.semanticKind ||
      result.status !== "value" ||
      typeof result.value !== "number"
    ) {
      return fail();
    }
    seen.add(result.quantityId);
    return JSON.parse(encodeResult(result)) as unknown;
  });
  const set = getConstantSet(checked.parameters.constantSetId);
  const usedConstants = new Set(
    set.id === "modern-si-2019"
      ? ["planckConstant", "speedOfLight"]
      : ["molarGasConstant", "avogadroConstant", "wienConstantBeta", "speedOfLight"],
  );
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      modelId: "light-thread-v2",
      evidenceKind: "model-consequence",
      sourceDigest,
      constantSetId: set.id,
      constants: {
        kind: set.kind,
        era: set.era,
        provenance: set.provenance,
        precisionNote: set.precisionNote,
        entries: set.entries.filter((entry) => usedConstants.has(entry.quantityId)),
      },
      interpretation: {
        quantumEnergy:
          set.id === "modern-si-2019" ? "h nu" : "(R/N) beta_W nu, converted from erg to J",
        quantumClaim:
          "An energy ratio, not an independently measured integer photon count. The 1905 heuristic applies to dilute radiation in the Wien regime; no temperature or dilution is established for this stipulated pulse.",
        massEnergyClaim:
          "The balanced pair has total source energy 2E. The September argument does not require quanta; the displayed invariant mass is a later interpretation.",
        observation:
          "These are calculated consequences of an ideal pulse, not historical observations.",
      },
      accepted: {
        experimentId: snapshot.experimentId,
        instanceId: snapshot.instanceId,
        runId: snapshot.runId,
        parentRunId: snapshot.parentRunId,
        actionIndex: snapshot.actionIndex,
        snapshotVersion: snapshot.snapshotVersion,
        revisions: snapshot.revisions,
        parameters: checked.parameters,
        results,
      },
    },
    null,
    2,
  )}\n`;
}
