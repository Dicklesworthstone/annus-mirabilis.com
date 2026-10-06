/**
 * An out-of-domain node kind refuses by name, on both expression models (am-ghr8, criterion 2).
 *
 * The bead asks that "an out-of-domain node kind reaching the renderer produces a TYPED refusal
 * naming the kind and the equation, never a TypeError; a planted negative proves it". Before this
 * change it produced "undefined is not an object (evaluating 'children(root).flatMap')", which
 * names neither and reads as a defect in the traversal rather than in its input.
 *
 * THE PLANT IS PERMANENT HERE, which is better than a plant that has to be re-run. The foreign
 * node these tests feed children() is exactly the shape the two models' boundary produces, so the
 * negative is a standing fixture rather than a temporary edit to product code. The eight pinned
 * outcomes in allFixtures.goldens.json are the same negative at the renderer's own boundary: they
 * are produced by the documented cast in allFixtures.golden.test.ts, and they now record the typed
 * refusal with the equation named.
 *
 * THE COMPILE-TIME HALF CANNOT BE ASSERTED FROM INSIDE A TEST and is recorded here instead of
 * being silently absent. Adding a kind to either Expression union without a case in its children()
 * stops the default branch's argument being `never` and fails `tsc --noEmit`; planting
 * `plantedKindWithNoCase` on ast.ts's union produced, at the default branch,
 * TS2345 "Argument of type ... is not assignable to parameter of type 'never'". A passing test
 * suite says nothing about that, because neither test lane typechecks.
 */

import { describe, expect, test } from "bun:test";
import { ContentError } from "../content/compiler/json.ts";
import { children, type Expression, walk } from "./ast.ts";
import { namingEquation, UNSUPPORTED_NODE_KIND } from "./nodeKindRefusal.ts";
import type { Expression as TreeExpression } from "./tree/types.ts";
import { children as treeChildren } from "./tree/walk.ts";

/** A node of a kind neither model's children() has a case for. */
const foreign = { kind: "matrix", rows: [] } as unknown as Expression;

/** A real node of ast.ts's own model, for the non-vacuity half. */
const real: Expression = { kind: "number", value: "1" };

describe("an out-of-domain node kind refuses with a code and names the kind", () => {
  test("ast.ts's children() refuses rather than returning undefined", () => {
    expect(() => children(foreign)).toThrow(ContentError);
    try {
      children(foreign);
      throw new Error("children() did not refuse, so the rest of this test proves nothing");
    } catch (err) {
      expect(err).toBeInstanceOf(ContentError);
      const refusal = err as ContentError;
      // The code is written as a literal at the throw site so the refusal scanner can read it.
      // This is what ties that literal to the exported constant the renderer catches on.
      expect(refusal.code).toBe(UNSUPPORTED_NODE_KIND);
      expect(refusal.code).toBe("equation-node-kind-unsupported");
      expect(refusal.message).toContain('"matrix"');
      expect(refusal.message).toContain("src/equations/ast.ts");
    }
  });

  test("tree/walk.ts's children() refuses the same way, naming its own model", () => {
    // tree/types.ts HAS matrix, so the foreign kind for this model must be one it lacks.
    const alien = { kind: "partialOperator", variable: real } as unknown as TreeExpression;
    try {
      treeChildren(alien);
      throw new Error("tree children() did not refuse, so this test proves nothing");
    } catch (err) {
      expect(err).toBeInstanceOf(ContentError);
      expect((err as ContentError).code).toBe(UNSUPPORTED_NODE_KIND);
      expect((err as ContentError).message).toContain('"partialOperator"');
      expect((err as ContentError).message).toContain("src/equations/tree/walk.ts");
    }
  });

  test("a node with no kind field at all is still a refusal, not a TypeError", () => {
    // The degenerate input: JSON that reached a traversal without ever being validated.
    try {
      children({} as unknown as Expression);
      throw new Error("children() did not refuse an empty object");
    } catch (err) {
      expect(err).toBeInstanceOf(ContentError);
      expect((err as ContentError).message).toContain("with no kind field");
    }
  });

  test("NON-VACUITY: a node the model does declare is traversed, not refused", () => {
    // Without this, a children() that threw unconditionally would pass every assertion above.
    expect(children(real)).toEqual([]);
    expect(walk({ kind: "negate", argument: real })).toHaveLength(2);
    expect(
      treeChildren({ kind: "matrix", rows: [[real]] } as unknown as TreeExpression),
    ).toHaveLength(1);
  });
});

describe("the renderer adds the equation, which children() cannot know", () => {
  test("an unsupported-kind refusal gains the equation id and keeps its code", () => {
    let raised: unknown;
    try {
      walk(foreign);
    } catch (err) {
      raised = err;
    }
    expect(raised).toBeInstanceOf(ContentError);
    expect((raised as ContentError).message).not.toContain("eq-sr-boost");

    const named = namingEquation(raised, "eq-sr-boost");
    expect(named).toBeInstanceOf(ContentError);
    expect((named as ContentError).code).toBe(UNSUPPORTED_NODE_KIND);
    expect((named as ContentError).message).toContain('Equation "eq-sr-boost"');
    expect((named as ContentError).message).toContain('"matrix"');
  });

  test("any other error passes through untouched, so this is not a catch-all", () => {
    // A boundary that renamed every error it saw would hide unrelated failures behind a
    // plausible-looking refusal. Both the identity and the type are checked.
    const unrelated = new TypeError("something else entirely");
    expect(namingEquation(unrelated, "eq-sr-boost")).toBe(unrelated);

    const otherContentError = new ContentError("equation-invalid", "p", "Expected a plain record.");
    expect(namingEquation(otherContentError, "eq-sr-boost")).toBe(otherContentError);
  });
});
