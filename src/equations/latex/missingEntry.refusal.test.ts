/**
 * Does the renderer refuse loudly when a symbol has no concordance entry, or does it fall
 * back to a printed glyph and say nothing? (am-eq-latex-generation-hc3, criterion 9.)
 *
 * The question has more than one answer, because strictness is conditional:
 *
 *   const strict = options.strictConcordance ?? (Boolean(paper) || perspective === "modern");
 *
 * and the last guard in resolveSymbolGlyph is `if (!registryEntry && strict)`. A symbol that
 * HAS a registry entry therefore never reaches that throw; it returns the registry's glyph.
 * Whether that is loud or silent depends on which earlier branch the call took, so each case
 * is pinned here rather than argued about. Every assertion below states the observed
 * behaviour, and the ones that are silent say so in the test name instead of being omitted.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import type { Expression } from "../ast.ts";
import type { Quantity, QuantityRegistry } from "../quantities.ts";
import { renderLatex } from "./render.ts";
import { NotationScopeError } from "./types.ts";

/** A quantity no concordance binds, so the lookup must miss. */
const UNBOUND_ID = "quantityNoConcordanceBinds";

const registryWithUnbound: QuantityRegistry = Object.freeze({
  [UNBOUND_ID]: Object.freeze({
    id: UNBOUND_ID,
    name: "Unbound quantity",
    glyph: "\\heartsuit",
    dimension: Object.freeze(["0", "0", "0", "0", "0", "0"]),
    unit: "1",
    displayUnit: "1",
    displayPower: 0,
    semanticKind: "variable",
    role: "input",
    definition: "",
  }) as Quantity,
}) as QuantityRegistry;

const unboundSymbol: Expression = {
  kind: "symbol",
  termId: "eq-bm-s3-d4.t.unbound",
  quantityId: UNBOUND_ID,
};

test("refusal: a symbol with no concordance entry in a scoped paper REFUSES LOUDLY, naming equation and symbol", () => {
  // The load-bearing case: the paper and its concordance are both present, the symbol is
  // not in them, and the modern face must not invent a reading.
  let thrown: unknown;
  try {
    renderLatex(unboundSymbol, {
      perspective: "modern",
      paper: "brownian-motion",
      sectionId: "bm-s3",
      concordance: loadConcordanceForPaper("brownian-motion"),
      registry: registryWithUnbound,
      equationId: "eq-bm-s3-d4",
    });
  } catch (err: unknown) {
    thrown = err;
  }

  assert.ok(thrown instanceof NotationScopeError, `expected NotationScopeError, got ${thrown}`);
  assert.equal(thrown.kind, "missing-entry");
  assert.match(thrown.message, /eq-bm-s3-d4/, "the refusal must name the equation");
  assert.match(thrown.message, /unbound/, "the refusal must name the symbol");
  assert.match(thrown.message, /bm-s3/, "the refusal must name the scope it looked in");
});

test("refusal: the same miss on the SOURCE face also refuses, so the printed face cannot invent a glyph either", () => {
  assert.throws(
    () =>
      renderLatex(unboundSymbol, {
        perspective: "source",
        paper: "brownian-motion",
        sectionId: "bm-s3",
        concordance: loadConcordanceForPaper("brownian-motion"),
        registry: registryWithUnbound,
        equationId: "eq-bm-s3-d4",
      }),
    (err: unknown) => {
      assert.ok(err instanceof NotationScopeError);
      assert.equal(err.kind, "missing-entry");
      return true;
    },
  );
});

test("refusal: a bound symbol on the same call path still renders, so the rule is not a wall", () => {
  const bound: Expression = {
    kind: "symbol",
    termId: "eq-bm-s3-d4.t.k",
    quantityId: "viscosity",
  };
  const rendered = renderLatex(bound, {
    perspective: "modern",
    paper: "brownian-motion",
    sectionId: "bm-s3",
    concordance: loadConcordanceForPaper("brownian-motion"),
    registry: registryWithUnbound,
    equationId: "eq-bm-s3-d4",
  });
  assert.equal(rendered.trim(), "\\eta", `viscosity must modernize to \\eta, got ${rendered}`);
});

test("refusal: naming a paper whose concordance cannot be resolved refuses with unknown-paper", () => {
  // Under DEFAULT strictness. strict = strictConcordance ?? (Boolean(paper) || modern), so
  // naming a paper is enough. An earlier draft of this test passed strictConcordance: false
  // and then reported the resulting fallback as a silent-fallback defect; that was the
  // override talking, not the renderer. The default refuses.
  assert.throws(
    () =>
      renderLatex(unboundSymbol, {
        perspective: "modern",
        paper: "no-such-paper-on-disk",
        sectionId: "xx-s1",
        registry: registryWithUnbound,
        equationId: "eq-bm-s3-d4",
      }),
    (err: unknown) => {
      assert.ok(err instanceof NotationScopeError);
      assert.equal(err.kind, "unknown-paper");
      assert.match(err.message, /no-such-paper-on-disk/);
      return true;
    },
  );
});

test("the only silent fallback is one the caller asks for: strictConcordance: false", () => {
  // Pinned so the opt-out stays visible. A caller that passes this is choosing to render a
  // detached subtree without a concordance; nothing in the reader path does.
  const rendered = renderLatex(unboundSymbol, {
    perspective: "modern",
    paper: "no-such-paper-on-disk",
    sectionId: "xx-s1",
    registry: registryWithUnbound,
    equationId: "eq-bm-s3-d4",
    strictConcordance: false,
  });
  assert.equal(rendered.trim(), "\\heartsuit");
});

test("no paper at all on the source face is not strict, and emits the registry glyph", () => {
  // strict = strictConcordance ?? (Boolean(paper) || perspective === "modern"), so a bare
  // source-face render with no paper is deliberately not strict. Reasonable for rendering a
  // detached subtree; recorded so the boundary of criterion 9 is explicit rather than assumed.
  const rendered = renderLatex(unboundSymbol, {
    perspective: "source",
    registry: registryWithUnbound,
  });
  assert.equal(rendered.trim(), "\\heartsuit");
});
