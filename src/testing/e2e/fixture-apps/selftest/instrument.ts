/**
 * The pure state machine behind the `harness-selftest` fixture instrument
 * (am-test-e2e-harness-bqmh requirement 9). This is the harness proving its
 * own instrument checks (requirement 5) against a scripted stand-in, never
 * a runtime claim: `am-rt-browser-conformance-09i5` proves the real store,
 * worker, and pinned WASM artifact.
 *
 * Every transition here is a pure function from one state to the next, so
 * the DOM-binding shim (a separate, small module compiled to a string and
 * mounted in the fixture page, following the pattern
 * `src/reader/detail/prepaint.ts` already established in this repository)
 * has no state logic of its own to get wrong.
 */

export const SELFTEST_DOMAIN = { min: 0, max: 100 } as const;

export type SelftestExecutionLabel = "static" | "host" | "unavailable";

export interface SelftestParams {
  readonly value: number;
}

export interface SelftestState {
  readonly instanceId: string;
  readonly runId: string;
  readonly snapshotVersion: number;
  readonly inputRevision: number;
  readonly acceptedInputRevision: number;
  readonly pending: boolean;
  readonly executionLabel: SelftestExecutionLabel;
  readonly acceptedParams: SelftestParams;
  readonly requestedParams: SelftestParams;
  readonly resultStatus: "value" | undefined;
  readonly refusalCode: string | undefined;
  readonly wasmBlocked: boolean;
  readonly contextLost: boolean;
}

export function initialSelftestState(instanceId: string, runId: string): SelftestState {
  const params: SelftestParams = { value: 1 };
  return {
    instanceId,
    runId,
    snapshotVersion: 1,
    inputRevision: 0,
    acceptedInputRevision: 0,
    pending: false,
    executionLabel: "static",
    acceptedParams: params,
    requestedParams: params,
    resultStatus: "value",
    refusalCode: undefined,
    wasmBlocked: false,
    contextLost: false,
  };
}

function isInDomain(value: number): boolean {
  return Number.isFinite(value) && value >= SELFTEST_DOMAIN.min && value <= SELFTEST_DOMAIN.max;
}

/** Typed entry: advances `inputRevision` and marks the instance pending until `applyInput` runs. */
export function requestInput(state: SelftestState, value: number): SelftestState {
  return {
    ...state,
    requestedParams: { value },
    inputRevision: state.inputRevision + 1,
    pending: true,
  };
}

/**
 * Applies the most recently requested input. `respondingToRevision` names
 * which `requestInput` call this response answers: a response answering an
 * older revision than the one already accepted is a stale, delayed
 * response and is dropped entirely, so a delayed older response can never
 * overwrite a newer `acceptedInputRevision`.
 */
export function applyInput(state: SelftestState, respondingToRevision: number): SelftestState {
  if (respondingToRevision < state.acceptedInputRevision) {
    return state;
  }
  if (state.contextLost) {
    return { ...state, pending: false, executionLabel: "unavailable" };
  }

  const executionLabel: SelftestExecutionLabel = state.wasmBlocked ? "host" : state.executionLabel;

  if (!isInDomain(state.requestedParams.value)) {
    return {
      ...state,
      pending: false,
      executionLabel,
      refusalCode: "selftest-out-of-domain",
      // The last accepted snapshot stays visibly distinct from the
      // (rejected) requested settings: acceptedParams and
      // acceptedInputRevision are deliberately left untouched.
    };
  }

  return {
    ...state,
    pending: false,
    executionLabel,
    acceptedParams: state.requestedParams,
    acceptedInputRevision: respondingToRevision,
    snapshotVersion: state.snapshotVersion + 1,
    resultStatus: "value",
    refusalCode: undefined,
  };
}

/** Blocking the WASM artifact yields `host` (never `frankensim`, which this fixture never claims). */
export function blockWasm(state: SelftestState): SelftestState {
  return {
    ...state,
    wasmBlocked: true,
    executionLabel: state.executionLabel === "static" ? "host" : state.executionLabel,
  };
}

/** `WEBGL_lose_context`: pauses the instrument while its last accepted text stays readable. */
export function loseContext(state: SelftestState): SelftestState {
  return { ...state, contextLost: true, executionLabel: "unavailable" };
}

export function restoreContext(state: SelftestState): SelftestState {
  return { ...state, contextLost: false, executionLabel: state.wasmBlocked ? "host" : "static" };
}

/** Restart: a visibly new `runId`, snapshot history reset, parameters preserved. */
export function restart(state: SelftestState, newRunId: string): SelftestState {
  return {
    ...state,
    runId: newRunId,
    snapshotVersion: 1,
    inputRevision: 0,
    acceptedInputRevision: 0,
    pending: false,
    resultStatus: "value",
    refusalCode: undefined,
    contextLost: false,
  };
}

export interface SelftestViewIdentity {
  readonly instanceId: string;
  readonly runId: string;
  readonly snapshotVersion: string;
}

/** The identity subset every view of one instance publishes (`domContract.ts`'s `parseInstrumentView` shape). */
export function selftestViewIdentity(state: SelftestState): SelftestViewIdentity {
  return {
    instanceId: state.instanceId,
    runId: state.runId,
    snapshotVersion: String(state.snapshotVersion),
  };
}

const TAPE_PREFIX = "selftest-v1";

/** `?tape=` serializes the accepted identities so restoring it reproduces the same accepted state. */
export function serializeTape(state: SelftestState): string {
  return [
    TAPE_PREFIX,
    state.instanceId,
    state.runId,
    String(state.acceptedInputRevision),
    String(state.acceptedParams.value),
  ].join(":");
}

export function restoreFromTape(tape: string): SelftestState {
  const parts = tape.split(":");
  const [prefix, instanceId, runId, acceptedInputRevisionRaw, valueRaw] = parts;
  if (
    prefix !== TAPE_PREFIX ||
    !instanceId ||
    !runId ||
    acceptedInputRevisionRaw === undefined ||
    valueRaw === undefined
  ) {
    throw new Error(`malformed selftest tape: ${JSON.stringify(tape)}`);
  }
  const acceptedInputRevision = Number(acceptedInputRevisionRaw);
  const value = Number(valueRaw);
  if (!Number.isFinite(acceptedInputRevision) || !Number.isFinite(value)) {
    throw new Error(`malformed selftest tape: ${JSON.stringify(tape)}`);
  }
  const params: SelftestParams = { value };
  return {
    instanceId,
    runId,
    snapshotVersion: 1,
    inputRevision: acceptedInputRevision,
    acceptedInputRevision,
    pending: false,
    executionLabel: "static",
    acceptedParams: params,
    requestedParams: params,
    resultStatus: "value",
    refusalCode: undefined,
    wasmBlocked: false,
    contextLost: false,
  };
}
