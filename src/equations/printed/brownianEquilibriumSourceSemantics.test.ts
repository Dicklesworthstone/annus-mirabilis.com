import { describe, expect, test } from "bun:test";
import { getQuantityRegistry } from "../../content/quantities/registry.ts";
import { walk } from "../ast.ts";
import { BROWNIAN_OPERATION_GUIDES } from "./brownianOperations.ts";
import { type CheckedDisplay, compilePrintedDisplay } from "./displayTerms.ts";
import { checkPaperDisplays } from "./paperDisplays.ts";
import { parseSourceExpression, sourceNodes } from "./sourceExpression.ts";
import { compilePrintedSourceSemantics, type SourceSemanticsError } from "./sourceSemantics.ts";

const checked = await checkPaperDisplays(process.cwd(), "brownian-motion");
if (!checked || checked.problems.length) throw new Error("The Brownian source must check clean.");
const quantities = getQuantityRegistry().quantities;

function display(id: string): CheckedDisplay {
  const found = checked?.displays.find((entry) => entry.display === id);
  if (!found) throw new Error("Missing Brownian source display " + id);
  return found;
}

function compile(source: CheckedDisplay) {
  const built = compilePrintedSourceSemantics(source, compilePrintedDisplay(source), quantities);
  if (!built) throw new Error("The selected source needs its authored operation readings.");
  return built;
}

function refuses(action: () => unknown, code: string) {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  expect((caught as SourceSemanticsError).code).toBe(code);
}

function replace(source: CheckedDisplay, from: string, to: string): CheckedDisplay {
  const offset = source.latex.indexOf(from);
  if (offset < 0) throw new Error("The source must contain the operation being changed.");
  const end = offset + from.length;
  const delta = to.length - from.length;
  return {
    ...source,
    latex: source.latex.slice(0, offset) + to + source.latex.slice(end),
    terms: source.terms.map((term) =>
      term.start >= end ? { ...term, start: term.start + delta, end: term.end + delta } : term,
    ),
  };
}

