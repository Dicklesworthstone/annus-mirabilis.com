import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { glyphSignature, printedAtoms } from "../latex/printedAtoms.ts";
import type { CheckedDisplay, DisplayTermBinding, DisplayTermsFile } from "./displayTerms.ts";
import { parseSourceExpression, SourceExpressionError, sourceNodes } from "./sourceExpression.ts";

// These grammar tests deliberately need no generated site artifacts. The full source-semantics
// suite separately checks the same real records against the source, concordance and quantities.
const path = "content/display-terms/special-relativity.yaml";
const records = strictParse(
  readFileSync(join(process.cwd(), path), "utf8"),
  "yaml",
  path,
) as DisplayTermsFile;

function fixture(
  latex: string,
  bindings: readonly DisplayTermBinding[],
  display = "aligned-columns-fixture",
): CheckedDisplay {
  const bySignature = new Map(bindings.map((binding) => [glyphSignature(binding.glyph), binding]));
  return {
    paper: "special-relativity",
    display,
    latex,
    spoken: "Parser grammar fixture.",
    terms: printedAtoms(latex).map((atom) => {
      const binding = bySignature.get(atom.signature);
      if (!binding) throw new Error("Unbound fixture glyph: " + atom.text);
      return {
        termId: "source." + display + "." + atom.start,
        quantityId: binding.quantityId,
        glyph: binding.glyph,
        start: atom.start,
        end: atom.markEnd,
        ...(atom.bare ? { braced: true } : {}),
      };
    }),
  };
}

function recorded(id: string): CheckedDisplay {
  const record = records.displays.find((entry) => entry.display === id);
  if (!record) throw new Error("Missing real source record: " + id);
  return fixture(record.latex, record.terms, id);
}

const fieldRecord = records.displays.find((entry) => entry.display === "eq-s6-d9");
if (!fieldRecord) throw new Error("Missing field-transform fixture.");
const fields = (latex: string) => fixture(latex, fieldRecord.terms);
const options = { allowAlignedColumns: true };

function refuses(action: () => unknown): string {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(SourceExpressionError);
  expect((caught as SourceExpressionError).code).toBe("printed-expression-unsupported");
  return (caught as Error).message;
}

