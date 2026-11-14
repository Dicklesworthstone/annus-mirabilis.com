import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { convertValue } from "../../units/adapters.ts";
import { decodeTapeDocument, encodeTapePermalink } from "../permalink/codec.ts";
import { tapeForSettings } from "../permalink/sessionTape.ts";
import type { TapeGroupV3 } from "../permalink/types.ts";
import { DEFAULT_PREPARED_EXAMPLE as doppler } from "../sr09/session.ts";
import { SR09_TAPE } from "../sr09/tape.ts";
import { DEFAULT_PREPARED_EXAMPLE as lightComplex } from "../sr10/session.ts";
import { createLinkedObserverSession } from "./linkedObserver.ts";
import {
  restoreLinkedObserverFromUrl,
  restoreLinkedObserverTape,
  tapeForLinkedObserver,
} from "./linkedObserverTape.ts";
import { loadRelativityObserverGroup } from "./load.ts";

const definition = loadRelativityObserverGroup();
const examples = { doppler, lightComplex };
const speed = (beta: number) => convertValue(beta, "c", "m/s");

function recorded(enabled = true): TapeGroupV3 {
  const source = createLinkedObserverSession("tape-source", definition, examples);
  source.connect();
  try {
    if (enabled) source.link(speed(-0.6));
    else {
      source.changeIndependentSpeed("sr-09", speed(-0.6));
      source.changeIndependentSpeed("sr-10", speed(0.2));
    }
    const tape = tapeForLinkedObserver(source);
    assert(tape);
    return tape;
  } finally {
    source.disconnect();
  }
}