describe("Brownian source operations from osmotic pressure to directed particle flux", () => {
  test("the partial volume and molar amount remain distinct from total volume and particle count", () => {
    const source = display("eq-s1-d1");
    const built = compile(source);
    expect(source.terms.find((term) => term.glyph === "V^*")?.quantityId).toBe("volume");
    expect(source.terms.find((term) => term.glyph === "z")?.quantityId).toBe("soluteAmount");
    expect(built.semantics.dimension).toBe("length² × mass × time⁻²");
    const left = built.semantics.operations.find((op) => op.path === "row1.left");
    const right = built.semantics.operations.find((op) => op.path === "row1.right");
    expect(left?.does).toContain("region accessible to the solute");
    expect(right?.why).toContain("particle count");
    expect(right?.dimensionExponents).toEqual(["2", "1", "-2", "0", "0", "0"]);
    // Replacing amount by count is not a cosmetic change to the same osmotic equation.
    refuses(
      () =>
        compile({
          ...source,
          terms: source.terms.map((term) =>
            term.glyph === "z" ? { ...term, quantityId: "particleCount" } : term,
          ),
        }),
      "printed-source-operation",
    );
  });

  test("both equals signs preserve the same pressure and bind only the printed physical occurrences", () => {
    const source = display("eq-s1-d2");
    const parsed = parseSourceExpression(source, {}, true);
    const built = compile(source);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.continuationRows).toEqual([1]);
    const [first, second] = parsed.rows.map((row) => row.tree);
    expect(first?.kind).toBe("relation");
    expect(second?.kind).toBe("relation");
    if (first?.kind !== "relation" || second?.kind !== "relation")
      throw new Error("The source prints a chained equality.");
    expect(second.left).toBe(first.left);
    expect(first.left).toMatchObject({ kind: "symbol", quantityId: "osmoticPressure" });
    const occurrences = sourceNodes(parsed).flatMap(({ node }) =>
      node.tree.kind === "symbol" ? [node.tree.termId] : [],
    );
    expect(occurrences.sort()).toEqual(source.terms.map((term) => term.termId).sort());
    const secondEquality = built.semantics.operations.find((op) => op.path === "row2");
    expect(secondEquality?.primary).toBe(true);
    expect(secondEquality?.why).toContain("nu = n/V star");
    expect(secondEquality?.dimensionExponents).toEqual(["-1", "1", "-2", "0", "0", "0"]);
    expect(secondEquality?.termIds).not.toContain(
      source.terms.find((term) => term.glyph === "p")?.termId,
    );
    expect(
      built.semantics.operations.find((op) => op.path === "row1.right.args.1")?.dimensionExponents,
    ).toEqual(["0", "0", "0", "0", "0", "1"]);
    expect(
      built.semantics.operations.find((op) => op.path === "row2.right.args.0")?.dimensionExponents,
    ).toEqual(["2", "1", "-2", "0", "0", "0"]);
    // The same molecular-number units must not let an inference quantity replace the premise.
    refuses(
      () =>
        compile({
          ...source,
          terms: source.terms.map((term) =>
            term.glyph === "N" ? { ...term, quantityId: "avogadroNumberEstimate" } : term,
          ),
        }),
      "printed-source-operation",
    );
  });

  test("drift speed and particle flux keep their source form and different dimensions", () => {
    const speed = compile(display("eq-s3-d5"));
    const flux = compile(display("eq-s3-d6"));
    for (const [id, built] of [
      ["eq-s3-d5", speed],
      ["eq-s3-d6", flux],
    ] as const) {
      expect(BROWNIAN_OPERATION_GUIDES[id]?.relationOperator).toBeNull();
      expect(built.semantics.rows.every((row) => row.kind === "quotient")).toBe(true);
      expect(built.semantics.rows.flatMap(walk).some((node) => node.kind === "relation")).toBe(
        false,
      );
      expect(built.semantics.premise).toContain("viscosity, not the Boltzmann constant");
      expect(display(id).terms.find((term) => term.glyph === "K")?.quantityId).toBe(
        "externalForcePerParticle",
      );
      expect(display(id).terms.find((term) => term.glyph === "k")?.quantityId).toBe("viscosity");
      expect(display(id).terms.find((term) => term.glyph === "P")?.quantityId).toBe(
        "particleRadius",
      );
    }
    expect(speed.semantics.operations.find((op) => op.path === "row1")?.dimensionExponents).toEqual(
      ["1", "0", "-1", "0", "0", "0"],
    );
    expect(flux.semantics.operations.find((op) => op.path === "row1")?.dimensionExponents).toEqual([
      "-2",
      "0",
      "-1",
      "0",
      "0",
      "0",
    ]);
    expect(
      speed.semantics.operations.find((op) => op.path === "row1.denominator")?.dimensionExponents,
    ).toEqual(["0", "1", "-1", "0", "0", "0"]);
    expect(
      flux.semantics.operations.find((op) => op.path === "row1.numerator")?.dimensionExponents,
    ).toEqual(["-2", "1", "-2", "0", "0", "0"]);
    expect(flux.semantics.operations.find((op) => op.path === "row1")?.why).toContain(
      "not a mass flux",
    );
    expect(speed.semantics.operations.find((op) => op.path === "row1")?.why).toContain(
      "not the speed of a jagged Brownian path",
    );
  });

  test("drift coefficient changes and missing geometry cannot inherit the source's Stokes reading", () => {
    for (const id of ["eq-s3-d5", "eq-s3-d6"]) {
      for (const [from, to] of [
        ["6", "3"],
        ["\\pi ", ""],
      ] as const)
        refuses(() => compile(replace(display(id), from, to)), "printed-source-operation");
      refuses(
        () => compile({ ...display(id), latex: display(id).latex.replace(/[.,]$/, "") + " = 0" }),
        "printed-source-operation",
      );
    }
    // The grammar admits chained source relations only where the complete reading opts in.
    refuses(() => parseSourceExpression(display("eq-s1-d2")), "printed-expression-unsupported");
    expect(() => compile(display("eq-s1-d2"))).not.toThrow();
  });

  test("dimensions are checked against the canonical owners rather than accepted from the guide", () => {
    const density = quantities.get("numberDensity");
    if (!density) throw new Error("Number density must have a canonical owner.");
    const altered = new Map(quantities);
    altered.set(density.id, {
      ...density,
      dimension: [-3, 1, 0, 0, 0, 0].map((num) => ({ num, den: 1 })),
    });
    for (const id of ["eq-s1-d2", "eq-s3-d6"])
      refuses(
        () =>
          compilePrintedSourceSemantics(display(id), compilePrintedDisplay(display(id)), altered),
        "printed-source-dimension",
      );
    expect(() => compile(display("eq-s3-d6"))).not.toThrow();
  });
});
