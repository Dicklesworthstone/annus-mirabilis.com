import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DerivationChain } from "./DerivationChain.tsx";
import { fixtureBrownianPedagogicalReconstruction } from "./fixtures.ts";
import type { DerivationChain as DerivationChainType } from "./types.ts";
import { validateStepStructure } from "./types.ts";

describe("am-eq-derivation-renderer-9gd7: toolLink rendering and validation", () => {
  test("step with foundation tool renders working foundation link", () => {
    const html = renderToStaticMarkup(
      <DerivationChain chains={[fixtureBrownianPedagogicalReconstruction]} />,
    );

    // Step 1 carries tool: "foundation:random-walks"
    expect(html).toContain('data-tool-id="foundation:random-walks"');
    expect(html).toContain('href="/foundations/random-walks/"');
    expect(html).toContain("Foundation: random-walks →");
  });

  test("step without tool renders no tool link and throws no error", () => {
    const noToolChain: DerivationChainType = Object.freeze({
      id: "chain-no-tool",
      proofRouteId: "route-no-tool",
      routeKind: "discovery",
      target: "eq-test",
      entryAssumptions: [],
      steps: [
        {
          id: "step-notool-1",
          from: { kind: "symbol", termId: "X", quantityId: "x" },
          to: { kind: "symbol", termId: "Y", quantityId: "y" },
          changedSubexpressionIds: ["X"],
          rule: { kind: "substitute", params: {} },
          reasonKind: "algebra",
          reasons: { r0: "R0 reason", r1: "R1 reason", r2: "R2 reason" },
          premiseRefs: [],
          isMove: false,
          verification: { status: "verified" },
        },
      ],
    } as const);

    const html = renderToStaticMarkup(<DerivationChain chains={[noToolChain]} />);
    expect(html).not.toContain("data-tool-id");
    expect(html).not.toContain("step-tool-link");
  });

  test("malformed tool ID is rejected by step schema validation", () => {
    const badStep: any = {
      id: "bad-step",
      from: { kind: "symbol", termId: "A", quantityId: "a" },
      to: { kind: "symbol", termId: "B", quantityId: "b" },
      changedSubexpressionIds: ["A"],
      rule: { kind: "substitute", params: {} },
      reasonKind: "algebra",
      reasons: { r0: "r0", r1: "r1", r2: "r2" },
      tool: "invalid-tool-format-without-foundation-prefix",
      premiseRefs: [],
      isMove: false,
      verification: { status: "verified" },
    };

    expect(() => {
      validateStepStructure(badStep, "step");
    }).toThrow(/malformed tool id/);
  });
});