describe("saved comparisons replay through two independently owned instrument sessions", () => {
  test("a linked pair round-trips with the same readings and fresh local owners", () => {
    const tape = recorded();
    const decoded = decodeTapeDocument(encodeTapePermalink(tape));
    assert(decoded.kind === "success");
    const restored = restoreLinkedObserverTape("reopened-pair", definition, examples, decoded.tape);
    assert(restored.kind === "restored");
    const session = restored.session;
    const state = session.getSnapshot();
    expect(state.enabled).toBe(true);
    expect(state.phase).toBe("accepted");
    expect(state.coherent?.valueSI).toBe(speed(-0.6));
    expect(state.coherent?.members.map((member) => member.snapshot.parameters.beta)).toEqual([-0.6, -0.6]);
    expect(new Set(state.coherent?.members.map((member) => member.snapshot.runId)).size).toBe(2);
    expect(state.members.every((member) => member.instanceId.startsWith("reopened-pair"))).toBe(true);
    expect(encodeTapePermalink(tapeForLinkedObserver(session) as TapeGroupV3)).toBe(encodeTapePermalink(tape));
    session.connect();
    const runs = state.coherent?.members.map((member) => member.snapshot.runId);
    session.changeLinkedSpeed(speed(0.3));
    expect(session.getSnapshot().coherent?.members.map((member) => member.snapshot.runId)).toEqual(runs);
    session.disconnect();
  });

  test("unlinked state preserves different observer speeds and does not opt readers into linking", () => {
    const restored = restoreLinkedObserverTape("independent-pair", definition, examples, recorded(false));
    assert(restored.kind === "restored");
    const session = restored.session;
    expect(session.getSnapshot().enabled).toBe(false);
    expect(session.getSnapshot().phase).toBe("independent");
    expect(session.getSnapshot().coherent).toBeNull();
    expect(session.owners.doppler.acceptedParameters().beta).toBe(-0.6);
    expect(session.owners.lightComplex.acceptedParameters().beta).toBe(0.2);
    session.connect();
    const other = session.owners.lightComplex.getSnapshot().accepted;
    session.changeIndependentSpeed("sr-09", speed(0));
    expect(session.owners.lightComplex.getSnapshot().accepted).toBe(other);
    session.disconnect();
  });

  test("a refused request shares the last complete pair, never its rejected value", () => {
    const source = createLinkedObserverSession("kept-pair", definition, examples);
    source.connect();
    try {
      source.link(speed(-0.6));
      const accepted = tapeForLinkedObserver(source);
      assert(accepted);
      source.changeLinkedSpeed(speed(1));
      expect(source.getSnapshot().phase).toBe("refused");
      expect(tapeForLinkedObserver(source)).toEqual(accepted);
      const restored = restoreLinkedObserverTape("kept-reopened", definition, examples, accepted);
      assert(restored.kind === "restored");
      expect(restored.session.getSnapshot().coherent?.valueSI).toBe(speed(-0.6));
      restored.session.disconnect();
    } finally {
      source.disconnect();
    }
    const refusedFirst = createLinkedObserverSession("refused-first", definition, examples);
    refusedFirst.connect();
    refusedFirst.link(speed(1));
    expect(tapeForLinkedObserver(refusedFirst)).toBeNull();
    refusedFirst.disconnect();
  });

  test("a failed second checkpoint publishes nothing and cannot disturb another mounted pair", () => {
    const current = createLinkedObserverSession("mounted-pair", definition, examples);
    current.connect();
    current.link(speed(0.2));
    const before = current.getSnapshot();
    const tape = recorded();
    const corrupt: TapeGroupV3 = {
      ...tape,
      members: tape.members.map((member) => member.memberId === "sr-10"
        ? { ...member, tape: { ...member.tape, acceptedCheckpoint: { ...member.tape.acceptedCheckpoint, digest: "host:0000000000000000" } } }
        : member),
    };
    const restored = restoreLinkedObserverTape("never-published", definition, examples, corrupt);
    expect(restored.kind).toBe("not-restored");
    expect(current.getSnapshot()).toBe(before);
    expect(current.getSnapshot().coherent).toBe(before.coherent);
    current.disconnect();
  });

  test("capture follows the displayed coherent snapshots after both live owners drift", () => {
    const source = createLinkedObserverSession("drifted-owners", definition, examples);
    source.connect();
    try {
      source.link(speed(-0.6));
      const before = tapeForLinkedObserver(source);
      source.owners.doppler.apply({ ...source.owners.doppler.acceptedParameters(), beta: 0.2 });
      source.owners.lightComplex.apply({
        ...source.owners.lightComplex.acceptedParameters(),
        beta: 0.2,
      });
      expect(source.getSnapshot().phase).toBe("refused");
      expect(source.owners.doppler.acceptedParameters().beta).toBe(0.2);
      expect(tapeForLinkedObserver(source)).toEqual(before);
    } finally {
      source.disconnect();
    }
  });

  test("controls beyond the accepted checkpoint cannot replace the recorded comparison", () => {
    const tape = recorded();
    const future: TapeGroupV3 = {
      ...tape,
      members: tape.members.map((member) => ({
        ...member,
        tape: {
          ...member.tape,
          events: [
            { actionIndex: 1, commandClass: "observer-change", paramId: "beta", value: 0.2 },
            {
              actionIndex: 2,
              commandClass: "setup-change",
              paramId: member.memberId === "sr-09" ? "frequencyTHz" : "initialEnergyJ",
              value: 600,
            },
          ],
        },
      })),
    };
    const restored = restoreLinkedObserverTape("checkpoint-only", definition, examples, future);
    assert(restored.kind === "restored");
    expect(restored.session.owners.doppler.acceptedParameters().beta).toBe(-0.6);
    expect(restored.session.owners.lightComplex.acceptedParameters().beta).toBe(-0.6);
    expect(restored.session.owners.doppler.acceptedParameters().frequencyTHz).toBe(500);
    expect(restored.session.owners.lightComplex.acceptedParameters().initialEnergyJ).toBe(1);
    restored.session.disconnect();
  });

  test("member model, constants and executable mismatches do not silently calculate a new group", () => {
    const tape = recorded();
    for (const patch of [
      { modelIdentity: { ...tape.members[1]?.tape.modelIdentity, modelId: "different-model", modelVersion: 2 } },
      { constantSetId: "different-constants" },
      { streamVersion: "different-stream" },
      { allocationId: "different-allocation" },
    ]) {
      const changed = {
        ...tape,
        members: tape.members.map((member, index) => index === 1
          ? { ...member, tape: { ...member.tape, ...patch } }
          : member),
      };
      const restored = restoreLinkedObserverTape("mismatch", definition, examples, changed);
      expect(restored.kind).toBe("not-restored");
    }
    const changedArtifact = {
      ...tape,
      members: tape.members.map((member) => ({
        ...member,
        tape: { ...member.tape, modelIdentity: { ...member.tape.modelIdentity, artifactDigest: "host:0000000000000000" } },
      })),
    };
    expect(restoreLinkedObserverTape("artifact-mismatch", definition, examples, changedArtifact).kind).toBe("not-restored");
  });

  test("declared membership, shared quantity, domain and each member's accepted value must agree", () => {
    const tape = recorded();
    for (const patch of [
      { groupId: "another-group" },
      { quantityId: "particleRadius" },
      { canonicalUnit: "c" },
      { commandClass: "setup-change" as const },
      { conversion: "none" as const },
      { valueSI: speed(1) },
      { valueSI: speed(0.6) },
    ]) {
      expect(restoreLinkedObserverTape("relation-mismatch", definition, examples, {
        ...tape,
        group: { ...tape.group, ...patch },
      }).kind).toBe("not-restored");
    }
    expect(restoreLinkedObserverTape("wrong-members", definition, examples, {
      ...tape,
      members: tape.members.map((member) => ({ ...member, parameterId: "frequencyTHz" })),
    }).kind).toBe("not-restored");
  });

  test("the fixed light inputs cannot change beneath this lesson's captions", () => {
    const tape = recorded();
    const differentLight = tapeForSettings(SR09_TAPE, { ...doppler.parameters, frequencyTHz: 600, beta: -0.6 });
    assert(differentLight);
    const restored = restoreLinkedObserverTape("different-light", definition, examples, {
      ...tape,
      members: tape.members.map((member) => member.memberId === "sr-09" ? { ...member, tape: differentLight } : member),
    });
    expect(restored.kind === "not-restored" && restored.notice).toContain("fixed light");
  });

  test("standalone V2, invalid URLs and canceled decodes cannot masquerade as a restored pair", async () => {
    const tape = recorded();
    const first = tape.members[0];
    assert(first);
    expect(restoreLinkedObserverTape("single", definition, examples, first.tape).kind).toBe("not-restored");
    expect(await restoreLinkedObserverFromUrl("no-link", definition, examples, "not a URL")).toEqual({ kind: "absent" });
    expect(await restoreLinkedObserverFromUrl("no-link", definition, examples, "https://example.test/lab/linked-observer/")).toEqual({ kind: "absent" });
    const canceled = new AbortController();
    canceled.abort();
    const restored = await restoreLinkedObserverFromUrl(
      "canceled",
      definition,
      examples,
      `https://example.test/lab/linked-observer/?tape=${encodeTapePermalink(tape)}`,
      canceled.signal,
    );
    expect(restored.kind === "not-restored" && restored.notice).toContain("canceled");
  });
});
