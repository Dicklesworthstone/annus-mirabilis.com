import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DerivationChain } from "./DerivationChain.tsx";
import type { DerivationChain as DerivationChainType } from "./types.ts";

describe("am-eq-derivation-renderer-9gd7: unverifiedMarker in preview vs production", () => {
  const unverifiedChain: DerivationChainType = Object.freeze({
    id: "chain-preview-unverified",
    proofRouteId: "route-preview-unverified",
    routeKind: "discovery",
    target: "eq-test-preview",
    entryAssumptions: [],
    steps: [
      {
        id: "step-unverified-1",
        from: { kind: "symbol", termId: "A", quantityId: "area" },
        to: { kind: "symbol", termId: "B", quantityId: "area" },
        changedSubexpressionIds: ["A"],
        rule: { kind: "substitute", params: {} },
        reasonKind: "algebra",
        reasons: {
          r0: "Draft step reasoning",
          r1: "Draft step full reasoning",
          r2: "Draft step detailed step reasoning",
        },
        premiseRefs: [],
        isMove: false,
        verification: { status: "authored-unverified", reviewRecordId: "rev-pending" },
      },
    ],
  } as const);

  test("authored-unverified step displays visible marker in preview build (isProduction = false)", () => {
    const html = renderToStaticMarkup(
      <DerivationChain chains={[unverifiedChain]} isProduction={false} />,
    );

    expect(html).toContain('data-unverified="true"');
    expect(html).toContain("Step not yet verified");
  });

  test("authored-unverified step marker is suppressed in published build (isProduction = true)", () => {
    const html = renderToStaticMarkup(
      <DerivationChain chains={[unverifiedChain]} isProduction={true} />,
    );

    expect(html).not.toContain('data-unverified="true"');
    expect(html).not.toContain("Step not yet verified");
  });
});
