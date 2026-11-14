import type { WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import { createBm01Session, type PreparedBm01Example } from "../bm01/session.ts";
import { createBm01TapeBinding } from "../bm01/tape.ts";
import { createBm06Session, type PreparedBm06Example } from "../bm06/session.ts";
import { createBm06TapeBinding } from "../bm06/tape.ts";
import { inheritSchedulingPause } from "../lifecycle/schedulingPause.ts";
import { validateTapeGroupV3 } from "../permalink/groupSchema.ts";
import { requirementsOf, settingsFromTape } from "../permalink/sessionTape.ts";
import type { TapeDocument, TapeGroupV3, TapeV2 } from "../permalink/types.ts";
import { prepareWorkerLink } from "../permalink/workerLink.ts";
import {
  restoreWorkerTape,
  type WorkerReplayOptions,
  type WorkerTapeBinding,
} from "../permalink/workerSessionTape.ts";
import type { Parameters as ExperimentParameters } from "../store/instanceStore.ts";
import {
  assertBrownianComparisonInputs,
  type BrownianRadiusView,
  createBrownianRadiusGroup,
} from "./brownianRadius.ts";
import { type ExperimentGroupDefinition, insideGroupDomain } from "./schema.ts";
import type { BrownianRadiusSession } from "./brownianRadiusTape.ts";

export type BrownianGroupInputs = Readonly<{
  definition: ExperimentGroupDefinition;
  tracerExample: PreparedBm01Example;
  densityExample: PreparedBm06Example;
  workerFactories: readonly [() => WorkerChannel, () => WorkerChannel];
  resources?: Parameters<typeof createBm01Session>[3];
}>;

export function createBrownianGroupBundle(instanceId: string, inputs: BrownianGroupInputs) {
  const sessions = [
    createBm01Session(
      `${instanceId}-tracers`, inputs.tracerExample, inputs.workerFactories[0], inputs.resources,
    ),
    createBm06Session(
      `${instanceId}-density`, inputs.densityExample, inputs.workerFactories[1], inputs.resources,
    ),
  ] as const;
  return Object.freeze({
    definition: inputs.definition,
    examples: { tracer: inputs.tracerExample, density: inputs.densityExample },
    sessions,
    group: createBrownianRadiusGroup(inputs.definition, sessions),
  });
}

export type BrownianGroupBundle = BrownianRadiusSession;

function bindingsFor(inputs: BrownianGroupInputs): readonly [WorkerTapeBinding, WorkerTapeBinding] {
  return [
    createBm01TapeBinding(inputs.tracerExample, inputs.workerFactories[0], inputs.resources),
    createBm06TapeBinding(inputs.densityExample, inputs.workerFactories[1], inputs.resources),
  ];
}

export type BrownianGroupCapture =
  | Readonly<{ kind: "captured"; tape: TapeGroupV3 }>
  | Readonly<{ kind: "unavailable"; notice: string }>;

export type PreparedBrownianGroup = Readonly<{
  kind: "prepared";
  tape: TapeGroupV3;
  replays: readonly [TapeV2, TapeV2];
}>;

type Unavailable = Readonly<{ kind: "not-restored"; notice: string }>;
const refused = (notice: string): Unavailable => ({ kind: "not-restored", notice });

/** Immutable accepted identities, including whether the displayed pair is explicitly linked. */
export function brownianGroupStateKey(view: BrownianRadiusView): string | null {
  if (view.displayed.length !== 2 || view.displayed.some((snapshot) => !snapshot.final))
    return null;
  if (view.enabled && !view.coherent) return null;
  return JSON.stringify([
    view.enabled,
    view.enabled ? view.coherent?.value : null,
    ...view.displayed.map((snapshot) => [snapshot.instanceId, snapshot.runId, snapshot.snapshotVersion]),
  ]);
}

/** Capture each complete owner receipt before packaging the one displayed comparison. */
export async function captureBrownianGroup(
  inputs: BrownianGroupInputs,
  bundle: BrownianGroupBundle,
  displayed: BrownianRadiusView = bundle.group.getSnapshot(),
): Promise<BrownianGroupCapture> {
  const key = brownianGroupStateKey(displayed);
  if (!key)
    return { kind: "unavailable", notice: "Finish both calculations before sharing this comparison." };
  const members: TapeGroupV3["members"][number][] = [];
  for (const [index, binding] of bindingsFor(inputs).entries()) {
    const snapshot = displayed.displayed[index];
    const session = bundle.sessions[index];
    const declared = inputs.definition.members.find(
      (member) => member.instrumentId === binding.environment.experimentId,
    );
    if (!snapshot || !session || !declared || !binding.capture)
      return { kind: "unavailable", notice: "A complete scientific checkpoint is not available for both instruments." };
    const result = await binding.capture(session, snapshot);
    if (result.kind !== "captured") return result;
    members.push({
      memberId: binding.environment.experimentId,
      parameterId: declared.parameterId,
      displayUnit: declared.displayUnit,
      tape: result.tape,
    });
  }
  if (brownianGroupStateKey(bundle.group.getSnapshot()) !== key)
    return { kind: "unavailable", notice: "The displayed comparison changed while saving. Save the new accepted pair." };
  const definition = inputs.definition;
  return {
    kind: "captured",
    tape: validateTapeGroupV3({
      tapeVersion: 3,
      group: {
        definitionVersion: definition.schemaVersion,
        groupId: definition.groupId,
        quantityId: definition.quantityId,
        canonicalUnit: definition.canonicalUnit,
        commandClass: definition.commandClass,
        direction: definition.direction,
        conversion: definition.conversion,
        commitPolicy: definition.commitPolicy,
        enabled: displayed.enabled,
        valueSI: displayed.enabled ? displayed.coherent?.value : null,
      },
      members,
    }),
  };
}

function matchesDefinition(tape: TapeGroupV3, definition: ExperimentGroupDefinition): boolean {
  const relation = tape.group;
  return (
    relation.definitionVersion === definition.schemaVersion &&
    relation.groupId === definition.groupId &&
    relation.quantityId === definition.quantityId &&
    relation.canonicalUnit === definition.canonicalUnit &&
    relation.commandClass === definition.commandClass &&
    relation.direction === definition.direction &&
    relation.conversion === definition.conversion &&
    relation.commitPolicy === definition.commitPolicy &&
    tape.members.length === 2 &&
    tape.members.every((member) => {
      const declared = definition.members.find((entry) => entry.instrumentId === member.memberId);
      return (
        (member.memberId === "bm-01" || member.memberId === "bm-06") &&
        declared !== undefined &&
        declared.instrumentId === member.tape.experimentId &&
        declared.parameterId === member.parameterId &&
        declared.displayUnit === member.displayUnit
      );
    })
  );
}

function recordedStates(binding: WorkerTapeBinding, tape: TapeV2) {
  const states: Readonly<Record<string, unknown>>[] = [];
  let settings: Readonly<Record<string, unknown>> = binding.defaults;
  const patches = [tape.initialConditions, ...tape.events.map((event) => ({ [event.paramId]: event.value }))];
  for (const patch of patches) {
    const checked = binding.validate({ ...settings, ...settingsFromTape(patch, binding.defaults) });
    if (checked.kind !== "accepted" || !checked.data || typeof checked.data !== "object")
      return refused(requirementsOf(checked) || "One recorded intermediate setting is not admitted.");
    settings = { ...checked.data };
    states.push(settings);
  }
  return { kind: "states" as const, states, settings };
}

/** Reading a URL performs only bounded validation; the reader explicitly starts worker replay. */
export async function prepareBrownianGroup(
  inputs: BrownianGroupInputs,
  document: TapeDocument,
): Promise<PreparedBrownianGroup | Unavailable> {
  if (document.tapeVersion !== 3)
    return refused("This page needs a linked comparison containing both scientific checkpoints.");
  try {
    const tape = validateTapeGroupV3(document);
    const definition = inputs.definition;
    if (!matchesDefinition(tape, definition))
      return refused("The recorded membership or shared quantity differs from this Brownian comparison.");
    if (tape.group.enabled && !insideGroupDomain(definition.domain, tape.group.valueSI as number))
      return refused("The shared radius is outside the range admitted by both instruments.");
    const bindings = bindingsFor(inputs);
    const replays: TapeV2[] = [];
    const settings: Readonly<Record<string, unknown>>[] = [];
    for (const binding of bindings) {
      const member = tape.members.find((entry) => entry.memberId === binding.environment.experimentId);
      if (!member) return refused("The comparison is missing one of its instrument owners.");
      const prepared = await prepareWorkerLink(binding, member.tape);
      if (prepared.kind !== "checkpoint")
        return refused(prepared.kind === "not-restored"
          ? prepared.notice
          : "Both members must contain complete scientific checkpoints, not settings alone.");
      if (prepared.compatibilityNotice) return refused(prepared.compatibilityNotice);
      const states = recordedStates(binding, prepared.replay);
      if (states.kind !== "states") return states;
      const invalid = binding.scientificReplay?.validate(prepared.replay, states.states);
      if (invalid) return refused(invalid);
      const radius = states.settings.a;
      const declared = definition.members.find((entry) => entry.instrumentId === member.memberId);
      if (typeof radius !== "number" || !declared || !insideGroupDomain(declared.domain, radius))
        return refused("One recorded radius lies outside its owner's admitted range.");
      if (tape.group.enabled && radius !== tape.group.valueSI)
        return refused("The member checkpoints do not describe the recorded shared radius.");
      replays.push(prepared.replay);
      settings.push(states.settings);
    }
    const tracer = settings[0];
    const density = settings[1];
    const tracerTape = replays[0];
    const densityTape = replays[1];
    if (!tracer || !density || !tracerTape || !densityTape)
      return refused("Both independent owner checkpoints are required.");
    assertBrownianComparisonInputs(tracer as ExperimentParameters, density as ExperimentParameters);
    return {
      kind: "prepared",
      tape,
      replays: Object.freeze([tracerTape, densityTape]) as readonly [TapeV2, TapeV2],
    };
  } catch (error) {
    return refused(`The comparison could not be checked: ${String(error)}`);
  }
}

export type BrownianGroupRestore =
  | Readonly<{ kind: "restored"; bundle: BrownianGroupBundle; tape: TapeGroupV3 }>
  | Unavailable;

/**
 * Keep the displayed owners intact while private owners replay both scientific checkpoints.
 * Only an entirely accepted pair is adopted. Failed/canceled candidates are disposed together.
 */
export async function restoreBrownianGroup(
  instanceId: string,
  inputs: BrownianGroupInputs,
  current: BrownianGroupBundle,
  document: TapeGroupV3,
  options: WorkerReplayOptions = {},
): Promise<BrownianGroupRestore> {
  const previousRequests = current.sessions.map((session) => session.getSnapshot().requested);
  const previousGroup = current.group.getSnapshot();
  const stillCurrent = () =>
    current.sessions.every((session, index) => session.getSnapshot().requested === previousRequests[index]) &&
    current.group.getSnapshot().enabled === previousGroup.enabled &&
    current.group.getSnapshot().generationId === previousGroup.generationId;
  const superseded = () =>
    refused("A newer change replaced this restore. Your newer comparison has been kept.");
  const prepared = await prepareBrownianGroup(inputs, document);
  if (prepared.kind !== "prepared") return prepared;
  if (options.signal?.aborted) return refused("Comparison restoration was canceled.");
  if (!stillCurrent()) return superseded();
  // Only retire requests owned by the original restore intent. Stop listeners may issue a newer
  // change synchronously; never cancel that newer request or silently adopt it as our baseline.
  for (const session of current.sessions) {
    if (!stillCurrent()) return superseded();
    if (session.getSnapshot().pending) session.stop();
  }
  if (!stillCurrent()) return superseded();
  let privateBundle: BrownianGroupBundle | undefined;
  const detachPause: (() => void)[] = [];
  let handedOff = false;
  try {
    privateBundle = createBrownianGroupBundle(instanceId, inputs);
    for (const [index, session] of privateBundle.sessions.entries())
      detachPause.push(inheritSchedulingPause(current.sessions[index] ?? current.sessions[0], session));
    const bindings = bindingsFor(inputs);
    for (let index = 0; index < privateBundle.sessions.length; index++) {
      const session = privateBundle.sessions[index];
      const binding = bindings[index];
      const tape = prepared.replays[index];
      if (!session || !binding || !tape) return refused("The private comparison is incomplete.");
      const replayed = await restoreWorkerTape(binding, session, tape, options);
      if (replayed.kind !== "restored") return replayed;
    }
    if (options.signal?.aborted) return refused("Comparison restoration was canceled.");
    if (!stillCurrent()) return superseded();
    assertBrownianComparisonInputs(
      privateBundle.sessions[0].acceptedParameters(),
      privateBundle.sessions[1].acceptedParameters(),
    );
    privateBundle.group.connect();
    if (prepared.tape.group.enabled) {
      const adopted = privateBundle.group.adoptAccepted(prepared.tape.group.valueSI as number);
      if (adopted?.kind !== "accepted" || privateBundle.group.getSnapshot().status !== "accepted")
        return refused("The two verified owners could not form a complete shared comparison.");
    }
    if (options.signal?.aborted) return refused("Comparison restoration was canceled.");
    handedOff = true;
    return { kind: "restored", bundle: privateBundle, tape: prepared.tape };
  } catch (error) {
    return refused(`The recorded comparison could not be restored: ${String(error)}`);
  } finally {
    for (const detach of detachPause) detach();
    if (!handedOff) privateBundle?.group.disconnect();
  }
}

/** Settings links keep their existing recalculation path; scientific records require consent. */
export async function incomingBrownianRecording(
  inputs: BrownianGroupInputs,
  href: string,
  signal?: AbortSignal,
): Promise<PreparedBrownianGroup | Unavailable | null> {
  if (signal?.aborted) return refused("Comparison restoration was canceled.");
  try {
    const address = new URL(href);
    if (!address.searchParams.has("tape")) return null;
    const { decodeTapeDocumentInBrowser } = await import("../permalink/browserCodec.ts");
    if (signal?.aborted) return refused("Comparison restoration was canceled.");
    const decoded = await decodeTapeDocumentInBrowser(address);
    if (signal?.aborted) return refused("Comparison restoration was canceled.");
    if (decoded.kind !== "success" || decoded.tape.tapeVersion !== 3) return null;
    const hasScientificCheckpoint = decoded.tape.members.some(
      (member) => member.tape.acceptedCheckpoint.scientificState !== undefined ||
        member.tape.acceptedCheckpoint.digest.startsWith("host:sha256:"),
    );
    if (!hasScientificCheckpoint) return null;
    const prepared = await prepareBrownianGroup(inputs, decoded.tape);
    return signal?.aborted ? refused("Comparison restoration was canceled.") : prepared;
  } catch {
    // The existing settings reader owns malformed transport notices.
    return null;
  }
}
