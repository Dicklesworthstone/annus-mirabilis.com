import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { convertValue } from "../../units/adapters.ts";
import { SR09_CLASSES } from "../sr09/definition.ts";
import { createSr09Session, DEFAULT_PREPARED_EXAMPLE as doppler } from "../sr09/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as lightComplex } from "../sr10/session.ts";
import type { AcceptedSnapshot } from "../store/instanceStore.ts";
import { createLinkedObserverSession, prepareLinkedObserverExamples } from "./linkedObserver.ts";
import { loadRelativityObserverGroup } from "./load.ts";
import { createGroupMemberPort } from "./memberPort.ts";
import { ExperimentGroupDefinitionError } from "./schema.ts";

const definition = loadRelativityObserverGroup();
const examples = { doppler, lightComplex };
const speed = (beta: number) => convertValue(beta, "c", "m/s");

function output(snapshot: AcceptedSnapshot, quantityId: string): number {
  const result = snapshot.outputs.find((candidate) => candidate.quantityId === quantityId);
  assert(result?.status === "value" && typeof result.value === "number");
  return result.value;
}

describe("one observer across the actual SR-09 and SR-10 owners", () => {
  test("starts with independent static owners and changes only the chosen instrument", () => {
    const session = createLinkedObserverSession("independent", definition, examples);
    const initial = session.getServerSnapshot();
    const light = session.owners.lightComplex.getSnapshot().accepted;
    expect(initial.enabled).toBe(false);
    expect(initial.coherent).toBe(null);
    expect(session.getSnapshot()).toBe(initial);
    session.connect();
    expect(session.changeIndependentSpeed("sr-09", speed(-0.6)).kind).toBe("accepted");
    expect(session.owners.doppler.acceptedParameters().beta).toBe(-0.6);
    expect(session.owners.lightComplex.getSnapshot().accepted).toBe(light);
    expect(session.getSnapshot().phase).toBe("independent");
    session.disconnect();
  });

  test("a coherent observer change gives energy and frequency the same factor without new runs", () => {
    const session = createLinkedObserverSession("same-observer", definition, examples);
    const initial = session.getSnapshot().members.map((member) => member.accepted);
    session.connect();
    expect(session.link(speed(0.6)).kind).toBe("accepted");
    for (const [beta, factor, volumeFactor] of [
      [0, 1, 1],
      [0.6, 0.5, 2],
      [-0.6, 2, 0.5],
    ] as const) {
      expect(session.changeLinkedSpeed(speed(beta)).kind).toBe("accepted");
      const state = session.getSnapshot();
      assert(state.coherent);
      expect(state.phase).toBe("accepted");
      expect(state.coherent.generationId).toBe(state.generationId);
      const frequency = state.coherent.members.find(
        (member) => member.instrumentId === "sr-09",
      )?.snapshot;
      const energy = state.coherent.members.find(
        (member) => member.instrumentId === "sr-10",
      )?.snapshot;
      assert(frequency && energy);
      expect(frequency.parameters.beta).toBe(beta);
      expect(energy.parameters.beta).toBe(beta);
      expect(output(frequency, "dopplerFactor")).toBeCloseTo(factor, 14);
      expect(output(energy, "dopplerFactor")).toBeCloseTo(factor, 14);
      expect(output(frequency, "waveFrequencyMoving")).toBeCloseTo(
        doppler.parameters.frequencyTHz * 1e12 * factor,
        0,
      );
      expect(output(energy, "lightComplexEnergyMoving")).toBeCloseTo(factor, 14);
      expect(output(energy, "volumeFactor")).toBeCloseTo(volumeFactor, 14);
      expect(output(energy, "energyDensityFactor")).toBeCloseTo(factor * factor, 14);
      expect(state.coherent.members.map((member) => member.snapshot.runId)).toEqual(
        initial.map((snapshot) => snapshot?.runId),
      );
      expect(frequency.parameters.frequencyTHz).toBe(doppler.parameters.frequencyTHz);
      expect(energy.parameters.initialEnergyJ).toBe(lightComplex.parameters.initialEnergyJ);
      expect(energy.parameters.initialVolumeM3).toBe(lightComplex.parameters.initialVolumeM3);
    }
    session.disconnect();
  });

  test("out-of-range requests touch neither owner, keep the coherent pair, and recover", () => {
    const session = createLinkedObserverSession("refused", definition, examples);
    session.connect();
    session.link(speed(-0.6));
    const coherent = session.getSnapshot().coherent;
    const owners = [
      session.owners.doppler.getSnapshot(),
      session.owners.lightComplex.getSnapshot(),
    ];
    for (const outside of [speed(1), Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(session.changeLinkedSpeed(outside).kind).toBe("refused");
      expect(session.getSnapshot().phase).toBe("refused");
      expect(session.getSnapshot().coherent).toBe(coherent);
      expect(session.owners.doppler.getSnapshot()).toBe(owners[0]);
      expect(session.owners.lightComplex.getSnapshot()).toBe(owners[1]);
    }
    expect(session.changeLinkedSpeed(speed(0.3)).kind).toBe("accepted");
    expect(session.getSnapshot().phase).toBe("accepted");
    session.disconnect();
  });

  test("unlinking never runs an owner, and another placement never joins implicitly", () => {
    const session = createLinkedObserverSession("first-copy", definition, examples);
    const other = createLinkedObserverSession("second-copy", definition, examples);
    session.connect();
    other.connect();
    const untouched = other.getSnapshot();
    session.link(speed(-0.6));
    expect(other.getSnapshot()).toBe(untouched);
    expect(session.changeIndependentSpeed("sr-09", speed(0.2)).kind).toBe("refused");
    const before = [
      session.owners.doppler.getSnapshot(),
      session.owners.lightComplex.getSnapshot(),
    ];
    session.unlink();
    expect(session.owners.doppler.getSnapshot()).toBe(before[0]);
    expect(session.owners.lightComplex.getSnapshot()).toBe(before[1]);
    session.changeIndependentSpeed("sr-09", speed(0.2));
    expect(session.owners.lightComplex.getSnapshot()).toBe(before[1]);
    expect(other.getSnapshot()).toBe(untouched);
    session.disconnect();
    other.disconnect();
  });

  test("disconnect and reconnect remove subscriptions without reissuing scientific work", () => {
    const session = createLinkedObserverSession("lifetime", definition, examples);
    session.connect();
    session.link(speed(0.2));
    const generation = session.getSnapshot().generationId;
    const snapshot = session.owners.doppler.getSnapshot();
    session.disconnect();
    expect(session.changeLinkedSpeed(speed(0.3)).kind).toBe("refused");
    session.connect();
    session.connect();
    expect(session.getSnapshot().generationId).toBe(generation);
    expect(session.owners.doppler.getSnapshot()).toBe(snapshot);
    session.disconnect();
  });

  test("an external new physical run cannot masquerade as the accepted shared observer", () => {
    const session = createLinkedObserverSession("outside-update", definition, examples);
    session.connect();
    session.link(speed(0.2));
    const coherent = session.getSnapshot().coherent;
    session.owners.lightComplex.startNewRun(session.owners.lightComplex.acceptedParameters());
    expect(session.getSnapshot().phase).toBe("refused");
    expect(session.getSnapshot().coherent).toBe(coherent);
    session.disconnect();
  });

  test("invalid-experiment-group rejects different physical light directions (linkedObserver.ts:52) and false runtime classes (memberPort.ts:55)", () => {
    expect(() =>
      createLinkedObserverSession("different-directions", definition, {
        ...examples,
        lightComplex: {
          ...lightComplex,
          parameters: { ...lightComplex.parameters, propagationAngleDeg: 30 },
        },
      }),
    ).toThrow(ExperimentGroupDefinitionError);
    const owner = createSr09Session("class-check");
    expect(() =>
      createGroupMemberPort(definition, "sr-09", owner, { ...SR09_CLASSES, beta: "input" }),
    ).toThrow(ExperimentGroupDefinitionError);
    expect(() => createGroupMemberPort(definition, "sr-10", owner, SR09_CLASSES)).toThrow(
      ExperimentGroupDefinitionError,
    );
  });

  test("invalid-experiment-group refuses malformed prepared inputs at the JSON boundary (linkedObserver.ts:32)", () => {
    expect(prepareLinkedObserverExamples(examples)).toEqual(examples);
    expect(() =>
      prepareLinkedObserverExamples({
        ...examples,
        doppler: { ...doppler, parameters: { beta: 4 } },
      }),
    ).toThrow(ExperimentGroupDefinitionError);
  });
});
