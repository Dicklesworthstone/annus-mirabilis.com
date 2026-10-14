import { describe, expect, test } from "bun:test";
import {
  fixtureBrownianPedagogicalReconstruction,
  fixtureBrownianSourceOrder,
} from "../equations/derivations/fixtures.ts";
import {
  projectSupport,
  ResultsProjectionError,
} from "../reader/faces/results/resultsProjection.ts";

/**
 * am-read-results-face-uzh: "the projected support matches exportProofGraph for the fixture
 * chain: same entryAssumptions[] ids in the same order, same edge types; a target with two
 * routes projects the source-order route as selected and lists the other by title and
 * routeKind; empiricalInputs[] is empty for the paper 4 fixture chain and contains the dataset
 * id for a seeded chain that cites one."
 *
 * Uses the real Brownian fixture chains (fixtureBrownianSourceOrder / -PedagogicalReconstruction)
 * from src/equations/derivations/fixtures.ts, which share one target (eq-bm-04-variance) -- this
 * is exactly the "target with two routes" case, not a synthetic stand-in.
 */
describe("resultsProjection.support: real derivation-chain graph, Brownian fixture", () => {
  const bothRoutes = [fixtureBrownianSourceOrder, fixtureBrownianPedagogicalReconstruction];

  test("selects the source-order route and lists the pedagogical reconstruction as an alternative", () => {
    const support = projectSupport(fixtureBrownianSourceOrder, bothRoutes);
    expect(support.routeKind).toBe("source-order");
    expect(support.proofRouteId).toBe(fixtureBrownianSourceOrder.proofRouteId);
    expect(support.alternativeRoutes).toHaveLength(1);
    expect(support.alternativeRoutes[0]?.routeKind).toBe("pedagogical-reconstruction");
    expect(support.alternativeRoutes[0]?.title).toBe("Pedagogical Reconstruction");
  });

  test("also selects source-order when called with the pedagogical route as the primary argument", () => {
    const support = projectSupport(fixtureBrownianPedagogicalReconstruction, bothRoutes);
    expect(support.proofRouteId).toBe(fixtureBrownianSourceOrder.proofRouteId);
    expect(support.alternativeRoutes[0]?.routeKind).toBe("pedagogical-reconstruction");
  });

  test("entryAssumptions carry the same premise ids, in the same order, with readable edge-type words", () => {
    const support = projectSupport(fixtureBrownianSourceOrder, bothRoutes);
    expect(support.entryAssumptions.map((a) => a.premiseId)).toEqual(
      fixtureBrownianSourceOrder.entryAssumptions.map((p) => p.ref),
    );
    for (const a of support.entryAssumptions) {
      expect(a.edgeType).toBe("a premise the paper builds on");
    }
  });

  test("empiricalInputs default to empty, with the honest sentence available to the renderer", () => {
    const support = projectSupport(fixtureBrownianSourceOrder, bothRoutes);
    expect(support.empiricalInputs).toEqual([]);
  });

  test("a caller that resolves a dataset citation gets it back verbatim in empiricalInputs", () => {
    const support = projectSupport(fixtureBrownianSourceOrder, bothRoutes, [
      { kind: "dataset", id: "perrin-1909-sedimentation", citation: "Perrin (1909)" },
    ]);
    expect(support.empiricalInputs).toEqual([
      { kind: "dataset", id: "perrin-1909-sedimentation", citation: "Perrin (1909)" },
    ]);
  });

  test("verificationState surfaces the route's first authored-unverified step (not just the last), matching the real verifyChain() gate verdict", () => {
    // Both Brownian source-order steps 1-2 are authored-unverified with review records
    // (rr-bm-04-taylor-time, rr-bm-04-taylor-space); a naive "check only the last step" reading
    // would wrongly report this route as fully verified. isPublicationReady is taken directly
    // from verifyChain(), never re-derived, so it can never drift from that bead's own rule.
    const support = projectSupport(fixtureBrownianSourceOrder, bothRoutes);
    expect(support.verificationState).toEqual({
      status: "authored-unverified",
      reviewRecordId: "rr-bm-04-taylor-time",
    });
    expect(support.isPublicationReady).toBe(true);
  });

  test("a chain step marked authored-unverified WITHOUT a reviewRecordId fails the real publication gate", () => {
    const unreviewedStep = {
      ...fixtureBrownianSourceOrder,
      steps: fixtureBrownianSourceOrder.steps.map((s, i) =>
        i === 0 ? { ...s, verification: { status: "authored-unverified" as const } } : s,
      ),
    };
    const support = projectSupport(unreviewedStep, [
      unreviewedStep,
      fixtureBrownianPedagogicalReconstruction,
    ]);
    expect(support.verificationState.status).toBe("authored-unverified");
    expect(support.isPublicationReady).toBe(false);
  });

  test("a chain whose route is absent from allRoutesForTarget is rejected", () => {
    expect(() =>
      projectSupport(fixtureBrownianSourceOrder, [fixtureBrownianPedagogicalReconstruction]),
    ).toThrow(ResultsProjectionError);
  });

  test("a mismatched-target route set is rejected by name", () => {
    let caught: unknown;
    try {
      projectSupport(fixtureBrownianSourceOrder, [
        fixtureBrownianSourceOrder,
        { ...fixtureBrownianPedagogicalReconstruction, target: "eq-something-else" },
      ]);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ResultsProjectionError);
    expect((caught as InstanceType<typeof ResultsProjectionError>).rule).toBe(
      "support-mismatched-target",
    );
  });

  test("a route with a FAILED step is refused, not projected as unverified (am-s1xa)", () => {
    // VerificationState has two members, so a failed step used to arrive as one of them. The
    // plant is the one parity.suite.ts uses, a step's `to` replaced by its `from`, applied to
    // bm-src-step-5 because it is the LAST machine-checked step of this chain: corrupting
    // step 1 or 2 changes nothing (they are authored-unverified, so there is no check to
    // fail), and corrupting step 3 or 4 changes nothing either, which is am-1lds.
    const steps = fixtureBrownianSourceOrder.steps.map((step, index) =>
      index === fixtureBrownianSourceOrder.steps.length - 1 ? { ...step, to: step.from } : step,
    );
    const corrupted = { ...fixtureBrownianSourceOrder, steps };
    const planted = corrupted.steps[corrupted.steps.length - 1];
    expect(planted?.id).toBe("bm-src-step-5");

    let caught: unknown;
    try {
      projectSupport(corrupted, [corrupted, fixtureBrownianPedagogicalReconstruction]);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ResultsProjectionError);
    const error = caught as InstanceType<typeof ResultsProjectionError>;
    expect(error.rule).toBe("support-selected-route-step-failed");
    expect(error.message).toContain("bm-src-step-5");

    // The control, and the reason the plant is evidence: as authored, the same chain projects.
    const support = projectSupport(fixtureBrownianSourceOrder, [
      fixtureBrownianSourceOrder,
      fixtureBrownianPedagogicalReconstruction,
    ]);
    expect(support.verificationState.status).toBe("authored-unverified");
  });
});
