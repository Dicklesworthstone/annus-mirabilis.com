import { describe, expect, test } from "bun:test";
import { checkDimensions } from "../../content/dimensions/check.ts";
import { getQuantityRegistry } from "../../content/quantities/registry.ts";
import { loadBilingualEdition } from "../../reader/faces/bilingualLoader.ts";
import { walk } from "../ast.ts";
import { type CheckedDisplay, compilePrintedDisplay, loadDisplayTerms } from "./displayTerms.ts";
import { checkPaperDisplays, printedDisplays } from "./paperDisplays.ts";
import { parseSourceExpression, SourceExpressionError, sourceNodes } from "./sourceExpression.ts";
import {
  canonicalSourceLatex,
  compilePrintedSourceSemantics,
  markSourceOperations,
  mergeSourceOperationRendering,
  type SourceSemanticsError,
  sourceDimensionRegistry,
} from "./sourceSemantics.ts";

const ROOT = process.cwd();
const checked = await checkPaperDisplays(ROOT, "mass-energy");
if (!checked || checked.problems.length) throw new Error("The source fixture must check clean.");
const quantities = getQuantityRegistry().quantities;
const unique = [...new Map(checked.displays.map((d) => [d.display, d])).values()];
function display(id: string): CheckedDisplay {
  const value = checked?.displays.find((d) => d.display === id);
  if (!value) throw new Error("Missing source display " + id);
  return value;
}
function compile(value: CheckedDisplay) {
  const result = compilePrintedSourceSemantics(value, compilePrintedDisplay(value), quantities);
  if (!result) throw new Error("Mass-energy must have source semantics.");
  return result;
}
const mathml = (html: string) => html.slice(0, html.indexOf('<span class="katex-html"'));

function refuses(action: () => unknown, code: string): string {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  expect((caught as SourceSemanticsError | SourceExpressionError).code).toBe(code);
  return (caught as Error).message;
}

describe("the seven source displays, parsed before typography exceptions", () => {
  test("every source equation block has a fully bound semantic tree", async () => {
    const edition = await loadBilingualEdition("mass-energy", ROOT);
    expect(unique.map((d) => d.display).sort()).toEqual(
      edition?.blocks
        .filter((block) => block.kind === "equation")
        .map((b) => b.id)
        .sort(),
    );
    expect(unique).toHaveLength(7);
    for (const d of checked.displays) {
      const symbols = sourceNodes(parseSourceExpression(d)).flatMap(({ node }) =>
        node.tree.kind === "symbol" ? [[node.tree.termId, node.tree.quantityId]] : [],
      );
      expect(symbols.sort()).toEqual(d.terms.map((t) => [t.termId, t.quantityId]).sort());
    }
  });

  test("canonical re-rendering reports its actual byte yield and retains the exact source", () => {
    const file = loadDisplayTerms(ROOT, "mass-energy");
    expect(file).not.toBeNull();
    let identical = 0;
    for (const entry of file?.displays ?? []) {
      const d = display(entry.display);
      const before = JSON.stringify(d);
      const parsed = parseSourceExpression(d);
      const canonical = canonicalSourceLatex(d, parsed);
      if (canonical === d.latex) identical++;
      const built = compile(d);
      expect(d.latex).toBe(entry.latex);
      expect(JSON.stringify(d)).toBe(before);
      expect(built.semantics.roundTrip.canonicalLatex).toBe(canonical);
      expect(built.semantics.roundTrip.status).toBe("typography-exception");
      expect(built.semantics.roundTrip.reason).toContain("original source typography");
    }
    // This is the measured result, not a claim that the semantic printer reproduces typography.
    expect(identical).toBe(0);
  });

  test("the quoted angle and the emission angle retain their distinct source identities", () => {
    const bindings = (id: string) =>
      parseSourceExpression(display(id)).rows.flatMap(({ tree }) =>
        walk(tree).flatMap((node) => (node.kind === "symbol" ? [node.quantityId] : [])),
      );
    expect(bindings("eq-s0-d1")).toContain("propagationAngleStationary");
    expect(bindings("eq-s0-d1")).not.toContain("emissionAngle");
    expect(bindings("eq-s0-d3")).toContain("emissionAngle");
    expect(bindings("eq-s0-d3")).not.toContain("propagationAngleStationary");
  });

  test("the moving ledger continuation keeps H zero, while the two offset equations stay separate", () => {
    const moving = parseSourceExpression(display("eq-s0-d3"));
    expect(moving.continuationRows).toEqual([1]);
    const [first, second] = moving.rows.map((row) => row.tree);
    if (first?.kind !== "relation" || second?.kind !== "relation")
      throw new Error("Both moving-ledger lines must be equalities.");
    expect(second.left).toBe(first.left);
    expect(first.left).toMatchObject({ kind: "symbol", quantityId: "bodyEnergyMovingBefore" });
    const offset = parseSourceExpression(display("eq-s0-d5"));
    expect(offset.continuationRows).toEqual([]);
    expect(offset.rows).toHaveLength(2);
    expect(offset.rows[0]?.tree).not.toEqual(offset.rows[1]?.tree);
  });

  test("unknown mathematics is refused instead of guessed (sourceExpression.ts:99)", () => {
    const d = display("eq-s0-d7");
    expect(
      refuses(
        () => parseSourceExpression({ ...d, latex: d.latex + " \\int" }),
        "printed-expression-unsupported",
      ),
    ).toContain("Unsupported token");
    expect(() => parseSourceExpression(d)).not.toThrow();
    expect(() => parseSourceExpression({ ...d, latex: d.latex + " q" })).toThrow(
      SourceExpressionError,
    );
  });
});

