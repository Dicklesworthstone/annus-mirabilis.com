/**
 * A group link is restored into private owners, checked completely, then handed to the view.
 * A malformed member, changed model, mismatched relation or canceled decode cannot touch the
 * mounted comparison. The two owners never share an instance, run, checkpoint or control tape.
 */
import { convertValue } from "../../units/adapters.ts";
import { validateTapeGroupV3 } from "../permalink/groupSchema.ts";
import { replayTapeOnSession, tapeForSettings } from "../permalink/sessionTape.ts";
import type { TapeDocument, TapeGroupV3 } from "../permalink/types.ts";
import { SR09_TAPE } from "../sr09/tape.ts";
import { SR10_TAPE } from "../sr10/tape.ts";
import type { ExperimentGroupState } from "./groupStore.ts";
import { createLinkedObserverSession, type LinkedObserverExamples } from "./linkedObserver.ts";
import { type ExperimentGroupDefinition, insideGroupDomain } from "./schema.ts";

export type LinkedObserverSession = ReturnType<typeof createLinkedObserverSession>;

export type LinkedObserverTapeRestore =
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "restored"; session: LinkedObserverSession }>
  | Readonly<{ kind: "not-restored"; notice: string }>;

function failure(notice: string): LinkedObserverTapeRestore {
  return {
    kind: "not-restored",
    notice: `The shared comparison could not be restored. ${notice} Your comparison is unchanged.`,
  };
}

/** Capture the displayed complete generation, never a refused request or a half-settled pair. */
export function tapeForLinkedObserver(
  session: LinkedObserverSession,
  state: ExperimentGroupState = session.getSnapshot(),
): TapeGroupV3 | null {
  const accepted = state.enabled
    ? state.coherent?.members.map((member) => member.snapshot)
    : state.members.map((member) => member.accepted);
  if (!accepted || accepted.length !== 2 || accepted.some((snapshot) => !snapshot?.final))
    return null;
  const members: TapeGroupV3["members"][number][] = [];
  for (const binding of [SR09_TAPE, SR10_TAPE]) {
    const instrument = binding.environment.experimentId;
    const snapshot = accepted.find((value) => value?.experimentId === instrument);
    const declared = session.definition.members.find(
      (member) => member.instrumentId === instrument,
    );
    if (!snapshot || !declared) return null;
    const tape = tapeForSettings(binding, snapshot.parameters);
    if (!tape) return null;
    members.push({
      memberId: instrument,
      parameterId: declared.parameterId,
      displayUnit: declared.displayUnit,
      tape,
    });
  }
  const definition = session.definition;
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
      enabled: state.enabled,
      valueSI: state.enabled ? state.coherent?.valueSI : null,
    },
    members,
  });
}

/** Compatibility is checked against the compiled declaration, never a link-supplied adapter. */
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
        (member.memberId === "sr-09" || member.memberId === "sr-10") &&
        declared !== undefined &&
        declared.instrumentId === member.tape.experimentId &&
        declared.parameterId === member.parameterId &&
        declared.displayUnit === member.displayUnit
      );
    })
  );
}

function sameFixedInputs(parameters: object, example: object): boolean {
  const current = parameters as Record<string, unknown>;
  const fixed = example as Record<string, unknown>;
  return (
    Object.keys(current).length === Object.keys(fixed).length &&
    Object.keys(fixed).every((key) => key === "beta" || current[key] === fixed[key])
  );
}

export function restoreLinkedObserverTape(
  instanceId: string,
  definition: ExperimentGroupDefinition,
  examples: LinkedObserverExamples,
  document: TapeDocument,
): LinkedObserverTapeRestore {
  if (document.tapeVersion !== 3)
    return failure("This link describes one instrument; this page needs both comparison members.");
  let tape: TapeGroupV3;
  try {
    tape = validateTapeGroupV3(document);
  } catch (error) {
    return failure(String(error));
  }
  if (!matchingDeclaration(tape, definition))
    return failure("Its membership or declared shared quantity differs from this comparison.");
  if (tape.group.enabled && !insideGroupDomain(definition.domain, tape.group.valueSI as number))
    return failure("Its shared observer lies outside the range admitted by both instruments.");

  // No mounted owner is passed here. The view swaps the whole candidate only after success.
  const candidate = createLinkedObserverSession(instanceId, definition, examples);
  try {
    for (const member of tape.members) {
      const doppler = member.memberId === "sr-09";
      const owner = doppler ? candidate.owners.doppler : candidate.owners.lightComplex;
      const binding = doppler ? SR09_TAPE : SR10_TAPE;
      const replayed = replayTapeOnSession(binding, owner, member.tape);
      if (replayed.kind !== "success")
        return failure(
          replayed.kind === "refusal"
            ? `${replayed.notice} ${replayed.repair}`
            : replayed.notice,
        );
      if (
        !sameFixedInputs(
          owner.acceptedParameters(),
          doppler ? examples.doppler.parameters : examples.lightComplex.parameters,
        )
      )
        return failure("The recorded light inputs differ from this lesson's fixed light.");
      const accepted = owner.getSnapshot().accepted;
      if (!accepted?.final)
        return failure("One instrument has not accepted a complete checkpoint.");
      const beta = accepted.parameters.beta;
      if (typeof beta !== "number") return failure("One instrument has no accepted observer.");
      const valueSI = convertValue(beta, member.displayUnit, definition.canonicalUnit);
      const declared = definition.members.find((entry) => entry.instrumentId === member.memberId);
      if (!declared || !insideGroupDomain(declared.domain, valueSI))
        return failure("One recorded observer lies outside its instrument's admitted range.");
      if (
        tape.group.enabled &&
        Math.abs(valueSI - (tape.group.valueSI as number)) >
          8 *
            Number.EPSILON *
            Math.max(1, Math.abs(valueSI), Math.abs(tape.group.valueSI as number))
      )
        return failure("The members do not describe the recorded shared observer.");
    }
    candidate.connect();
    if (tape.group.enabled) {
      const linked = candidate.link(tape.group.valueSI as number);
      const restored = candidate.getSnapshot();
      if (
        linked.kind !== "accepted" ||
        restored.phase !== "accepted" ||
        restored.coherent?.members.length !== 2
      )
        return failure("Both instruments must accept one coherent comparison.");
    }
    return { kind: "restored", session: candidate };
  } catch (error) {
    return failure(String(error));
  } finally {
    // The mounted component owns the successful candidate's next connection.
    candidate.disconnect();
  }
}

/** Decode cancellation and a failed second member never publish a partial comparison. */
export async function restoreLinkedObserverFromUrl(
  instanceId: string,
  definition: ExperimentGroupDefinition,
  examples: LinkedObserverExamples,
  href: string,
  signal?: AbortSignal,
): Promise<LinkedObserverTapeRestore> {
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
    return restoreLinkedObserverTape(instanceId, definition, examples, decoded.tape);
  } catch (error) {
    return failure(String(error));
  }
}
