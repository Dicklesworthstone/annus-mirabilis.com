import { describe, expect, test } from "bun:test";
import { replayTapeOnSession, tapeForSettings } from "../permalink/sessionTape.ts";
import type { AcceptedSnapshot, NumericView } from "../store/instanceStore.ts";
import { ALL_CONSTRAINTS, joinConstraints, SR04_DEFAULTS, SR04_OUTPUTS } from "./definition.ts";
import { createSr04Session } from "./session.ts";
import { SR04_TAPE } from "./tape.ts";

type Session = ReturnType<typeof createSr04Session>;

function accepted(session: Session): AcceptedSnapshot {
  const snapshot = session.getSnapshot().accepted;
  if (!snapshot) throw new Error("SR-04 must retain an accepted calculation.");
  return snapshot;
}

function output(snapshot: AcceptedSnapshot, quantityId: string) {
  const found = snapshot.outputs.find((item) => item.quantityId === quantityId);
  if (!found) throw new Error(`Missing SR-04 output: ${quantityId}.`);
  return found;
}

function vector(snapshot: AcceptedSnapshot, quantityId: string): NumericView {
  const result = output(snapshot, quantityId);
  if (result.status !== "value" || typeof result.value === "number")
    throw new Error(`SR-04 ${quantityId} must publish an immutable numeric vector.`);
  return result.value;
}

