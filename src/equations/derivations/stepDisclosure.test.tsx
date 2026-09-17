import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DerivationChain } from "./DerivationChain.tsx";
import type { DerivationChain as DerivationChainType } from "./types.ts";

describe("am-eq-derivation-renderer-9gd7: stepDisclosure computational slot", () => {
  const computationalChain: DerivationChainType = Object.freeze({
    id: "chain-numerical-eval",
    proofRouteId: "route-numerical-eval",
    routeKind: "discovery",
    target: "eq-num-eval",
    entryAssumptions: [],
    steps: [
      {
        id: "step-eval-1",
        from: {
          kind: "product",
          args: [
            { kind: "number", value: "2" },
            { kind: "number", value: "3" },
          ],
        },
        to: { kind: "number", value: "6" },
        changedSubexpressionIds: ["eval"],
        rule: { kind: "evaluate-numerical-instance", params: {} },
        reasonKind: "algebra",
        reasons: {
          r0: "Evaluate 2 times 3.",
          r1: "Multiply the numeric constants 2 and 3 to obtain 6.",
          r2: "Arithmetic evaluation of multiplication yielding 6.",
        },
        premiseRefs: [],
        isMove: false,
        verification: { status: "verified" },
      },
    ],
  } as const);

  const symbolicChain: DerivationChainType = Object.freeze({
    id: "chain-symbolic-only",
    proofRouteId: "route-symbolic-only",
    routeKind: "source-order",
    target: "eq-sym-only",
    entryAssumptions: [],
    steps: [
      {
        id: "step-sym-1",
        from: { kind: "symbol", termId: "A", quantityId: "a" },
        to: { kind: "symbol", termId: "B", quantityId: "b" },
        changedSubexpressionIds: ["A"],
        rule: { kind: "substitute", params: {} },
        reasonKind: "algebra",
        reasons: { r0: "r0", r1: "r1", r2: "r2" },
        premiseRefs: [],
        isMove: false,
        verification: { status: "verified" },
      },
    ],
  } as const);

  test("step with computational rule mounts 3-tab disclosure slot with In words, Mathematics, and Implementation", () => {
    const html = renderToStaticMarkup(
      <DerivationChain chains={[computationalChain]} activeDetail="1" />,
    );

    expect(html).toContain('data-computation-disclosure="true"');
    expect(html).toContain("In words");
    expect(html).toContain("Mathematics");
    expect(html).toContain("Implementation");
    expect(html).toContain("Multiply the numeric constants 2 and 3 to obtain 6.");
  });

  test("step without computational rule renders no disclosure slot and no error", () => {
    const html = renderToStaticMarkup(<DerivationChain chains={[symbolicChain]} />);

    expect(html).not.toContain('data-computation-disclosure="true"');
    expect(html).not.toContain("disclosure-tabs");
  });
});
