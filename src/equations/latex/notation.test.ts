/**
 * The two `missing-entry` refusals in notation.ts (am-r3qt).
 *
 * `missing-entry` is a MULTI-SITE CODE: it is thrown at :172 and at :235, so naming the code
 * alone would credit both sites from either case. They are distinguishable from outside only by
 * their message, and each case below asserts its own:
 *
 *   :172  a paper and a scope are given, and the symbol has no concordance entry in that scope
 *         ("no concordance entry in scope")
 *   :235  no paper is given, so the registry is the only binding source and the symbol is not
 *         in it ("no notation binding in registry")
 *
 * Reaching :235 needs strictConcordance set explicitly, because strict otherwise derives from
 * `Boolean(paper) || perspective === "modern"` and the no-paper route leaves it false. That is
 * also why the third case exists: without it, a resolver that threw unconditionally would pass
 * both cases above, which is the negative RH-5 asks every feature to carry.
 *
 * This module had NO test importing it before this file. It is reachable from production
 * through collisions.ts:14 (resolveSymbolGlyph), so it was exercised only transitively, and a
 * transitive path cannot credit a site the way an explicit citation does.
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../ast.ts";
import { resolveSymbolGlyph } from "./notation.ts";
import type { RenderLatexOptions } from "./types.ts";
import { NotationScopeError } from "./types.ts";

const absent: Extract<Expression, { kind: "symbol" }> = {
  kind: "symbol",
  termId: "no-such-term",
  quantityId: "noSuchQuantity",
};

test('(notation.ts:172) a symbol absent from the paper scope refuses with "no concordance entry"', () => {
  assert.throws(
    () =>
      resolveSymbolGlyph(absent, {
        paper: "brownian-motion",
        sectionId: "s1",
        equationId: "eq-missing-entry-scope",
      } as RenderLatexOptions),
    (error: unknown) => {
      assert.ok(error instanceof NotationScopeError);
      assert.equal(error.kind, "missing-entry");
      assert.match(error.message, /no concordance entry in scope "s1" for paper "brownian-motion"/);
      // NOT the registry message: that one belongs to :235 and would mean the wrong site fired.
      assert.doesNotMatch(error.message, /no notation binding in registry/);
      return true;
    },
  );
});

test('(notation.ts:235) with no paper, an unbound symbol refuses with "no notation binding"', () => {
  assert.throws(
    () =>
      resolveSymbolGlyph(absent, {
        strictConcordance: true,
        equationId: "eq-missing-entry-registry",
      } as RenderLatexOptions),
    (error: unknown) => {
      assert.ok(error instanceof NotationScopeError);
      assert.equal(error.kind, "missing-entry");
      assert.match(error.message, /no notation binding in registry/);
      // NOT the scope message: that one belongs to :172.
      assert.doesNotMatch(error.message, /no concordance entry in scope/);
      return true;
    },
  );
});

test("the same unbound symbol resolves without refusing when strictness is off", () => {
  const resolved = resolveSymbolGlyph(absent, {
    strictConcordance: false,
    equationId: "eq-missing-entry-control",
  } as RenderLatexOptions);
  // The fallback glyph is the termId, so the two refusals above are about strictness and not
  // about the symbol being unresolvable in principle.
  assert.equal(resolved.glyph, "no-such-term");
  assert.equal(resolved.role, "input");
});