describe("SR-04 accepted calculation and published construction", () => {
  test("publishes all declared quantities and the cancellation-free slow-case deviation", () => {
    const session = createSr04Session("sr04-published");
    const snapshot = accepted(session);
    expect(snapshot.outputs.map((item) => item.quantityId).sort()).toEqual(
      Object.keys(SR04_OUTPUTS).sort(),
    );
    expect(output(snapshot, "constraintFamily").status).toBe("not-applicable");
    expect(output(snapshot, "slowCaseGalilean")).toMatchObject({ status: "value", value: -20 });
    const deviation = output(snapshot, "slowCaseDeviation");
    expect(deviation.status).toBe("value");
    if (deviation.status === "value" && typeof deviation.value === "number")
      expect(deviation.value / -6.67590033632173e-14).toBeCloseTo(1, 12);

    const residuals = vector(snapshot, "candidateResiduals");
    expect(residuals.length).toBe(ALL_CONSTRAINTS.length);
    expect(residuals.at(0)).toBeCloseTo(-0.6, 14);
    expect(residuals.at(1)).toBeCloseTo(-0.6, 14);
    expect(residuals.at(2)).toBeCloseTo(-0.36, 14);
    expect(residuals.at(3)).toBe(0);
    expect(residuals.at(4)).toBe(0);
    expect(residuals.at(5)).toBe(0);
    expect(output(snapshot, "candidateResiduals").unit).toBe("1");
  });

  test("constraint steps advance accepted versions and estimator revisions within one run", () => {
    const session = createSr04Session("sr04-construction");
    const first = accepted(session);
    let previous = first;
    for (let count = 1; count <= ALL_CONSTRAINTS.length; count++) {
      const enabledConstraints = joinConstraints(ALL_CONSTRAINTS.slice(0, count));
      expect(session.apply({ enabledConstraints }).kind).toBe("accepted");
      const snapshot = accepted(session);
      expect(snapshot.runId).toBe(first.runId);
      expect(snapshot.parentRunId).toBe(first.parentRunId);
      expect(snapshot.revisions).toEqual({
        input: 1,
        observer: 0,
        measurement: 0,
        estimator: count,
      });
      expect(snapshot.snapshotVersion).toBe(previous.snapshotVersion + 1);
      expect(output(snapshot, "constraintFamily").status).toBe(
        count < 5 ? "underdetermined" : "value",
      );
      expect(output(snapshot, "candidateResiduals").status).toBe("not-applicable");
      previous = snapshot;
    }
    // The previous published candidate remains intact after the construction has advanced.
    expect(output(first, "constraintFamily").status).toBe("not-applicable");
    const coefficients = vector(previous, "constraintFamily");
    expect(coefficients.length).toBe(3);
    expect(coefficients.at(0)).toBeCloseTo(1.25, 14);
    expect(coefficients.at(1)).toBeCloseTo(1.25, 14);
    expect(coefficients.at(2)).toBeCloseTo(-0.75, 14);
  });

  test("observer, measurement and presentation controls preserve the candidate run identity", () => {
    const session = createSr04Session("sr04-command-classes");
    const initial = accepted(session);
    expect(session.apply({ vOverC: 0.8 }).kind).toBe("accepted");
    const observer = accepted(session);
    expect(observer.runId).toBe(initial.runId);
    expect(observer.revisions).toEqual({ input: 1, observer: 1, measurement: 0, estimator: 0 });
    const rightRay = output(observer, "rightRayFraction");
    expect(rightRay.status).toBe("value");
    if (rightRay.status === "value" && typeof rightRay.value === "number")
      expect(rightRay.value).toBeCloseTo(0.2, 14);

    expect(session.apply({ observerSpeed: 40 }).kind).toBe("accepted");
    const measurement = accepted(session);
    expect(measurement.runId).toBe(initial.runId);
    expect(measurement.revisions).toEqual({ input: 1, observer: 1, measurement: 1, estimator: 0 });
    expect(output(measurement, "slowCaseGalilean")).toMatchObject({ status: "value", value: -30 });

    expect(session.apply({ showLaterAids: true }).kind).toBe("accepted");
    const presentation = accepted(session);
    expect(presentation.runId).toBe(initial.runId);
    expect(presentation.revisions).toEqual(measurement.revisions);
    expect(presentation.snapshotVersion).toBe(measurement.snapshotVersion + 1);
    expect(session.getServerSnapshot().accepted).toBe(initial);
  });

  test("transverse coefficients and candidate selection are setup changes with a retained parent", () => {
    const session = createSr04Session("sr04-candidate-setup");
    const initial = accepted(session);
    expect(session.apply({ candidateTransverseScale: 2 }).kind).toBe("accepted");
    const transverse = accepted(session);
    expect(transverse.runId).not.toBe(initial.runId);
    expect(transverse.parentRunId).toBe(initial.runId);
    expect(transverse.revisions.input).toBe(initial.revisions.input + 1);
    expect(session.apply({ testCandidate: true }).kind).toBe("accepted");
    const candidate = accepted(session);
    expect(candidate.runId).not.toBe(transverse.runId);
    expect(candidate.parentRunId).toBe(transverse.runId);
    expect(vector(candidate, "candidateResiduals").at(5)).toBe(3);
    expect(session.apply({ vOverC: 0.4 }).kind).toBe("accepted");
    expect(accepted(session).runId).toBe(candidate.runId);
    expect(accepted(session).parentRunId).toBe(transverse.runId);
  });

  test("readouts and numeric buffers cannot mutate an accepted owner calculation", () => {
    const session = createSr04Session("sr04-immutable");
    const calculation = session.getCalculation();
    const snapshot = accepted(session);
    expect(session.getCalculation()).toBe(calculation);
    expect(Object.isFrozen(calculation)).toBe(true);
    expect(Object.isFrozen(calculation.family)).toBe(true);
    expect(Object.isFrozen(calculation.laterAids.matrix)).toBe(true);
    expect(Object.isFrozen(snapshot.revisions)).toBe(true);
    const residuals = vector(snapshot, "candidateResiduals");
    const copied = residuals.copy();
    copied[0] = 99;
    expect(residuals.at(0)).toBeCloseTo(-0.6, 14);
    expect(session.apply(SR04_DEFAULTS).kind).toBe("accepted");
    expect(session.getCalculation()).toBe(calculation);
  });

  test("invalid inputs keep the accepted construction and cached readout", () => {
    const session = createSr04Session("sr04-refusal");
    const before = accepted(session);
    const calculation = session.getCalculation();
    const response = session.apply({ vOverC: 1 });
    expect(response.kind).toBe("refused");
    if (response.kind === "refused") expect(response.refusal.code).toBe("invalid-parameter");
    expect(accepted(session)).toBe(before);
    expect(session.getCalculation()).toBe(calculation);
    expect(session.acceptedParameters()).toEqual(SR04_DEFAULTS);
  });

  test("a singular candidate cannot publish non-finite values or replace the last accepted result", () => {
    const session = createSr04Session("sr04-singular");
    const before = accepted(session);
    const calculation = session.getCalculation();
    const response = session.apply({ testCandidate: true, candidateB: 0, candidateD: 0 });
    expect(response.kind).toBe("refused");
    if (response.kind === "refused") {
      expect(response.refusal.code).toBe("invalid-parameter");
      expect(response.refusal.details?.requirements).toContain("elapsed time for a light ray");
      expect(response.refusal.rankedRepairs[0]?.action).toEqual({
        parameterId: "testCandidate",
        value: false,
      });
    }
    expect(session.getSnapshot().outcome).toBeNull();
    expect(session.getSnapshot().pending).toBe(false);
    expect(accepted(session)).toBe(before);
    expect(session.getCalculation()).toBe(calculation);
    expect(session.acceptedParameters()).toEqual(SR04_DEFAULTS);

    // A refused candidate never changes the accepted settings or creates a candidate run.
    expect(session.apply({ observerSpeed: 40 }).kind).toBe("accepted");
    expect(accepted(session).parameters).toEqual({ ...SR04_DEFAULTS, observerSpeed: 40 });
    expect(output(accepted(session), "slowCaseGalilean")).toMatchObject({
      status: "value",
      value: -30,
    });
    expect(session.getCalculation().family.status).toBe("residual-report");
    expect(session.getSnapshot().outcome).toBeNull();
  });

  test("an explicit new run preserves its parent and recomputes a complete accepted construction", () => {
    const session = createSr04Session("sr04-restart");
    const before = accepted(session);
    expect(session.startNewRun(session.acceptedParameters()).kind).toBe("accepted");
    const restarted = accepted(session);
    expect(restarted.runId).not.toBe(before.runId);
    expect(restarted.parentRunId).toBe(before.runId);
    expect(restarted.revisions.input).toBe(before.revisions.input + 1);
    expect(restarted.snapshotVersion).toBe(before.snapshotVersion + 1);
    expect(restarted.outputs.length).toBe(Object.keys(SR04_OUTPUTS).length);
  });

  test("a settings tape replays every command class across local revision histories", () => {
    const parameters = {
      ...SR04_DEFAULTS,
      vOverC: -0.8,
      enabledConstraints: joinConstraints(ALL_CONSTRAINTS),
      observerSpeed: 40,
      showLaterAids: true,
    };
    const tape = tapeForSettings(SR04_TAPE, parameters);
    expect(tape).not.toBeNull();
    if (!tape) throw new Error("The accepted SR-04 settings must produce a tape.");
    const session = createSr04Session("sr04-tape-roundtrip");
    expect(replayTapeOnSession(SR04_TAPE, session, tape).kind).toBe("success");
    expect(session.acceptedParameters()).toEqual(parameters);
    expect(accepted(session).revisions).toEqual({
      input: 1,
      observer: 1,
      measurement: 1,
      estimator: 1,
    });
    expect(vector(accepted(session), "constraintFamily").at(2)).toBeCloseTo(4 / 3, 14);

    // Input revisions are local bookkeeping: old tapes counted this observer change as a
    // setup. The tape's settings digest and action index remain the portable checkpoint.
    const previousRevisions = {
      ...tape,
      acceptedCheckpoint: {
        ...tape.acceptedCheckpoint,
        acceptedInputRevision: tape.acceptedCheckpoint.acceptedInputRevision + 1,
      },
    };
    const replayed = replayTapeOnSession(SR04_TAPE, session, previousRevisions);
    expect(replayed.kind).toBe("success");
    if (replayed.kind === "success") {
      expect(replayed.acceptedCheckpoint.acceptedInputRevision).toBe(1);
      expect(replayed.acceptedCheckpoint.digest).toBe(tape.acceptedCheckpoint.digest);
    }

    // Scientific-model compatibility is still mandatory, and is checked on an isolated owner.
    const before = accepted(session);
    const incompatible = {
      ...tape,
      modelIdentity: { ...tape.modelIdentity, modelVersion: tape.modelIdentity.modelVersion + 1 },
    };
    expect(replayTapeOnSession(SR04_TAPE, session, incompatible).kind).not.toBe("success");
    expect(accepted(session)).toBe(before);
  });

  test("an accepted checkpoint restores its immutable vectors and exact cached calculation", () => {
    const session = createSr04Session("sr04-checkpoint");
    const parameters = {
      ...SR04_DEFAULTS,
      vOverC: -0.6,
      enabledConstraints: joinConstraints(ALL_CONSTRAINTS),
    };
    expect(session.apply(parameters).kind).toBe("accepted");
    const checkpoint = session.exportCheckpoint();
    expect(checkpoint).not.toBeNull();
    const restored = createSr04Session("sr04-checkpoint");
    expect(restored.restoreCheckpoint(checkpoint).kind).toBe("restored");
    expect(restored.exportCheckpoint()).toEqual(checkpoint);
    expect(restored.acceptedParameters()).toEqual(parameters);
    expect(restored.getCalculation()).toEqual(session.getCalculation());
    expect(restored.getCalculation()).toBe(restored.getCalculation());
    expect(vector(accepted(restored), "constraintFamily").at(2)).toBeCloseTo(0.75, 14);

    if (!checkpoint) throw new Error("The complete calculation must have an accepted checkpoint.");
    const incompatible = {
      ...checkpoint,
      accepted: {
        ...checkpoint.accepted,
        outputs: checkpoint.accepted.outputs.map((encoded) =>
          encoded.replace("candidate-map-longitudinal-coefficients", "candidate-map-family-status"),
        ),
      },
    };
    const untouched = createSr04Session("sr04-checkpoint");
    const before = accepted(untouched);
    expect(untouched.restoreCheckpoint(incompatible).kind).toBe("not-restored");
    expect(accepted(untouched)).toBe(before);
  });
});
