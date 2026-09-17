import { describe, expect, test } from "bun:test";
import {
  fixtureBrownianPedagogicalReconstruction,
  fixtureBrownianSourceOrder,
  fixturePaper1WienEntropy,
} from "./fixtures.ts";
import { filterRoutesForPerspective, getRouteLabel, selectRoute } from "./routeChooser.ts";
import type { DerivationChain } from "./types.ts";

describe("am-eq-derivation-renderer-9gd7: routeChooser", () => {
  const modernChain: DerivationChain = Object.freeze({
    id: "chain-modern-check",
    proofRouteId: "route-modern-check",
    routeKind: "modern-verification",
    target: "eq-test",
    entryAssumptions: [],
    steps: [
      {
        id: "step-mod-1",
        from: { kind: "symbol" as const, termId: "E", quantityId: "energy" },
        to: { kind: "symbol" as const, termId: "mc2", quantityId: "energy" },
        changedSubexpressionIds: ["E"],
        rule: { kind: "registered-identity" as const, params: {} },
        reasonKind: "identity" as const,
        reasons: { r0: "E=mc2", r1: "E=mc2 full", r2: "E=mc2 step" },
        premiseRefs: [{ ref: "oracle-modern", edgeType: "modern-verification-oracle" as const }],
        isMove: false,
        verification: { status: "verified" as const },
      },
    ],
  });

  test("front-door (source-order) and side-door ordering is stable", () => {
    const mixed = [
      fixtureBrownianPedagogicalReconstruction, // pedagogical-reconstruction (rank 2)
      fixtureBrownianSourceOrder, // source-order (rank 0)
    ];

    const sorted = filterRoutesForPerspective(mixed, "historical");
    expect(sorted[0]?.routeKind).toBe("source-order");
    expect(sorted[1]?.routeKind).toBe("pedagogical-reconstruction");
  });

  test("modern-verification chain is filtered out under historical/paper perspective", () => {
    const all = [fixtureBrownianSourceOrder, modernChain];

    const historicalRoutes = filterRoutesForPerspective(all, "historical");
    expect(historicalRoutes.some((c) => c.routeKind === "modern-verification")).toBe(false);
    expect(historicalRoutes).toHaveLength(1);
    expect(historicalRoutes[0]?.id).toBe(fixtureBrownianSourceOrder.id);
  });

  test("modern-verification chain is included and labeled under modern perspective", () => {
    const all = [fixtureBrownianSourceOrder, modernChain];

    const modernRoutes = filterRoutesForPerspective(all, "modern");
    expect(modernRoutes.some((c) => c.routeKind === "modern-verification")).toBe(true);
    expect(modernRoutes).toHaveLength(2);

    const label = getRouteLabel("modern-verification", "modern");
    expect(label).toContain("Modern Verification Oracle");
  });

  test("unknown route ID fails explicitly rather than falling back", () => {
    const chains = [fixtureBrownianSourceOrder];

    expect(() => {
      selectRoute(chains, "non-existent-route-id", "historical");
    }).toThrow(/Unknown route id "non-existent-route-id"/);
  });

  test("requesting modern route under historical perspective fails explicitly", () => {
    const chains = [fixtureBrownianSourceOrder, modernChain];

    expect(() => {
      selectRoute(chains, modernChain.id, "historical");
    }).toThrow(/Unknown route id/);
  });

  test("requesting modern route under modern perspective succeeds", () => {
    const chains = [fixtureBrownianSourceOrder, modernChain];
    const selected = selectRoute(chains, modernChain.id, "modern");
    expect(selected.id).toBe(modernChain.id);
  });
});
