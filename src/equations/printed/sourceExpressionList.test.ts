import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { checkDimensions } from "../../content/dimensions/check.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { glyphSignature, printedAtoms } from "../latex/printedAtoms.ts";
import type { CheckedDisplay, DisplayTermBinding, DisplayTermsFile } from "./displayTerms.ts";
import { parseSourceExpression, SourceExpressionError, sourceNodes } from "./sourceExpression.ts";

const path = "content/display-terms/special-relativity.yaml";
const records = strictParse(readFileSync(path, "utf8"), "yaml", path) as DisplayTermsFile;
const semiaxes = records.displays.find((display) => display.display === "eq-s4-d3");
if (!semiaxes) throw new Error("The source's three semiaxes must be present.");

function fixture(
  latex: string,
  bindings: readonly DisplayTermBinding[] = semiaxes!.terms,
): CheckedDisplay {
  const byGlyph = new Map(bindings.map((term) => [glyphSignature(term.glyph), term]));
  return {
    paper: "special-relativity",
    display: "eq-s4-d3",
    latex,
    spoken: "The three semiaxes in printed order.",
    terms: printedAtoms(latex).map((atom) => {
      const term = byGlyph.get(atom.signature);
      if (!term) throw new Error("Unbound fixture glyph: " + atom.text);
      return {
        termId: "semiaxis." + atom.start,
        quantityId: term.quantityId,
        glyph: term.glyph,
        start: atom.start,
        end: atom.markEnd,
        ...(atom.bare ? { braced: true } : {}),
      };
    }),
  };
}

const options = { allowExpressionList: true };

describe("source-authored lists of independent expressions", () => {
  test("the real semiaxes stay three lengths, with no invented equality or product", () => {
    const display = fixture(semiaxes.latex);
    const before = JSON.stringify(display);
    const parsed = parseSourceExpression(display, {}, false, options);
    expect(parsed.rows.map(({ tree }) => tree.kind)).toEqual(["product", "symbol", "symbol"]);
    expect(parsed.continuationRows).toEqual([]);
    expect(parsed.rows.map(({ start, end }) => display.latex.slice(start, end))).toEqual([
      semiaxes.latex.slice(0, semiaxes.latex.indexOf(" ,")),
      "R",
      "R",
    ]);
    const registry = {
      sphereRadius: { id: "sphereRadius", dimension: ["1", "0", "0", "0", "0", "0"] },
      frameSpeed: { id: "frameSpeed", dimension: ["1", "0", "-1", "0", "0", "0"] },
      speedOfLight: { id: "speedOfLight", dimension: ["1", "0", "-1", "0", "0", "0"] },
    };
    // The registry keys follow the checked source bindings, not the spelling of R.
    const radius = display.terms.find((term) => term.glyph === "R")!.quantityId;
    const quantities = { ...registry, [radius]: { ...registry.sphereRadius, id: radius } };
    for (const { tree } of parsed.rows) {
      const checked = checkDimensions(tree, quantities);
      expect(checked.status).toBe("consistent");
      if (checked.status === "consistent")
        expect(checked.dimension.map(({ num, den }) => `${num}/${den}`)).toEqual([
          "1/1",
          "0/1",
          "0/1",
          "0/1",
          "0/1",
          "0/1",
        ]);
    }
    const terms = sourceNodes(parsed).flatMap(({ node }) =>
      node.tree.kind === "symbol" ? [node.tree.termId] : [],
    );
    expect(terms.sort()).toEqual(display.terms.map((term) => term.termId).sort());
    expect(JSON.stringify(display)).toBe(before);
  });

  test("a comma-separated source remains unsupported without its explicit list admission", () => {
    expect(() => parseSourceExpression(fixture(semiaxes.latex))).toThrow(SourceExpressionError);
  });

  test("function-argument commas stay inside their function rather than becoming list entries", () => {
    const display = fixture("f(x,t), \\quad R", [
      { glyph: "f", quantityId: "numberDensity" },
      { glyph: "x", quantityId: "coordinatePosition" },
      { glyph: "t", quantityId: "elapsedTime" },
      ...semiaxes.terms.filter((term) => term.glyph === "R"),
    ]);
    const parsed = parseSourceExpression(display, {}, false, {
      ...options,
      functionArities: { numberDensity: [2] },
    });
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]!.tree).toMatchObject({
      kind: "symbol",
      quantityId: "numberDensity",
      args: [
        { kind: "symbol", quantityId: "coordinatePosition" },
        { kind: "symbol", quantityId: "elapsedTime" },
      ],
    });
    expect(parsed.continuationRows).toEqual([]);
    expect(() =>
      parseSourceExpression(display, {}, false, {
        ...options,
        functionArities: { numberDensity: [1] },
      }),
    ).toThrow(SourceExpressionError);
  });

  test("list admission does not admit chained equalities or change their continuation identities", () => {
    const display = fixture("R = R = R");
    expect(() => parseSourceExpression(display, {}, false, options)).toThrow(SourceExpressionError);
    const parsed = parseSourceExpression(display, {}, true, options);
    expect(parsed.rows.map(({ tree }) => tree.kind)).toEqual(["relation", "relation"]);
    expect(parsed.continuationRows).toEqual([1]);
  });

  for (const latex of ["R,", ", R", "R,,R", "R, \\quad", "(R,R)", "R,R=R", "R=R,R"]) {
    test("rejects an incomplete or mixed list: " + latex, () => {
      expect(() => parseSourceExpression(fixture(latex), {}, false, options)).toThrow(
        SourceExpressionError,
      );
    });
  }
});
