/**
 * Share the displayed comparison's complete settings through the existing bounded V3 envelope.
 * Restoring calculates a new pair with the ordinary owners; it does not claim to restore a saved
 * stochastic trajectory. Both members are checked before any worker starts, and a candidate is
 * handed to the view only after both calculations have accepted their exact recorded settings.
 */

import type { WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import { BM01_DRAFT_TAPE } from "../bm01/draftTape.ts";
import { createBm01Session, type PreparedBm01Example } from "../bm01/session.ts";
import { BM06_DRAFT_TAPE } from "../bm06/draftTape.ts";
import { createBm06Session, type PreparedBm06Example } from "../bm06/session.ts";
import {
  type DraftTapeBinding,
  draftTapeForSettings,
  loadDraftTape,
} from "../permalink/draftTape.ts";
import { validateTapeGroupV3 } from "../permalink/groupSchema.ts";
import { tapeStateDigestV2 } from "../permalink/sessionTape.ts";
import type { TapeDocument, TapeGroupV3 } from "../permalink/types.ts";
import { applyWorkerSettings, type WorkerReplayOptions } from "../permalink/workerSessionTape.ts";
import { type BrownianRadiusView, createBrownianRadiusGroup } from "./brownianRadius.ts";
import { type ExperimentGroupDefinition, insideGroupDomain } from "./schema.ts";

export type BrownianRadiusExamples = Readonly<{
  tracer: PreparedBm01Example;
  density: PreparedBm06Example;
}>;
export type BrownianRadiusWorkers = readonly [() => WorkerChannel, () => WorkerChannel];

/** Construction stays pure: a normal visit keeps both worked examples and starts no worker. */
export function createBrownianRadiusSession(
  instanceId: string,
  definition: ExperimentGroupDefinition,
  examples: BrownianRadiusExamples,
  workerFactories: BrownianRadiusWorkers,
) {
  const sessions = [
    createBm01Session(`${instanceId}-linked-tracers`, examples.tracer, workerFactories[0]),
    createBm06Session(`${instanceId}-linked-density`, examples.density, workerFactories[1]),
  ] as const;
  return Object.freeze({
    definition,
    examples,
    sessions,
    group: createBrownianRadiusGroup(definition, sessions),
  });
}

export type BrownianRadiusSession = ReturnType<typeof createBrownianRadiusSession>;
export type BrownianRadiusTapeRestore =
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "restored"; session: BrownianRadiusSession; notice: string }>
  | Readonly<{ kind: "not-restored"; notice: string }>;

const MEMBER_IDS = ["bm-01", "bm-06"] as const;

function bindings(examples: BrownianRadiusExamples): readonly [DraftTapeBinding, DraftTapeBinding] {
  return [
    {
      ...BM01_DRAFT_TAPE,
      environment: {
        ...BM01_DRAFT_TAPE.environment,
        artifactDigest: examples.tracer.sourceDigest.replace(/^source:/, "host:"),
      },
    },
    {
      ...BM06_DRAFT_TAPE,
      environment: {
        ...BM06_DRAFT_TAPE.environment,
        artifactDigest: examples.density.sourceDigest.replace(/^source:/, "host:"),
      },
    },
  ];
}

function failure(notice: string): BrownianRadiusTapeRestore {
  return {
    kind: "not-restored",
    notice: `The shared Brownian comparison could not be restored. ${notice} Your comparison is unchanged.`,
  };
}

function sameSettings(left: object, right: object, exceptRadius = false): boolean {
  const expected = right as Record<string, unknown>;
  return (
    Object.keys(left).length === Object.keys(right).length &&
    Object.entries(left).every(
      ([key, value]) =>
        Object.hasOwn(expected, key) &&
        ((exceptRadius && key === "a") || Object.is(value, expected[key])),
    )
  );
}

/** Capture old coherent results during a pending/refused update, never the live half-settled pair. */
export function tapeForBrownianRadius(
  session: BrownianRadiusSession,
  view: BrownianRadiusView = session.group.getSnapshot(),
): TapeGroupV3 | null {
  if (view.enabled && !view.coherent) return null;
  const displayed = view.displayed;
  if (displayed.length !== 2 || displayed.some((snapshot) => !snapshot.final)) return null;
  const { definition, examples } = session;
  const fixed = [examples.tracer.parameters, examples.density.parameters];
  const members: TapeGroupV3["members"][number][] = [];
  for (const [index, binding] of bindings(examples).entries()) {
    const instrumentId = binding.environment.experimentId;
    const snapshot = displayed.find((entry) => entry.experimentId === instrumentId);
    const declared = definition.members.find((entry) => entry.instrumentId === instrumentId);
    if (
      !snapshot ||
      !declared ||
      !fixed[index] ||
      !sameSettings(snapshot.parameters, fixed[index], true) ||
      (view.enabled && snapshot.parameters.a !== view.coherent?.value)
    )
      return null;
    const tape = draftTapeForSettings(binding, snapshot.parameters);
    if (!tape) return null;
    members.push({
      memberId: instrumentId,
      parameterId: declared.parameterId,
      displayUnit: declared.displayUnit,
      tape,
    });
  }
  return validateTapeGroupV3({
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
      enabled: view.enabled,
      valueSI: view.enabled ? view.coherent?.value : null,
    },
    members,
  });
}

