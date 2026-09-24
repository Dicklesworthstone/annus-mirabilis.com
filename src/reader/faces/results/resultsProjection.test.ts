import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  fixtureBrownianPedagogicalReconstruction,
  fixtureBrownianSourceOrder,
} from "../../../equations/derivations/fixtures.ts";
import type { DerivationChain } from "../../../equations/derivations/types.ts";
import {
  projectPrintedCheck,
  projectSupport,
  ResultsProjectionError,
} from "./resultsProjection.ts";

describe("resultsProjection refusal coverage (am-muyh)", () => {
  describe("support-route-not-in-target-set (resultsProjection.ts:76)", () => {
    test("reject: throws support-route-not-in-target-set when chain route is absent from allRoutesForTarget", () => {
      const chain = fixtureBrownianSourceOrder;
      const mismatchedRoutes = [fixtureBrownianPedagogicalReconstruction];

      assert.throws(
        () => {
          projectSupport(chain, mismatchedRoutes);
        },
        (err: unknown) => {
          assert.ok(err instanceof ResultsProjectionError);
          assert.equal(err.rule, "support-route-not-in-target-set");
          return true;
        },
      );
    });

    test("accept: succeeds when chain route is present in allRoutesForTarget", () => {
      const chain = fixtureBrownianSourceOrder;
      const allRoutes = [fixtureBrownianSourceOrder, fixtureBrownianPedagogicalReconstruction];

      const result = projectSupport(chain, allRoutes);
      assert.equal(result.proofRouteId, chain.proofRouteId);
      assert.equal(result.routeKind, "source-order");
    });
  });

  describe("support-no-source-order-route (resultsProjection.ts:94)", () => {
    test("reject: throws support-no-source-order-route when route set lacks a source-order route", () => {
      const pedagogicalOnly: DerivationChain = {
        ...fixtureBrownianPedagogicalReconstruction,
        target: "eq-test-target",
      };
      const discoveryChain: DerivationChain = {
        ...fixtureBrownianPedagogicalReconstruction,
        id: "chain-discovery-test",
        proofRouteId: "route-discovery-test",
        routeKind: "discovery",
        target: "eq-test-target",
      };

      assert.throws(
        () => {
          projectSupport(discoveryChain, [discoveryChain, pedagogicalOnly]);
        },
        (err: unknown) => {
          assert.ok(err instanceof ResultsProjectionError);
          assert.equal(err.rule, "support-no-source-order-route");
          return true;
        },
      );
    });

    test("accept: succeeds when route set contains a source-order route", () => {
      const allRoutes = [fixtureBrownianSourceOrder, fixtureBrownianPedagogicalReconstruction];
      const result = projectSupport(fixtureBrownianPedagogicalReconstruction, allRoutes);
      assert.equal(result.routeKind, "source-order");
      assert.equal(result.proofRouteId, fixtureBrownianSourceOrder.proofRouteId);
    });
  });

  describe("support-selected-route-cyclic (resultsProjection.ts:111)", () => {
    test("reject: throws support-selected-route-cyclic when selected route contains a cycle", () => {
      const step1 = fixtureBrownianSourceOrder.steps[0];
      const step2 = fixtureBrownianSourceOrder.steps[1];
      assert.ok(step1 && step2, "Fixture must provide at least two steps");

      // Create a cycle: step1 -> step2 (sequential flow), plus step1 depends on step2 as premise
      const cyclicStep1 = {
        ...step1,
        premiseRefs: [
          ...step1.premiseRefs,
          { ref: step2.id, edgeType: "historical-derivation" as const },
        ],
      };

      const cyclicChain: DerivationChain = {
        ...fixtureBrownianSourceOrder,
        steps: [cyclicStep1, step2],
      };

      assert.throws(
        () => {
          projectSupport(cyclicChain, [cyclicChain]);
        },
        (err: unknown) => {
          assert.ok(err instanceof ResultsProjectionError);
          assert.equal(err.rule, "support-selected-route-cyclic");
          return true;
        },
      );
    });

    test("accept: succeeds when selected route is acyclic", () => {
      const allRoutes = [fixtureBrownianSourceOrder];
      const result = projectSupport(fixtureBrownianSourceOrder, allRoutes);
      assert.equal(result.routeKind, "source-order");
    });
  });

  describe("printed-check-nonfinite-reproduction (resultsProjection.ts:194)", () => {
    test("reject: throws printed-check-nonfinite-reproduction for NaN or Infinity", () => {
      assert.throws(
        () => {
          projectPrintedCheck({
            printedValue: "0,8 Mikron",
            statedInputs: {},
            constantSetId: "modern-si-2019",
            scenarioId: "test-nan",
            reproducedValue: Number.NaN,
            tolerance: 0.05,
            comparisonKind: "tolerance",
            label: "test",
            transcriptionPending: false,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ResultsProjectionError);
          assert.equal(err.rule, "printed-check-nonfinite-reproduction");
          return true;
        },
      );

      assert.throws(
        () => {
          projectPrintedCheck({
            printedValue: "0,8 Mikron",
            statedInputs: {},
            constantSetId: "modern-si-2019",
            scenarioId: "test-infinity",
            reproducedValue: Number.POSITIVE_INFINITY,
            tolerance: 0.05,
            comparisonKind: "tolerance",
            label: "test",
            transcriptionPending: false,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ResultsProjectionError);
          assert.equal(err.rule, "printed-check-nonfinite-reproduction");
          return true;
        },
      );
    });

    test("accept: succeeds for valid finite reproduced value", () => {
      const check = projectPrintedCheck({
        printedValue: "0,8 Mikron",
        statedInputs: { T: "293.15 K" },
        constantSetId: "modern-si-2019",
        scenarioId: "test-valid",
        reproducedValue: 0.8e-6,
        tolerance: 0.05,
        comparisonKind: "tolerance",
        label: "modern comparison",
        transcriptionPending: false,
      });
      assert.equal(check.reproducedValue, 0.8e-6);
      assert.equal(check.label, "modern comparison");
    });
  });

  describe("support-graph-export-mismatch (resultsProjection.ts:105)", () => {
    test("reject: (resultsProjection.ts:105) throws support-graph-export-mismatch if exportProofGraph does not contain selected route", () => {
      let call = 0;
      const chain: DerivationChain = {
        ...fixtureBrownianSourceOrder,
        get proofRouteId() {
          return call++ === 13 ? "route-different" : "route-initial";
        },
      };

      assert.throws(
        () => {
          projectSupport(chain, [chain]);
        },
        (err: unknown) => {
          assert.ok(err instanceof ResultsProjectionError);
          assert.equal(err.rule, "support-graph-export-mismatch");
          assert.match(err.message, /exportProofGraph did not return the selected route/);
          return true;
        },
      );
    });

    test("accept: projectSupport succeeds when exported graph matches selected route", () => {
      const result = projectSupport(fixtureBrownianSourceOrder, [fixtureBrownianSourceOrder]);
      assert.equal(result.proofRouteId, fixtureBrownianSourceOrder.proofRouteId);
    });
  });
});
