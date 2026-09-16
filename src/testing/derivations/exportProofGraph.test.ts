import assert from "node:assert/strict";
import test from "node:test";
import {
  exportProofGraph,
  exportProofGraphs,
} from "../../equations/derivations/exportProofGraph.ts";
import {
  adversarialCyclicRoute,
  adversarialHistoricalCitingModernOracle,
  fixtureBrownianPedagogicalReconstruction,
  fixtureBrownianSourceOrder,
} from "../../equations/derivations/fixtures.ts";
import type { DerivationChain } from "../../equations/derivations/types.ts";

test("exportProofGraph: acyclic fixture graphs export with isAcyclic: true", () => {
  const exportPed = exportProofGraph(fixtureBrownianPedagogicalReconstruction);
  assert.equal(exportPed.routes[0]?.isAcyclic, true);
  assert.equal(exportPed.routes[0]?.edgeTypeViolations.length, 0);

  const exportSrc = exportProofGraph(fixtureBrownianSourceOrder);
  assert.equal(exportSrc.routes[0]?.isAcyclic, true);
  assert.equal(exportSrc.routes[0]?.edgeTypeViolations.length, 0);
});

test("exportProofGraph: cycle detection flags premise cycle and reconstructs cycle path", () => {
  const exportCycle = exportProofGraph(adversarialCyclicRoute);
  const route = exportCycle.routes[0];
  assert.ok(route);
  assert.equal(route.isAcyclic, false);
  assert.ok(route.cyclePath && route.cyclePath.length >= 3);
  assert.equal(
    route.cyclePath[0],
    route.cyclePath[route.cyclePath.length - 1],
    "cycle path must close",
  );
});

test("exportProofGraph: cross-reference cycles are permitted and do not cause cycle detection failures", () => {
  const chainWithCrossRefCycle: DerivationChain = {
    ...fixtureBrownianPedagogicalReconstruction,
    steps: fixtureBrownianPedagogicalReconstruction.steps.map((step, idx) => {
      if (idx === 0) {
        return {
          ...step,
          premiseRefs: [
            // Mutual cross-reference with step 2
            { ref: "bm-ped-step-2", edgeType: "cross-reference" },
          ],
        };
      }
      if (idx === 1) {
        return {
          ...step,
          premiseRefs: [
            // Mutual cross-reference with step 1
            { ref: "bm-ped-step-1", edgeType: "cross-reference" },
          ],
        };
      }
      return step;
    }),
  };

  const exportGraph = exportProofGraph(chainWithCrossRefCycle);
  assert.equal(
    exportGraph.routes[0]?.isAcyclic,
    true,
    "cross-reference cycles must be ignored during cycle detection",
  );
});

test("exportProofGraph: historical route citing modern verification oracle reports edge-type violation", () => {
  const exportOracle = exportProofGraph(adversarialHistoricalCitingModernOracle);
  const route = exportOracle.routes[0];
  assert.ok(route);
  assert.ok(route.edgeTypeViolations.length > 0);
  assert.match(route.edgeTypeViolations[0] ?? "", /modern-verification-oracle/);
});

test("exportProofGraphs: multiple routes to the same target are grouped and exported together", () => {
  // Both fixtureBrownianPedagogicalReconstruction and fixtureBrownianSourceOrder target "eq-bm-04-variance"
  const exports = exportProofGraphs([
    fixtureBrownianPedagogicalReconstruction,
    fixtureBrownianSourceOrder,
  ]);

  const targetEntry = exports.find((e) => e.target === "eq-bm-04-variance");
  assert.ok(targetEntry);
  assert.equal(
    targetEntry.routes.length,
    2,
    "both routes must be exported under target eq-bm-04-variance",
  );
  assert.equal(targetEntry.routes[0]?.routeKind, "pedagogical-reconstruction");
  assert.equal(targetEntry.routes[1]?.routeKind, "source-order");
});