function matchingDeclaration(tape: TapeGroupV3, definition: ExperimentGroupDefinition): boolean {
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
        MEMBER_IDS.some((id) => id === member.memberId) &&
        declared !== undefined &&
        member.tape.experimentId === declared.instrumentId &&
        member.parameterId === declared.parameterId &&
        member.displayUnit === declared.displayUnit
      );
    })
  );
}

/** The candidate is private and unpaused; its whole pending generation has one bounded lifetime. */
function calculateLinked(
  session: BrownianRadiusSession,
  value: number,
  options: WorkerReplayOptions,
): Promise<string | null> {
  if (options.signal?.aborted) return Promise.resolve("The restore was canceled.");
  return new Promise((resolve) => {
    let settled = false;
    let issued = false;
    let unsubscribe = () => {};
    let timer: ReturnType<typeof setTimeout> | undefined;
    const generation = session.group.getSnapshot().generationId + 1;
    const finish = (notice: string | null) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      if (timer !== undefined) clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      resolve(notice);
    };
    const abort = () => finish("The restore was canceled.");
    const inspect = () => {
      if (!issued || settled) return;
      const state = session.group.getSnapshot();
      if (!state.enabled || state.generationId !== generation) {
        finish("Another change replaced the shared calculation.");
        return;
      }
      const failed = state.members.find((member) => member.failure);
      if (failed?.failure) {
        finish(`${failed.instrumentId.toUpperCase()}: ${failed.failure.text}`);
        return;
      }
      if (
        state.status === "accepted" &&
        state.coherent?.generationId === generation &&
        state.coherent.value === value &&
        state.coherent.snapshots.length === 2
      )
        finish(null);
    };
    unsubscribe = session.group.subscribe(inspect);
    options.signal?.addEventListener("abort", abort, { once: true });
    timer = setTimeout(
      () => finish("Both calculations did not finish in time. Try restoring the comparison again."),
      options.timeoutMs ?? 15_000,
    );
    try {
      session.group.link(value);
      issued = true;
      if (options.signal?.aborted) abort();
      else inspect();
    } catch (error) {
      finish(String(error));
    }
  });
}

/**
 * Both settings checkpoints are validated before creating either worker. This page's fixed
 * temperature, viscosity, finite observation interval, seed, recording grid and density mode
 * must still describe the comparison in its captions. Only the particle radii may differ.
 */
