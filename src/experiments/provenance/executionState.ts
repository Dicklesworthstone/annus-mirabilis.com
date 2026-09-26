import { type ExperimentView, type OutputContract, ownerAdmitted } from "../store/instanceStore.ts";
export type ExecutionState = Readonly<{
  label: "static" | "host" | "unavailable";
  text: string;
  sourceDigest: string;
  owners: readonly string[];
}>;

// ---------------------------------------------------------------------------
// The fourth state: frankensim-accepted (am-inst-execution-labels-5ywv).
//
// No FrankenSim WASM artifact exists anywhere in this repository yet
// (src/experiments/owners.ts: "every binding below is reference-evaluator");
// the full engine-selection and reproducibility machinery this state
// ultimately belongs to (deriveExecutionState, comparison kinds, the parity
// ladder) is am-rt-determinism-fallbacks-8i4, still open. This slice adds
// only the derivation this bead was told is genuinely missing: a fourth
// state, earned per accepted snapshot from explicit per-output ownership
// facts, never from whether an artifact happens to be loaded.
// ---------------------------------------------------------------------------

export type ExecutionStateKind =
  | "frankensim-accepted"
  | "host-accepted"
  | "static-example"
  | "unavailable";

export type EngineKind = "frankensim" | "host-reference";

/**
 * What produced ONE primary output of THIS accepted snapshot. `acceptedThisSnapshot` is the
 * earned fact: it is true only when an accepted call to the registered owner produced this
 * snapshot's value for this output. A capability being registered, an artifact being loaded in
 * the browser, or a prior snapshot having been FrankenSim-accepted are all insufficient — none
 * of those are represented here at all, so none of them can leak into the derivation.
 */
export type PrimaryOutputOwnership = Readonly<{
  outputId: string;
  ownerKind: EngineKind;
  acceptedThisSnapshot: boolean;
}>;

export type ExecutionStateInput = Readonly<{
  isStatic: boolean;
  /** True when no admissible live state can be produced here (am-inst-execution-labels-5ywv:
   * no worker, no in-thread channel, the worker-restart bound exceeded, or the active mode
   * declares no live view this device can render). Never derived from a bare capability check. */
  isUnavailable: boolean;
  /** Every output the manifest marks `primary` for this snapshot's mode. Empty is treated as
   * "nothing to earn a live-engine label from" and falls through to host-accepted, never to
   * frankensim-accepted by default. */
  primaryOutputs: readonly PrimaryOutputOwnership[];
}>;

/**
 * Earns `frankensim-accepted` only when EVERY primary output's ownership fact says an accepted
 * FrankenSim call produced THIS snapshot's value. A mixed primary set (some frankensim, some
 * host) earns `host-accepted`, matching the composite rule: closed-form host physics beside a
 * FrankenSim positions output is not a deficiency to hide, it is `host-accepted` because the
 * primary set is mixed. This function's input type has no field for loader or artifact state,
 * so a loaded-but-not-accepted artifact cannot reach this derivation at all, let alone earn the
 * label: the negative this bead is required to plant.
 */
export function deriveExecutionStateKind(input: ExecutionStateInput): ExecutionStateKind {
  if (input.isUnavailable) return "unavailable";
  if (input.isStatic) return "static-example";
  const allFrankenSimAccepted =
    input.primaryOutputs.length > 0 &&
    input.primaryOutputs.every((o) => o.ownerKind === "frankensim" && o.acceptedThisSnapshot);
  return allFrankenSimAccepted ? "frankensim-accepted" : "host-accepted";
}
/** A label is earned by accepted owner contracts, never by worker/WASM loader state. */
export function deriveHostExecution(
  view: ExperimentView,
  contracts: Readonly<Record<string, OutputContract>>,
  sourceDigest: string,
  isStatic: boolean,
): ExecutionState {
  const outputs = view.accepted?.outputs;
  if (
    !outputs?.length ||
    !/^source:sha256:[a-f0-9]{64}$/.test(sourceDigest) ||
    outputs.some((o) => {
      const contract = contracts[o.quantityId];
      return (
        contract === undefined ||
        !ownerAdmitted(contract, o.ownerId) ||
        o.unit !== contract.unit ||
        o.semanticKind !== contract.semanticKind
      );
    })
  )
    return {
      label: "unavailable",
      text: "Calculation provenance is unavailable",
      sourceDigest: "",
      owners: [],
    };
  return {
    label: isStatic ? "static" : "host",
    text: isStatic ? "Static worked example" : "Ideal model, host calculation",
    sourceDigest,
    owners: [...new Set(outputs.map((o) => o.ownerId))],
  };
}
