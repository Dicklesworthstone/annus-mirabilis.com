import { afterEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import {
  brownianReplayFixture,
  brownianReplayLaboratory,
} from "../../testing/brownianGroupReplayHarness.ts";
import { HOST_TRACER_RECORDER } from "../../workers/operations/bm01.ts";
import { createBm06TapeBinding } from "../bm06/tape.ts";
import { verifyBm06ScientificCheckpoint } from "../bm06/tapeCheckpoint.ts";
import { decodeTapeDocument, encodeTapePermalink } from "../permalink/codec.ts";
import { validateTapeGroupV3 } from "../permalink/groupSchema.ts";
import type { TapeGroupV3 } from "../permalink/types.ts";
import { applyWorkerSettings } from "../permalink/workerSessionTape.ts";
import { tapeForBrownianRadius } from "./brownianRadiusTape.ts";
import {
  captureBrownianGroup,
  prepareBrownianGroup,
  restoreBrownianGroup,
} from "./brownianTape.ts";
import { waitFor } from "./testSupport.ts";

const fixture = await brownianReplayFixture();
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function laboratory(options: Parameters<typeof brownianReplayLaboratory>[1] = {}) {
  const lab = brownianReplayLaboratory(fixture, options);
  cleanups.push(lab.disconnect);
  return lab;
}

async function record(lab = laboratory(), radius = 1e-6) {
  lab.bundle.group.link(radius);
  await waitFor(() => lab.bundle.group.getSnapshot().status === "accepted");
  const captured = await captureBrownianGroup(lab.inputs, lab.bundle);
  assert(captured.kind === "captured", JSON.stringify(captured));
  return { lab, tape: captured.tape };
}

function changeMember(
  tape: TapeGroupV3,
  id: string,
  update: (member: TapeGroupV3["members"][number]) => TapeGroupV3["members"][number],
) {
  return validateTapeGroupV3({
    ...tape,
    members: tape.members.map((member) => member.memberId === id ? update(member) : member),
  });
}

describe("scientific Brownian comparison records", () => {
  test("static examples keep settings sharing but cannot claim scientific recording receipts", async () => {
    const lab = laboratory();
    expect(lab.requests()).toBe(0);
    expect(tapeForBrownianRadius(lab.bundle)).not.toBeNull();
    expect((await captureBrownianGroup(lab.inputs, lab.bundle)).kind).toBe("unavailable");
    expect(lab.tracer.channels).toHaveLength(0);
    expect(lab.density).toHaveLength(0);
  });

  test("the real pinned trajectory and complete density checkpoint round-trip through V3", async () => {
    const { lab, tape } = await record();
    const tracer = tape.members.find((member) => member.memberId === "bm-01");
    const density = tape.members.find((member) => member.memberId === "bm-06");
    assert(tracer && density);
    expect(tracer.tape.seed).toBe(fixture.tracer.example.parameters.seed);
    expect(tracer.tape.acceptedCheckpoint.scientificState?.streamPositions).toHaveLength(
      fixture.tracer.example.parameters.M * 3,
    );
    expect(density.tape.acceptedCheckpoint.scientificState).toBeUndefined();
    expect(tracer.tape.acceptedCheckpoint.digest).toMatch(/^host:sha256:[a-f0-9]{64}$/);
    expect(density.tape.acceptedCheckpoint.digest).toMatch(/^host:sha256:[a-f0-9]{64}$/);
    const encoded = encodeTapePermalink(tape);
    const decoded = decodeTapeDocument(encoded);
    assert(decoded.kind === "success" && decoded.tape.tapeVersion === 3);
    expect(decoded.tape).toEqual(tape);
    const before = lab.bundle.group.getSnapshot().displayed;
    const result = await restoreBrownianGroup("restored-pinned-pair", lab.inputs, lab.bundle, decoded.tape);
    assert(result.kind === "restored", JSON.stringify(result));
    cleanups.push(() => result.bundle.group.disconnect());
    expect(lab.bundle.group.getSnapshot().displayed).toEqual(before);
    expect(result.bundle.group.getSnapshot().status).toBe("accepted");
    expect(result.bundle.group.getSnapshot().coherent?.value).toBe(1e-6);
    expect(result.bundle.sessions[0].getSnapshot().accepted?.instanceId).not.toBe(before[0]?.instanceId);
    expect(result.bundle.sessions[1].getSnapshot().accepted?.instanceId).not.toBe(before[1]?.instanceId);
    const recaptured = await captureBrownianGroup(lab.inputs, result.bundle);
    assert(recaptured.kind === "captured", JSON.stringify(recaptured));
    expect(recaptured.tape).toEqual(tape);
    expect(lab.tracer.channels.map((channel) => channel.requests)).toEqual([1, 1, 1]);
    expect(lab.density.map((channel) => channel.requests)).toEqual([1, 1, 1]);
    expect(lab.tracer.channels[1]?.disposed).toBe(true);
    expect(lab.density[1]?.disposed).toBe(true);
    const requests = lab.requests();
    expect(result.bundle.group.adoptAccepted(1e-6)?.kind).toBe("refused");
    expect(lab.requests()).toBe(requests);
    result.bundle.group.update(2e-6);
    await waitFor(() => result.bundle.group.getSnapshot().coherent?.value === 2e-6);
    expect(result.bundle.group.getSnapshot().displayed.every((snapshot) => snapshot.parameters.a === 2e-6)).toBe(true);
  });

  test("a full probability receipt binds interval probability and every field coordinate", async () => {
    const { lab } = await record();
    const session = lab.bundle.sessions[1];
    const binding = createBm06TapeBinding(fixture.density, lab.inputs.workerFactories[1], lab.resources);
    const accepted = session.getSnapshot().accepted;
    assert(accepted);
    const captured = await binding.capture?.(session, accepted);
    assert(captured?.kind === "captured");
    const publication = session.acceptedPublication();
    assert(publication);
    expect(await verifyBm06ScientificCheckpoint(captured.tape, publication, fixture.density.sourceDigest)).toBeNull();
    const changed = structuredClone(publication);
    const probability = changed.outputs.find((output) => output.quantityId === "intervalProbability");
    assert(probability?.status === "value" && typeof probability.value === "number");
    const tamperedProbability = probability.value * 0.9;
    const scalarTamper = {
      ...changed,
      outputs: changed.outputs.map((output) => output === probability
        ? { ...probability, value: tamperedProbability }
        : output),
    };
    expect(await verifyBm06ScientificCheckpoint(captured.tape, scalarTamper, fixture.density.sourceDigest)).not.toBeNull();
    const array = changed.outputs.find((output) => output.status === "value" && output.value instanceof Float64Array);
    assert(array?.status === "value" && array.value instanceof Float64Array);
    array.value[array.value.length - 1] = (array.value[array.value.length - 1] ?? 0) + 1;
    expect(await verifyBm06ScientificCheckpoint(captured.tape, changed, fixture.density.sourceDigest)).not.toBeNull();
    expect(await verifyBm06ScientificCheckpoint(captured.tape, session.acceptedPublication()!, fixture.density.sourceDigest)).toBeNull();
  });

  test("malformed group identity, member settings, streams and source fail before any new worker", async () => {
    const { lab, tape } = await record();
    const variants = [
      validateTapeGroupV3({ ...tape, group: { ...tape.group, groupId: "relativity-observer" } }),
      changeMember(tape, "bm-06", (member) => {
        const { lower: _lower, ...incomplete } = member.tape.initialConditions;
        return { ...member, tape: { ...member.tape, initialConditions: incomplete } };
      }),
      changeMember(tape, "bm-01", (member) => {
        const state = member.tape.acceptedCheckpoint.scientificState;
        assert(state);
        return { ...member, tape: { ...member.tape, acceptedCheckpoint: {
          ...member.tape.acceptedCheckpoint,
          scientificState: {
            ...state,
            streamPositions: state.streamPositions.map((position, i) => i === 0
              ? { ...position, index: "1" as typeof position.index }
              : position),
          },
        } } };
      }),
      changeMember(tape, "bm-06", (member) => ({ ...member, tape: {
        ...member.tape,
        modelIdentity: { ...member.tape.modelIdentity, artifactDigest: "host:sha256:" + "0".repeat(64) },
      } })),
    ];
    const requests = lab.requests();
    for (const invalid of variants)
      expect((await prepareBrownianGroup(lab.inputs, invalid)).kind).toBe("not-restored");
    expect(lab.requests()).toBe(requests);
    expect(lab.tracer.channels).toHaveLength(1);
    expect(lab.density).toHaveLength(1);
  });

  test("a bad second checkpoint disposes both private owners and retains the whole visible pair", async () => {
    const { lab, tape } = await record();
    const before = lab.bundle.group.getSnapshot().displayed;
    const broken = changeMember(tape, "bm-06", (member) => ({ ...member, tape: {
      ...member.tape,
      acceptedCheckpoint: { ...member.tape.acceptedCheckpoint, digest: "host:sha256:" + "0".repeat(64) },
    } }));
    const restored = await restoreBrownianGroup("bad-second-checkpoint", lab.inputs, lab.bundle, broken);
    expect(restored.kind).toBe("not-restored");
    expect(lab.bundle.group.getSnapshot().displayed).toEqual(before);
    expect(lab.tracer.channels.slice(1).every((channel) => channel.disposed)).toBe(true);
    expect(lab.density.slice(1).every((channel) => channel.disposed)).toBe(true);
    expect(lab.resources.admission.activeCount).toBe(0);
  });

  test("a host normal transform never stands in for the recorded pinned engine", async () => {
    const source = await record();
    const lab = laboratory({ tracer: { recorder: () => HOST_TRACER_RECORDER } });
    const before = lab.bundle.group.getSnapshot().displayed;
    const result = await restoreBrownianGroup("wrong-engine", lab.inputs, lab.bundle, source.tape);
    expect(result.kind).toBe("not-restored");
    expect(lab.bundle.group.getSnapshot().displayed).toEqual(before);
    expect(lab.tracer.channels.every((channel) => channel.disposed)).toBe(true);
    expect(lab.density).toHaveLength(0);
    lab.bundle.group.link(1e-6);
    await waitFor(() => lab.bundle.group.getSnapshot().status === "accepted");
    const captured = await captureBrownianGroup(lab.inputs, lab.bundle);
    expect(captured.kind).toBe("unavailable");
    if (captured.kind === "unavailable") expect(captured.notice).toContain("pinned FrankenSim");
  });

  test("independent recorded radii restore independently and never change the other owner's run", async () => {
    const lab = laboratory();
    const left = await applyWorkerSettings(lab.bundle.sessions[0], {
      ...fixture.tracer.example.parameters, a: 1e-6,
    });
    const right = await applyWorkerSettings(lab.bundle.sessions[1], {
      ...fixture.density.parameters, a: 2e-6,
    });
    expect(left.kind).toBe("restored");
    expect(right.kind).toBe("restored");
    const captured = await captureBrownianGroup(lab.inputs, lab.bundle);
    assert(captured.kind === "captured", JSON.stringify(captured));
    expect(captured.tape.group.enabled).toBe(false);
    const result = await restoreBrownianGroup("independent-recording", lab.inputs, lab.bundle, captured.tape);
    assert(result.kind === "restored", JSON.stringify(result));
    cleanups.push(() => result.bundle.group.disconnect());
    expect(result.bundle.group.getSnapshot().enabled).toBe(false);
    expect(result.bundle.group.getSnapshot().displayed.map((snapshot) => snapshot.parameters.a)).toEqual([1e-6, 2e-6]);
    const density = result.bundle.sessions[1].getSnapshot().accepted;
    result.bundle.group.applyMember("bm-01", 3e-6);
    await waitFor(() => result.bundle.sessions[0].getSnapshot().accepted?.parameters.a === 3e-6);
    expect(result.bundle.sessions[1].getSnapshot().accepted).toBe(density);
  });

  test("cancel during second-owner rehearsal disposes the private pair without late publication", async () => {
    const { lab, tape } = await record(laboratory({ densityHold: (index) => index === 1 }));
    const before = lab.bundle.group.getSnapshot().displayed;
    const controller = new AbortController();
    const pending = restoreBrownianGroup("canceled-pair", lab.inputs, lab.bundle, tape, { signal: controller.signal });
    await waitFor(() => lab.density[1]?.results.length === 1);
    controller.abort();
    expect((await pending).kind).toBe("not-restored");
    for (const channel of lab.density) channel.release();
    expect(lab.bundle.group.getSnapshot().displayed).toEqual(before);
    expect(lab.tracer.channels.slice(1).every((channel) => channel.disposed)).toBe(true);
    expect(lab.density.slice(1).every((channel) => channel.disposed)).toBe(true);
    expect(lab.resources.admission.activeCount).toBe(0);
  });

  test("a newer visible edit supersedes a private verified pair", async () => {
    const { lab, tape } = await record(laboratory({ densityHold: (index) => index === 1 }));
    const pending = restoreBrownianGroup("superseded-pair", lab.inputs, lab.bundle, tape);
    await waitFor(() => lab.density[1]?.results.length === 1);
    lab.bundle.group.unlink();
    lab.bundle.group.applyMember("bm-01", 2e-6);
    await waitFor(() => lab.bundle.sessions[0].getSnapshot().accepted?.parameters.a === 2e-6);
    lab.density[1]?.release();
    expect((await pending).kind).toBe("not-restored");
    expect(lab.bundle.sessions[0].acceptedParameters().a).toBe(2e-6);
    expect(lab.bundle.group.getSnapshot().enabled).toBe(false);
    expect(lab.tracer.channels.slice(1).every((channel) => channel.disposed)).toBe(true);
  });

  test("a superseded replay releases a held private worker without waiting for its reply", async () => {
    const { lab, tape } = await record(laboratory({ densityHold: (index) => index === 1 }));
    const cancellation = new AbortController();
    const pending = restoreBrownianGroup("superseded-held-pair", lab.inputs, lab.bundle, tape, {
      signal: cancellation.signal,
      timeoutMs: 15_000,
    });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await waitFor(() => lab.density[1]?.results.length === 1);
      lab.bundle.group.update(2e-6);
      const result = await Promise.race([
        pending,
        new Promise<null>((resolve) => {
          timeout = setTimeout(() => resolve(null), 1000);
        }),
      ]);
      assert(result, "A superseded replay must not wait for the held worker or its timeout.");
      expect(result.kind).toBe("not-restored");
      if (result.kind === "not-restored") expect(result.notice).toContain("newer change");
      expect(lab.density[1]?.disposed).toBe(true);
      await waitFor(() => lab.bundle.group.getSnapshot().coherent?.value === 2e-6);
      expect(lab.bundle.group.getSnapshot().status).toBe("accepted");
      expect(lab.resources.admission.activeCount).toBe(0);
      expect(lab.resources.admission.queuedCount).toBe(0);
      // A late delivery cannot resurrect the retired candidate or change the newer comparison.
      const latest = lab.bundle.group.getSnapshot().coherent;
      lab.density[1]?.release();
      await Promise.resolve();
      expect(lab.bundle.group.getSnapshot().coherent).toBe(latest);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      cancellation.abort();
      await pending;
    }
  });

  test("restoration cancels pending old owners under a two-worker admission bound", async () => {
    const source = await record();
    const lab = laboratory({
      tracer: { hold: (index) => index === 0 },
      densityHold: (index) => index === 0,
    });
    const before = lab.bundle.group.getSnapshot().displayed;
    lab.bundle.group.link(2e-6);
    await waitFor(() => lab.tracer.channels[0]?.results.length === 1 && lab.density[0]?.results.length === 1);
    expect(lab.resources.admission.activeCount).toBe(2);
    const restored = await restoreBrownianGroup("bounded-private-pair", lab.inputs, lab.bundle, source.tape);
    assert(restored.kind === "restored", JSON.stringify(restored));
    cleanups.push(() => restored.bundle.group.disconnect());
    lab.tracer.channels[0]?.release();
    lab.density[0]?.release();
    expect(lab.bundle.group.getSnapshot().displayed).toEqual(before);
    expect(restored.bundle.group.getSnapshot().coherent?.value).toBe(1e-6);
    expect(lab.resources.admission.activeCount).toBe(0);
    expect(lab.resources.admission.queuedCount).toBe(0);
  });

  test("hidden time does not spend either replay's active scheduling budget", async () => {
    const { lab, tape } = await record();
    const before = lab.requests();
    lab.bundle.group.setSchedulingPaused(true);
    const pending = restoreBrownianGroup("paused-pair", lab.inputs, lab.bundle, tape, { timeoutMs: 1000 });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(lab.requests()).toBe(before);
    lab.bundle.group.setSchedulingPaused(false);
    const restored = await pending;
    assert(restored.kind === "restored", JSON.stringify(restored));
    cleanups.push(() => restored.bundle.group.disconnect());
    expect(restored.bundle.group.getSnapshot().status).toBe("accepted");
  });
  test("a visible change during asynchronous preparation prevents all private worker creation", async () => {
    const { lab, tape } = await record();
    const beforeChannels = [lab.tracer.channels.length, lab.density.length];
    const pending = restoreBrownianGroup("superseded-before-replay", lab.inputs, lab.bundle, tape);
    lab.bundle.group.update(2e-6);
    const result = await pending;
    expect(result.kind).toBe("not-restored");
    if (result.kind === "not-restored") expect(result.notice).toContain("newer change");
    expect([lab.tracer.channels.length, lab.density.length]).toEqual(beforeChannels);
    await waitFor(() => lab.bundle.group.getSnapshot().coherent?.value === 2e-6);
  });

  test("a stop subscriber's newer generation is neither canceled nor treated as the restore baseline", async () => {
    const source = await record();
    const lab = laboratory({
      tracer: { hold: (index) => index === 0 },
      densityHold: (index) => index === 0,
    });
    lab.bundle.group.link(2e-6);
    await waitFor(() => lab.tracer.channels[0]?.results.length === 1 && lab.density[0]?.results.length === 1);
    let edited = false;
    const unsubscribe = lab.bundle.sessions[0].subscribe(() => {
      if (!edited && lab.bundle.sessions[0].getSnapshot().status === "paused") {
        edited = true;
        lab.bundle.group.update(3e-6);
      }
    });
    cleanups.push(unsubscribe);
    const result = await restoreBrownianGroup("reentrant-newer-request", lab.inputs, lab.bundle, source.tape);
    expect(edited).toBe(true);
    expect(result.kind).toBe("not-restored");
    expect(lab.bundle.sessions[1].getSnapshot().requested?.parameters.a).toBe(3e-6);
    expect(lab.bundle.sessions[1].getSnapshot().pending).toBe(true);
    expect(lab.tracer.channels[0]?.disposed).toBe(true);
    for (const channel of lab.tracer.channels) channel.release();
    for (const channel of lab.density) channel.release();
    await waitFor(() => lab.bundle.group.getSnapshot().coherent?.value === 3e-6);
  });

});