export async function restoreBrownianRadiusTape(
  instanceId: string,
  definition: ExperimentGroupDefinition,
  examples: BrownianRadiusExamples,
  workerFactories: BrownianRadiusWorkers,
  document: TapeDocument,
  options: WorkerReplayOptions = {},
): Promise<BrownianRadiusTapeRestore> {
  if (options.signal?.aborted) return failure("The restore was canceled.");
  if (document.tapeVersion !== 3)
    return failure("This link describes one instrument; this page needs BM-01 and BM-06.");
  if (Array.isArray(document.members)) {
    const missing = MEMBER_IDS.filter(
      (id) => !document.members.some((member) => member && member.memberId === id),
    );
    if (missing.length)
      return failure(
        `The link is missing ${missing.map((id) => id.toUpperCase()).join(" and ")}. This page needs both members; no missing instrument has been created.`,
      );
  }
  let tape: TapeGroupV3;
  try {
    tape = validateTapeGroupV3(document);
  } catch (error) {
    return failure(String(error));
  }
  if (!matchingDeclaration(tape, definition))
    return failure("Its members or declared shared particle radius differ from this comparison.");
  if (tape.group.enabled && !insideGroupDomain(definition.domain, tape.group.valueSI as number))
    return failure("The shared radius lies outside the range admitted by both instruments.");
  const fixed = [examples.tracer.parameters, examples.density.parameters];
  const settings: Record<string, Readonly<Record<string, unknown>>> = {};
  for (const [index, binding] of bindings(examples).entries()) {
    const member = tape.members.find(
      (entry) => entry.memberId === binding.environment.experimentId,
    );
    if (!member) return failure("The comparison is missing one of its declared instruments.");
    const checkpoint = member.tape.acceptedCheckpoint;
    if (
      member.tape.mode !== binding.environment.mode ||
      member.tape.events.length > 0 ||
      member.tape.teachingTapeRef ||
      (member.tape.predictions?.length ?? 0) > 0 ||
      checkpoint.acceptedActionIndex !== 0 ||
      checkpoint.acceptedInputRevision !== 0 ||
      checkpoint.scientificState
    )
      return failure(
        "This page recalculates complete shared settings; it does not replay event histories, predictions, teaching sequences or saved scientific trajectories.",
      );
    if (
      Object.keys(member.tape.initialConditions).length !== Object.keys(binding.defaults).length ||
      Object.keys(binding.defaults).some(
        (key) => !Object.hasOwn(member.tape.initialConditions, key),
      )
    )
      return failure(
        "Each instrument needs its complete original settings; missing values are not filled from defaults.",
      );
    if (checkpoint.digest !== tapeStateDigestV2(member.tape.initialConditions, 0))
      return failure("One instrument's recorded settings do not match their checkpoint.");
    const loaded = loadDraftTape(binding, member.tape);
    if (loaded.kind !== "loaded")
      return failure(
        loaded.kind === "not-restored" ? loaded.notice : "One settings record is absent.",
      );
    if (!fixed[index] || !sameSettings(loaded.settings, fixed[index], true))
      return failure(
        "The recorded settings change this lesson's fixed inputs, including its seed, recording grid or observation interval.",
      );
    const radius = loaded.settings.a;
    const declared = definition.members.find((entry) => entry.instrumentId === member.memberId);
    if (typeof radius !== "number" || !declared || !insideGroupDomain(declared.domain, radius))
      return failure("One recorded radius is outside its instrument's admitted range.");
    if (tape.group.enabled && radius !== tape.group.valueSI)
      return failure("The instruments do not have the recorded shared radius in canonical metres.");
    settings[member.memberId] = loaded.settings;
  }
  if (options.signal?.aborted) return failure("The restore was canceled.");
  let candidate: BrownianRadiusSession | undefined;
  let adopted = false;
  try {
    candidate = createBrownianRadiusSession(instanceId, definition, examples, workerFactories);
    candidate.group.connect();
    if (tape.group.enabled) {
      const notice = await calculateLinked(candidate, tape.group.valueSI as number, options);
      if (notice) return failure(notice);
    } else {
      for (const [index, id] of MEMBER_IDS.entries()) {
        const owner = candidate.sessions[index];
        const recorded = settings[id];
        if (!owner || !recorded) return failure("One member's settings are missing.");
        const result = await applyWorkerSettings(owner, recorded, options);
        if (result.kind !== "restored") return failure(`${id.toUpperCase()}: ${result.notice}`);
      }
    }
    if (options.signal?.aborted) return failure("The restore was canceled.");
    const displayed = candidate.group.getSnapshot().displayed;
    if (
      displayed.length !== 2 ||
      MEMBER_IDS.some(
        (id) => displayed.filter((snapshot) => snapshot.experimentId === id).length !== 1,
      ) ||
      displayed.some((snapshot) => {
        const recorded = settings[snapshot.experimentId];
        return !snapshot.final || !recorded || !sameSettings(snapshot.parameters, recorded);
      })
    )
      return failure("The complete accepted comparison does not match the recorded settings.");
    adopted = true;
    return {
      kind: "restored",
      session: candidate,
      notice: tape.group.enabled
        ? "Both instruments were recalculated from the shared settings and linked in one new comparison. The tracer uses the recorded seed and grid; this link does not store its previous trajectory."
        : "Both instruments were recalculated from their shared settings and remain independent. The tracer uses the recorded seed and grid; this link does not store its previous trajectory.",
    };
  } catch (error) {
    return failure(String(error));
  } finally {
    // Brownian disconnect unlinks and disposes. A successful candidate must stay connected until
    // the component adopts it; stale completions are disposed by that component instead.
    if (!adopted) candidate?.group.disconnect();
  }
}

export async function restoreBrownianRadiusFromUrl(
  instanceId: string,
  definition: ExperimentGroupDefinition,
  examples: BrownianRadiusExamples,
  workerFactories: BrownianRadiusWorkers,
  href: string,
  signal?: AbortSignal,
): Promise<BrownianRadiusTapeRestore> {
  let address: URL;
  try {
    address = new URL(href);
  } catch {
    return { kind: "absent" };
  }
  if (!address.searchParams.has("tape")) return { kind: "absent" };
  if (signal?.aborted) return failure("The restore was canceled.");
  try {
    const { decodeTapeDocumentInBrowser } = await import("../permalink/browserCodec.ts");
    if (signal?.aborted) return failure("The restore was canceled.");
    const decoded = await decodeTapeDocumentInBrowser(address);
    if (signal?.aborted) return failure("The restore was canceled.");
    if (decoded.kind === "absent") return decoded;
    if (decoded.kind === "invalid") return failure(decoded.notice);
    return await restoreBrownianRadiusTape(
      instanceId,
      definition,
      examples,
      workerFactories,
      decoded.tape,
      { signal },
    );
  } catch (error) {
    return failure(String(error));
  }
}