describe("exact dimensions and scientific limitations", () => {
  test("all source rows have energy dimensions, with independently checked mass and dimensionless factors", () => {
    const registry = sourceDimensionRegistry(quantities);
    for (const d of unique) {
      const compiled = compile(d);
      expect(compiled.semantics.dimensionStatus).toBe("consistent");
      for (const tree of compiled.semantics.rows) {
        const result = checkDimensions(tree, registry, { context: "gaussian-cgs" });
        expect(result.status).toBe("consistent");
        if (result.status !== "consistent") throw new Error(result.reason);
        expect(result.dimension.map(({ num, den }) => [String(num), String(den)])).toEqual([
          ["2", "1"],
          ["1", "1"],
          ["-2", "1"],
          ["0", "1"],
          ["0", "1"],
          ["0", "1"],
        ]);
      }
    }
    const coefficient = compile(display("eq-s0-d7")).semantics.operations.find(
      (operation) => operation.path === "row1.right.args.0",
    );
    expect(coefficient?.dimensionExponents).toEqual(["0", "1", "0", "0", "0", "0"]);
    const denominator = compile(display("eq-s0-d1")).semantics.operations.find(
      (operation) => operation.path === "row1.right.args.1.denominator",
    );
    expect(denominator?.dimensionExponents).toEqual(["0", "0", "0", "0", "0", "0"]);
  });

  test("square roots retain rational dimension exponents without rounding", () => {
    const parsed = parseSourceExpression({
      paper: "fixture",
      display: "root",
      latex: "K = \\sqrt{V}",
      spoken: "K equals the square root of V.",
      terms: [
        { termId: "t.k", quantityId: "kineticEnergyBefore", glyph: "K", start: 0, end: 1 },
        { termId: "t.v", quantityId: "speedOfLight", glyph: "V", start: 10, end: 11 },
      ],
    });
    const tree = parsed.rows[0]?.tree;
    if (tree?.kind !== "relation") throw new Error("The fixture must be an equality.");
    const result = checkDimensions(tree.right, sourceDimensionRegistry(quantities));
    expect(result.status).toBe("consistent");
    if (result.status !== "consistent") throw new Error(result.reason);
    expect(result.dimension.map(({ num, den }) => [String(num), String(den)])).toEqual([
      ["1", "2"],
      ["0", "1"],
      ["-1", "2"],
      ["0", "1"],
      ["0", "1"],
      ["0", "1"],
    ]);
  });

  test("an inconsistent unit and an unsupported dimension stop publication (sourceSemantics.ts:343)", () => {
    const d = display("eq-s0-d7");
    const q = quantities.get("speedOfLight");
    if (!q) throw new Error("The canonical speed of light must exist.");
    const altered = new Map(quantities);
    altered.set(q.id, {
      ...q,
      dimension: [0, 0, 1, 0, 0, 0].map((num) => ({ num, den: 1 })),
    });
    expect(
      refuses(
        () => compilePrintedSourceSemantics(d, compilePrintedDisplay(d), altered),
        "printed-source-dimension",
      ),
    ).toContain("inconsistent");
    altered.set(q.id, { ...q, dimensionStatus: "state-dependent" });
    expect(() => compilePrintedSourceSemantics(d, compilePrintedDisplay(d), altered)).toThrow(
      /unsupported-check/,
    );
    expect(() => compile(d)).not.toThrow();
  });

  test("the unchanged offset and low-speed truncation are stated rather than proved by units", () => {
    const offset = compile(display("eq-s0-d5")).semantics;
    expect(offset.premise).toContain("additional physical premise");
    expect(offset.operations.find((o) => o.path === "row2.right")?.why).toContain(
      "If the offset changed",
    );
    const low = compile(display("eq-s0-d7")).semantics;
    expect(low.premise).toContain("fourth and higher powers");
    expect(low.operations.find((o) => o.path === "row1.right.args.0")?.why).toContain(
      "dimensions alone cannot",
    );
  });
});

