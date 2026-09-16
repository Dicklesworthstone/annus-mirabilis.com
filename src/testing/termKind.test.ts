/**
 * am-read-return-stack-oxa. `term`: the deep-link-only kind.
 *
 * SCOPE NOTE. The bead's own Test Plan describes this file as covering "the deep link sets the
 * selection attribute and expands the card's static explanation." That side effect belongs to
 * am-eq-colorized-component-1z8, which "publishes" the selection attribute this bead is meant to
 * set -- and that module does not exist anywhere in this repository yet (grepped for
 * "argument-context", "data-argument-context", "selection attribute", and any Colorized/Equation
 * Card component; no hits). Inventing an attribute name for a not-yet-landed component's contract
 * would be a guess dressed as an integration, not a verified one. This file tests everything this
 * bead genuinely owns about `term` -- its parser, its static href, and the "no descent" contract
 * -- and states this gap plainly rather than fabricating a passing assertion against code that
 * does not exist.
 */
import { describe, expect, test } from "bun:test";
import { openClarification } from "../reader/stack/history.ts";
import { getClarificationKind } from "../reader/stack/kinds.ts";
import { EMPTY_STACK_STATE } from "../reader/stack/stackStore.ts";

const returnTo = {
  anchor: "brownian-4",
  face: "reading",
  detail: 1,
  perspective: null,
  notation: null,
  unitLayer: null,
  selectionId: null,
  formId: null,
  triggerId: "term-trigger",
  scrollFraction: 0.2,
  lab: null,
};

describe("term: parser and display", () => {
  const def = getClarificationKind("term")!;

  test("a bare qualified term id parses with no route slug", () => {
    expect(def.parseId("rmsDisplacement1d")).toEqual({
      routeSlug: null,
      termId: "rmsDisplacement1d",
    });
  });

  test("a route-slug-qualified term id parses both halves (cross-paper pages)", () => {
    expect(def.parseId("mass-energy/speedOfLightSquared")).toEqual({
      routeSlug: "mass-energy",
      termId: "speedOfLightSquared",
    });
  });

  test("staticHref anchors to the bare term id, or the slug-joined anchor when qualified", () => {
    expect(def.staticHref({ routeSlug: null, termId: "rmsDisplacement1d" })).toBe(
      "#rmsDisplacement1d",
    );
    expect(def.staticHref({ routeSlug: "mass-energy", termId: "speedOfLightSquared" })).toBe(
      "#mass-energy-speedOfLightSquared",
    );
  });

  test("title is the term id (a placeholder; the real display name is the equation card's own label, out of this bead's scope)", () => {
    expect(def.title({ routeSlug: null, termId: "rmsDisplacement1d" })).toBe("rmsDisplacement1d");
  });
});

describe("term: no descent, ever", () => {
  test("descends is false", () => {
    expect(getClarificationKind("term")?.descends).toBe(false);
  });

  test("openClarification reports inline for term and pushes no frame, for a deep link or an ordinary open alike", () => {
    const outcome = openClarification(EMPTY_STACK_STATE, {
      kind: "term",
      id: "rmsDisplacement1d",
      question: "irrelevant: term never shows a compass question",
      returnTo,
    });
    expect(outcome.status).toBe("inline");
    if (outcome.status !== "inline") throw new Error("expected inline");
    expect(outcome.parsedId).toEqual({ routeSlug: null, termId: "rmsDisplacement1d" });
    // No frame exists to inspect: the stack is untouched.
  });

  test("term has no render: it is never mounted as a subtree, deep-linked or not", () => {
    expect(getClarificationKind("term")?.render).toBeUndefined();
  });
});