describe("explicit independent columns in printed aligned equations", () => {
  for (const [id, expected] of [
    ["eq-s6-d9", ["X'", "L'", "Y'", "M'", "Z'", "N'"]],
    ["eq-s10-d3", ["\\tau", "\\xi", "X'", "\\eta", "Y'", "\\zeta", "Z'"]],
  ] as const) {
    test(id + " keeps the real source's independent relations in row-major order", () => {
      const display = recorded(id);
      const before = JSON.stringify(display);
      const source = parseSourceExpression(display, {}, false, options);
      const byTerm = new Map(display.terms.map((term) => [term.termId, term]));
      expect(
        source.rows.map(({ tree }) => {
          if (tree.kind !== "relation" || tree.left.kind !== "symbol")
            throw new Error("Every matrix entry must have its own printed left side.");
          return byTerm.get(tree.left.termId)?.glyph;
        }),
      ).toEqual([...expected]);
      expect(source.continuationRows).toEqual([]);

      // Neither the split nor the semantic traversal may duplicate, drop or rewrite a glyph.
      const symbols = sourceNodes(source).flatMap(({ node }) =>
        node.tree.kind === "symbol" ? [[node.tree.termId, node.tree.quantityId]] : [],
      );
      expect(symbols.sort()).toEqual(
        display.terms.map((term) => [term.termId, term.quantityId]).sort(),
      );
      for (const row of source.rows) {
        expect(row.marker).toBeDefined();
        expect(display.latex.slice(row.marker!.start, row.marker!.end)).toBe("=");
        expect(display.latex.slice(row.start, row.end)).not.toContain("&\\qquad");
      }
      expect(JSON.stringify(display)).toBe(before);
    });

    test(id + " remains unsupported without the authored columns opt-in", () => {
      refuses(() => parseSourceExpression(recorded(id)));
    });
  }

  test("ordinary alignment and continuation equalities keep their preceding left side", () => {
    const display = fields("\\begin{aligned} X' &= X + Y , \\\\ &= Z . \\end{aligned}");
    const baseline = parseSourceExpression(display);
    const source = parseSourceExpression(display, {}, false, options);
    expect(source).toEqual(baseline);
    expect(source.continuationRows).toEqual([1]);
    const first = source.rows[0]!.tree;
    const second = source.rows[1]!.tree;
    if (first.kind !== "relation" || second.kind !== "relation")
      throw new Error("Expected both continuation relations.");
    expect(second.left).toBe(first.left);
    expect(source.rows[1]!.parts.map((part) => part.name)).toEqual(["right"]);
  });

  test("chained equalities keep their separate opt-in within independent columns", () => {
    const display = fields("\\begin{aligned} X' &= X = Y , &\\qquad L' &= L . \\end{aligned}");
    refuses(() => parseSourceExpression(display, {}, false, options));
    const source = parseSourceExpression(display, {}, true, options);
    expect(source.rows).toHaveLength(3);
    expect(source.continuationRows).toEqual([1]);
    const first = source.rows[0]!.tree;
    const second = source.rows[1]!.tree;
    if (first.kind !== "relation" || second.kind !== "relation")
      throw new Error("Expected both chained relations.");
    expect(second.left).toBe(first.left);
  });

  test("a complete single-column relation restores an unambiguous continuation target", () => {
    const display = fields(
      "\\begin{aligned} X' &= X , &\\qquad L' &= L , \\\\ Y' &= Y , \\\\ &= Z . \\end{aligned}",
    );
    const source = parseSourceExpression(display, {}, false, options);
    expect(source.rows).toHaveLength(4);
    expect(source.continuationRows).toEqual([3]);
    const third = source.rows[2]!.tree;
    const fourth = source.rows[3]!.tree;
    if (third.kind !== "relation" || fourth.kind !== "relation")
      throw new Error("Expected the restored continuation relations.");
    expect(fourth.left).toBe(third.left);
  });

  test("each aligned column requires its own relation (sourceExpression.ts:449)", () => {
    let caught: unknown;
    try {
      parseSourceExpression(
        fields("\\begin{aligned} X &\\qquad L'=L \\end{aligned}"),
        {},
        false,
        options,
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SourceExpressionError);
    expect((caught as SourceExpressionError).code).toBe("printed-expression-unsupported");
    expect((caught as Error).message).toContain(
      "Each aligned column must contain an independent relation.",
    );
    expect(
      parseSourceExpression(
        fields("\\begin{aligned} X'=X &\\qquad L'=L \\end{aligned}"),
        {},
        false,
        options,
      ).rows,
    ).toHaveLength(2);
  });

  for (const [reason, latex] of [
    ["a short spacing command", "\\begin{aligned} X'=X &\\quad L'=L \\end{aligned}"],
    ["a bare second alignment tab", "\\begin{aligned} X'=X & L'=L \\end{aligned}"],
    ["a delimiter outside aligned", "X'=X &\\qquad L'=L"],
    ["an empty first column", "\\begin{aligned} &\\qquad L'=L \\end{aligned}"],
    ["an empty second column", "\\begin{aligned} X'=X &\\qquad \\end{aligned}"],
    ["an empty physical row", "\\begin{aligned} X'=X \\\\ \\\\ L'=L \\end{aligned}"],
    ["a trailing empty row", "\\begin{aligned} X'=X \\\\ \\end{aligned}"],
    ["a continuation in the next column", "\\begin{aligned} X'=X &\\qquad =L \\end{aligned}"],
    [
      "a continuation in the first column",
      "\\begin{aligned} X'=X \\\\ &=Y &\\qquad L'=L \\end{aligned}",
    ],
    [
      "a continuation after multiple columns",
      "\\begin{aligned} X'=X &\\qquad L'=L \\\\ &=Y \\end{aligned}",
    ],
  ] as const) {
    test("refuses " + reason + " instead of inventing a relation or a dependency", () => {
      refuses(() => parseSourceExpression(fields(latex), {}, false, options));
    });
  }
});