describe("source rendering with safe operation markers", () => {
  test("all operations and terms render, with the original complete MathML and TeX annotation", () => {
    for (const d of checked.displays) {
      const original = compilePrintedDisplay(d);
      const built = compile(d);
      expect(mathml(built.html)).toBe(mathml(original.html));
      const ids = built.semantics.operations.map((o) => o.id);
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(built.html).toContain('data-op="' + id + '"');
      for (const term of d.terms)
        expect(built.html).toContain(
          'data-term="' + term.termId + '" data-quantity-id="' + term.quantityId + '"',
        );
    }
  });

  test("a punctuation variant keeps the same operation and quantity identities", () => {
    const variants = checked.displays.filter((d) => d.display === "eq-s0-d1");
    expect(variants.length).toBeGreaterThan(1);
    const [first, ...rest] = variants.map(compile);
    for (const other of rest)
      expect(other.semantics.operations.map((o) => o.id)).toEqual(
        first?.semantics.operations.map((o) => o.id),
      );
  });

  test("crossing, duplicate and injected markers cannot enter trust (sourceSemantics.ts:179)", () => {
    const mark = { start: 0, end: 4, id: "operation.one", kind: "op" as const };
    for (const marks of [
      [mark, { ...mark, start: 2, end: 6, id: "operation.two" }],
      [mark, { ...mark }],
      [{ ...mark, id: "x},class=unsafe" }],
    ])
      refuses(() => markSourceOperations("abcdef", marks), "printed-source-marks");
    expect(markSourceOperations("abcdef", [mark])).toContain("operation.one");
  });

  test("an extra binding is refused, other papers stay disabled (sourceSemantics.ts:319)", () => {
    const d = display("eq-s0-d7");
    const first = d.terms[0];
    if (!first) throw new Error("The source fixture must contain terms.");
    const extra = { ...d, terms: [...d.terms, { ...first, termId: "unprinted.extra" }] };
    expect(
      refuses(
        () => compilePrintedSourceSemantics(extra, compilePrintedDisplay(d), quantities),
        "printed-source-binding",
      ),
    ).toContain("every printed term exactly once");
    expect(() => compile(d)).not.toThrow();
    expect(
      compilePrintedSourceSemantics(
        { ...d, paper: "light-quanta" },
        compilePrintedDisplay(d),
        quantities,
      ),
    ).toBeUndefined();
  });

  test("the real printed-display compiler publishes the semantic payload for every source variant", async () => {
    const result = await printedDisplays(ROOT, ["mass-energy"], []);
    expect(result.problems).toEqual([]);
    expect(result.displays.map((d) => [d.display, d.latex])).toEqual(
      checked.displays.map((d) => [d.display, d.latex]),
    );
    for (const d of result.displays) {
      expect(d.semantics?.kind).toBe("validated-source-binding");
      expect(d.html).toContain("data-op=");
      expect(d.semantics?.operations.some((o) => o.primary)).toBe(true);
    }
  });
});

