import { describe, expect, it } from "bun:test";
import { openClarification } from "../reader/stack/history.ts";
import { getClarificationKind, type TermTarget } from "../reader/stack/kinds.ts";
import { EMPTY_STACK_STATE } from "../reader/stack/stackStore.ts";

describe("termKind (am-read-return-stack-oxa)", () => {
  it("term is registered with descends: false and no render component", () => {
    const def = getClarificationKind("term");
    expect(def).toBeDefined();
    expect(def?.kind).toBe("term");
    expect(def?.descends).toBe(false);
    expect(def?.render).toBeUndefined();
  });

  it("parseId accepts bare termId and route-slug-qualified termId", () => {
    const def = getClarificationKind("term");
    if (!def) throw new Error("term kind not found");

    const bare = def.parseId("meanSquareDisplacement") as TermTarget | null;
    expect(bare).toEqual({ routeSlug: null, termId: "meanSquareDisplacement" });

    const qualified = def.parseId("brownian-motion/meanSquareDisplacement") as TermTarget | null;
    expect(qualified).toEqual({ routeSlug: "brownian-motion", termId: "meanSquareDisplacement" });
  });

  it("parseId rejects malformed ids", () => {
    const def = getClarificationKind("term");
    if (!def) throw new Error("term kind not found");

    expect(def.parseId("")).toBeNull();
    expect(def.parseId("123badStart")).toBeNull();
    expect(def.parseId("a/b/c")).toBeNull();
    expect(def.parseId("route/")).toBeNull();
    expect(def.parseId("/term")).toBeNull();
  });

  it("staticHref generates correct anchor hash", () => {
    const def = getClarificationKind("term");
    if (!def) throw new Error("term kind not found");

    expect(def.staticHref({ routeSlug: null, termId: "viscosity" })).toBe("#viscosity");
    expect(def.staticHref({ routeSlug: "brownian-motion", termId: "viscosity" })).toBe(
      "#brownian-motion-viscosity",
    );
  });

  it("openClarification with term returns inline status and pushes no frame", () => {
    const returnTo = {
      anchor: "brownian-4",
      face: "reading",
      detail: 1,
      perspective: null,
      notation: null,
      unitLayer: null,
      selectionId: null,
      formId: null,
      triggerId: "trigger-term-1",
      scrollFraction: 0.3,
      lab: null,
    };

    const outcome = openClarification(EMPTY_STACK_STATE, {
      kind: "term",
      id: "brownian-motion/diffusionCoefficient",
      question: "What is diffusion coefficient?",
      returnTo,
    });

    expect(outcome.status).toBe("inline");
    if (outcome.status === "inline") {
      expect(outcome.kind).toBe("term");
      expect(outcome.parsedId).toEqual({
        routeSlug: "brownian-motion",
        termId: "diffusionCoefficient",
      });
    }
  });
});