describe("every publication guard has an actual reject and accept case", () => {
  test("an alignment must contain the complete display (sourceExpression.ts:367)", () => {
    const d = display("eq-s0-d5");
    expect(
      refuses(
        () => parseSourceExpression({ ...d, latex: d.latex + " 1" }),
        "printed-expression-unsupported",
      ),
    ).toContain("Unclosed alignment");
    expect(parseSourceExpression(d).rows).toHaveLength(2);
  });

  test("an unknown display has no invented operation guide (sourceSemantics.ts:279)", () => {
    const d = display("eq-s0-d7");
    expect(
      refuses(
        () =>
          compilePrintedSourceSemantics(
            { ...d, display: "eq-s0-d8" },
            compilePrintedDisplay(d),
            quantities,
          ),
        "printed-source-operation",
      ),
    ).toContain("no authored operation guide");
    expect(compile(d).semantics.operations.some((operation) => operation.primary)).toBe(true);
  });

  test("a guide bound to a different expression is refused (sourceSemantics.ts:331)", () => {
    const d = display("eq-s0-d7");
    expect(
      refuses(
        () =>
          compilePrintedSourceSemantics(
            { ...d, display: "eq-s0-d1" },
            compilePrintedDisplay(d),
            quantities,
          ),
        "printed-source-operation",
      ),
    ).toContain("no longer matches the source");
    expect(() => compile(d)).not.toThrow();
  });

  test("a changed power cannot keep the authored square explanation (sourceSemantics.ts:389)", () => {
    const d = display("eq-s0-d1");
    // The radicand remains dimensionless and all quantity bindings retain their offsets,
    // so this reaches the authored-reading check rather than an earlier dimension refusal.
    const changed = { ...d, latex: d.latex.replace("^2", "^4") };
    expect(
      refuses(
        () => compilePrintedSourceSemantics(changed, compilePrintedDisplay(changed), quantities),
        "printed-source-operation",
      ),
    ).toContain("No authored reading");
    expect(() => compile(d)).not.toThrow();
  });

  test("consistent non-energy equalities cannot masquerade as the source ledger (sourceSemantics.ts:361)", () => {
    const d = display("eq-s0-d2");
    const altered = new Map(quantities);
    for (const id of ["bodyEnergyRestBefore", "bodyEnergyRestAfter", "emittedEnergyRestFrame"]) {
      const q = quantities.get(id);
      if (!q) throw new Error("The ledger quantity must exist.");
      altered.set(id, {
        ...q,
        dimension: [0, 0, 0, 0, 0, 0].map((num) => ({ num, den: 1 })),
        dimensionlessKind: "pure-number",
      });
    }
    expect(
      refuses(
        () => compilePrintedSourceSemantics(d, compilePrintedDisplay(d), altered),
        "printed-source-dimension",
      ),
    ).toContain("expects energy");
    expect(compile(d).semantics.dimension).toBe("length² × mass × time⁻²");
  });

  test("actual rendered HTML must retain every expected operation marker (sourceSemantics.ts:222)", () => {
    const d = display("eq-s0-d7");
    const original = compilePrintedDisplay(d);
    const built = compile(d);
    const marks = built.semantics.operations.map(({ id }) => ({ id, kind: "op" as const }));
    const first = marks[0];
    if (!first) throw new Error("The compiler must publish operation markers.");
    const damaged = built.html.replace(
      'data-op="' + first.id + '"',
      'data-discarded="' + first.id + '"',
    );
    expect(
      refuses(
        () => mergeSourceOperationRendering(original, damaged, marks),
        "printed-source-marks",
      ),
    ).toContain("rendering dropped");
    expect(mathml(mergeSourceOperationRendering(original, built.html, marks))).toBe(
      mathml(original.html),
    );
  });

  test("a malformed visual cannot replace a source display (sourceSemantics.ts:230)", () => {
    const d = display("eq-s0-d7");
    const original = compilePrintedDisplay(d);
    const built = compile(d);
    const marks = built.semantics.operations.map(({ id }) => ({ id, kind: "op" as const }));
    const visualOpen = '<span class="katex-html" aria-hidden="true">';
    expect(
      refuses(
        () =>
          mergeSourceOperationRendering(
            { ...original, html: original.html.replace(visualOpen, '<span class="missing">') },
            built.html,
            marks,
          ),
        "printed-source-marks",
      ),
    ).toContain("original display structure");
    expect(
      refuses(
        () =>
          mergeSourceOperationRendering(
            original,
            built.html.replace(visualOpen, '<span class="missing">'),
            marks,
          ),
        "printed-source-marks",
      ),
    ).toContain("original display structure");
    expect(mergeSourceOperationRendering(original, built.html, marks)).toContain(visualOpen);
  });
});
