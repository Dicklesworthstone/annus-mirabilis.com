import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  clearAnnouncement,
  getLastAnnouncement,
  setLiveRegionElement,
} from "../../a11y/announce.ts";
import { checkDimensions } from "../../content/dimensions/check.ts";
import { getQuantityRegistry } from "../../content/quantities/registry.ts";
import { PrintedDisplayTerms } from "../../reader/faces/PrintedDisplayTerms.tsx";
import { PrintedOperationReference } from "../../reader/faces/PrintedOperationReference.tsx";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import type { Expression } from "../ast.ts";
import { evaluateExpression } from "../derivations/spotCheck.ts";
import { glyphSignature, printedAtoms } from "../latex/printedAtoms.ts";
import { type CheckedDisplay, compilePrintedDisplay } from "./displayTerms.ts";
import { checkPaperDisplays, printedDisplays } from "./paperDisplays.ts";
import { RELATIVITY_OPERATION_GUIDES } from "./relativityOperations.ts";
import { parseSourceExpression, sourceNodes } from "./sourceExpression.ts";
import { compilePrintedSourceSemantics, sourceDimensionRegistry } from "./sourceSemantics.ts";

const ROOT = process.cwd();
const checked = await checkPaperDisplays(ROOT, "special-relativity");
assert(checked && checked.problems.length === 0, "The real relativity source must check cleanly.");
const quantities = getQuantityRegistry().quantities;
const REQUIRED = [
  "eq-s3-d17",
  "eq-s3-d18",
  "eq-s4-d1",
  "eq-s4-d2",
  "eq-s4-d3",
  "eq-s4-d4",
  "eq-s4-d5",
  "eq-s4-d6",
] as const;
const mathml = (html: string) => html.slice(0, html.indexOf('<span class="katex-html"'));

function display(id: string): CheckedDisplay {
  const value = checked?.displays.find((entry) => entry.display === id);
  assert(value, "The checked source contains " + id);
  return value;
}

function parsed(value: CheckedDisplay) {
  const guide = RELATIVITY_OPERATION_GUIDES[value.display];
  assert(guide, "The selected display has an authored guide.");
  return parseSourceExpression(value, guide.symbolIndices, guide.allowChainedRelations, {
    allowExpressionList: guide.allowExpressionList ?? false,
  });
}

function compile(value: CheckedDisplay) {
  const result = compilePrintedSourceSemantics(value, compilePrintedDisplay(value), quantities);
  assert(result, "The selected display must have authored source semantics.");
  return result;
}

/** Rebuild checked spans so a mutation tests meaning, rather than merely invalid offsets. */
function changedSource(value: CheckedDisplay, latex: string): CheckedDisplay {
  assert.notEqual(latex, value.latex, "The planted mutation must change real source.");
  const bindings = new Map(value.terms.map((term) => [glyphSignature(term.glyph), term]));
  return {
    ...value,
    latex,
    terms: printedAtoms(latex).map((atom) => {
      const term = bindings.get(atom.signature);
      assert(term, "The mutation must retain a declared physical glyph: " + atom.text);
      return {
        termId: value.paper + "." + value.display + ".mutation." + atom.start,
        quantityId: term.quantityId,
        glyph: term.glyph,
        start: atom.start,
        end: atom.markEnd,
        ...(atom.bare ? { braced: true } : {}),
      };
    }),
  };
}

function refuses(action: () => unknown, code: string): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  expect(caught).toMatchObject({ code });
}

function evaluate(
  value: CheckedDisplay,
  tree: Expression,
  byGlyph: Readonly<Record<string, number>>,
): number {
  const assignment = Object.fromEntries(
    value.terms.flatMap((term): Array<[string, number]> => {
      const number = byGlyph[term.glyph];
      return number === undefined ? [] : [[term.termId, number]];
    }),
  );
  const result = evaluateExpression(tree, assignment);
  assert(Number.isFinite(result), "The numerical check must evaluate a bound source tree.");
  return result;
}

function relationSides(id: string, byGlyph: Readonly<Record<string, number>>) {
  const value = display(id);
  return parsed(value).rows.map(({ tree }) => {
    assert(tree.kind === "relation");
    return [evaluate(value, tree.left, byGlyph), evaluate(value, tree.right, byGlyph)] as const;
  });
}

describe("the source's light fronts, measured sphere and moving clock", () => {
  test("every selected display keeps the original MathML and each physical term occurrence", () => {
    const selected = REQUIRED.map(display);
    expect(selected.length).toBeGreaterThan(0);
    for (const value of selected) {
      const before = JSON.stringify(value);
      const original = compilePrintedDisplay(value);
      const built = compile(value);
      expect(built.semantics.dimensionStatus).toBe("consistent");
      expect(built.semantics.operations.some((operation) => operation.primary)).toBe(true);
      expect(mathml(built.html)).toBe(mathml(original.html));
      expect(JSON.stringify(value)).toBe(before);
      expect(
        sourceNodes(parsed(value))
          .flatMap(({ node }) =>
            node.tree.kind === "symbol" ? [[node.tree.termId, node.tree.quantityId]] : [],
          )
          .sort(),
      ).toEqual(value.terms.map((term) => [term.termId, term.quantityId]).sort());
      for (const term of value.terms) {
        expect(built.html).toContain('data-term="' + term.termId + '"');
        expect(built.html).toContain('data-quantity-id="' + term.quantityId + '"');
      }
      for (const operation of built.semantics.operations)
        expect(built.html).toContain('data-op="' + operation.id + '"');
    }
    console.log(
      "[relativity-kinematics] examined " +
        selected.length +
        " real source displays with unchanged MathML",
    );
  });

  test("the two frame-specific light fronts retain independent x, y and z identities", () => {
    for (const [id, position, time] of [
      ["eq-s3-d17", "coordinatePositionStationary", "coordinateTimeStationary"],
      ["eq-s3-d18", "coordinatePositionMoving", "coordinateTimeMoving"],
    ] as const) {
      const value = display(id);
      const symbols = sourceNodes(parsed(value)).flatMap(({ node }) =>
        node.tree.kind === "symbol" ? [node.tree] : [],
      );
      expect(
        symbols.filter((term) => term.quantityId === position).map((term) => term.index),
      ).toEqual(["x", "y", "z"]);
      expect(symbols.some((term) => term.quantityId === time)).toBe(true);
      expect(symbols.some((term) => term.quantityId === "properTimeElapsed")).toBe(false);
      const semantics = compile(value).semantics;
      expect(semantics.premise).toContain("does not fix");
      expect(semantics.premise).toContain("phi(v)");
      expect(semantics.premise).toContain("nonnegative coordinate time");
    }
  });

  test("complete row dimensions distinguish squared surfaces, lengths and clock readings", () => {
    const expected: Readonly<Record<string, readonly string[]>> = {
      "eq-s3-d17": ["2,0,0,0,0,0"],
      "eq-s3-d18": ["2,0,0,0,0,0"],
      "eq-s4-d1": ["2,0,0,0,0,0"],
      "eq-s4-d2": ["2,0,0,0,0,0"],
      "eq-s4-d3": ["1,0,0,0,0,0", "1,0,0,0,0,0", "1,0,0,0,0,0"],
      "eq-s4-d4": ["0,0,1,0,0,0"],
      "eq-s4-d5": ["1,0,0,0,0,0"],
      "eq-s4-d6": ["0,0,1,0,0,0", "0,0,1,0,0,0"],
    };
    for (const id of REQUIRED) {
      const dimensions = compile(display(id)).semantics.rows.map((tree) => {
        const result = checkDimensions(tree, sourceDimensionRegistry(quantities), {
          context: "gaussian-cgs",
        });
        assert(result.status === "consistent");
        return result.dimension
          .map(({ num, den }) => (String(den) === "1" ? String(num) : num + "/" + den))
          .join(",");
      });
      expect(dimensions).toEqual(expected[id]);
    }
  });

  test("the semiaxes stay three independent lengths and the clock lag stays a chained equality", () => {
    const axes = parsed(display("eq-s4-d3"));
    expect(axes.rows.map(({ tree }) => tree.kind)).toEqual(["product", "symbol", "symbol"]);
    expect(axes.continuationRows).toEqual([]);
    expect(compile(display("eq-s4-d3")).semantics.context).toContain("semiaxes along x, y and z");
    const clock = parsed(display("eq-s4-d6"));
    expect(clock.continuationRows).toEqual([1]);
    expect(
      sourceNodes(clock).filter(
        ({ node }) =>
          node.tree.kind === "symbol" && node.tree.quantityId === "coordinateTimeMoving",
      ),
    ).toHaveLength(1);
    expect(
      compile(display("eq-s4-d6")).semantics.operations.find(
        (operation) => operation.path === "row2",
      )?.why,
    ).toContain("same clock");
  });
});

describe("independent physical checks evaluate the real printed expressions", () => {
  test("one oblique outgoing light event satisfies both frame equations", () => {
    // V=10, t=2, (x,y,z)=(12,16,0): radius 20. At v=6, beta=1.25 gives
    // (xi,eta,zeta,tau)=(0,16,0,1.6), hence radius 16 in k.
    for (const [left, right] of relationSides("eq-s3-d17", {
      x: 12,
      y: 16,
      z: 0,
      V: 10,
      t: 2,
    }))
      expect(left).toBeCloseTo(right, 12);
    for (const [left, right] of relationSides("eq-s3-d18", {
      "\\xi": 0,
      "\\eta": 16,
      "\\zeta": 0,
      V: 10,
      "\\tau": 1.6,
    }))
      expect(left).toBeCloseTo(right, 12);
  });

  test("the printed semiaxes lie on the simultaneous ellipsoid and contract only longitudinally", () => {
    const value = display("eq-s4-d3");
    for (const v of [-9, -6, 0, 6, 9]) {
      const axes = parsed(value).rows.map(({ tree }) => evaluate(value, tree, { R: 5, V: 10, v }));
      expect(axes[0]).toBeCloseTo(5 * Math.sqrt(1 - (v / 10) ** 2), 12);
      expect(axes[1]).toBe(5);
      expect(axes[2]).toBe(5);
      for (const [x, y, z] of [
        [axes[0]!, 0, 0],
        [0, axes[1]!, 0],
        [0, 0, axes[2]!],
      ]) {
        for (const [left, right] of relationSides("eq-s4-d2", {
          x: x!,
          y: y!,
          z: z!,
          R: 5,
          V: 10,
          v,
        }))
          expect(left).toBeCloseTo(right, 11);
      }
    }
    const measurement = compile(display("eq-s4-d2")).semantics;
    expect(measurement.premise).toContain("common K time");
    const surface = measurement.operations.find((operation) => operation.path === "row1");
    expect(surface?.why).toContain("photograph");
    expect(surface?.why).toContain("different events");
  });

  test("substituting the clock path produces the exact rate and lag in both velocity directions", () => {
    for (const v of [-9, -6, 0, 6, 9]) {
      const tau = 10 * Math.sqrt(1 - (v / 10) ** 2);
      const assignment = { v, V: 10, t: 10, x: v * 10, "\\tau": tau };
      for (const id of ["eq-s4-d4", "eq-s4-d5", "eq-s4-d6"])
        for (const [left, right] of relationSides(id, assignment))
          expect(left).toBeCloseTo(right, 11);
    }
    // This exact source value differs from the second-order approximation at v/V = 0.6.
    const exact = relationSides("eq-s4-d6", { v: 6, V: 10, t: 10, "\\tau": 8 });
    expect(exact[0]?.[1]).toBeCloseTo(8, 12);
    expect(exact[1]?.[1]).toBeCloseTo(8, 12);
    expect(exact[0]?.[1]).not.toBeCloseTo(10 * (1 - 0.5 * 0.6 ** 2), 3);
  });
});

describe("planted changes cannot inherit the source's physical explanation", () => {
  test("a reversed speed ratio is refused although all dimensions and the quantity set still agree", () => {
    for (const id of ["eq-s4-d2", "eq-s4-d3", "eq-s4-d4", "eq-s4-d6"]) {
      const value = display(id);
      const changed = {
        ...value,
        terms: value.terms.map((term) => ({
          ...term,
          quantityId:
            term.quantityId === "frameSpeed"
              ? "speedOfLight"
              : term.quantityId === "speedOfLight"
                ? "frameSpeed"
                : term.quantityId,
        })),
      };
      for (const { tree } of parsed(changed).rows)
        expect(checkDimensions(tree, sourceDimensionRegistry(quantities)).status).toBe(
          "consistent",
        );
      refuses(() => compile(changed), "printed-source-operation");
      expect(() => compile(value)).not.toThrow();
    }
  });

  test("moving the contraction onto the transverse axis is refused despite unchanged units", () => {
    const value = display("eq-s4-d2");
    const latex = value.latex.replace("x^2", "Q^2").replace("y^2", "x^2").replace("Q^2", "y^2");
    const changed = changedSource(value, latex);
    for (const { tree } of parsed(changed).rows)
      expect(checkDimensions(tree, sourceDimensionRegistry(quantities)).status).toBe("consistent");
    refuses(() => compile(changed), "printed-source-operation");
  });

  test("the position-dependent time offset cannot reverse its speeds while retaining the correct root", () => {
    const value = display("eq-s4-d4");
    const offsetSpeeds = sourceNodes(parsed(value)).flatMap(({ path, node }) =>
      path.startsWith("row1.right.args.1.argument.args.1.") &&
      node.tree.kind === "symbol" &&
      ["frameSpeed", "speedOfLight"].includes(node.tree.quantityId)
        ? [node.tree.termId]
        : [],
    );
    expect(offsetSpeeds).toHaveLength(2);
    const changed = {
      ...value,
      terms: value.terms.map((term) =>
        offsetSpeeds.includes(term.termId)
          ? {
              ...term,
              quantityId: term.quantityId === "frameSpeed" ? "speedOfLight" : "frameSpeed",
            }
          : term,
      ),
    };
    for (const { tree } of parsed(changed).rows)
      expect(checkDimensions(tree, sourceDimensionRegistry(quantities)).status).toBe("consistent");
    refuses(() => compile(changed), "printed-source-operation");
    expect(() => compile(value)).not.toThrow();
  });

  test("the two coordinate times cannot exchange roles or leak into the clock-lag terms", () => {
    for (const id of ["eq-s4-d4", "eq-s4-d6"]) {
      const value = display(id);
      const changed = {
        ...value,
        terms: value.terms.map((term) => ({
          ...term,
          quantityId:
            term.quantityId === "coordinateTimeMoving"
              ? "coordinateTimeStationary"
              : term.quantityId === "coordinateTimeStationary"
                ? "coordinateTimeMoving"
                : term.quantityId,
        })),
      };
      for (const { tree } of parsed(changed).rows)
        expect(checkDimensions(tree, sourceDimensionRegistry(quantities)).status).toBe(
          "consistent",
        );
      refuses(() => compile(changed), "printed-source-operation");
      expect(() => compile(value)).not.toThrow();
    }
    const clock = display("eq-s4-d6");
    const times = clock.terms.filter((term) => term.quantityId === "coordinateTimeStationary");
    expect(times).toHaveLength(3);
    for (const lagTime of times.slice(1)) {
      const changed = {
        ...clock,
        terms: clock.terms.map((term) =>
          term.termId === lagTime.termId ? { ...term, quantityId: "coordinateTimeMoving" } : term,
        ),
      };
      for (const { tree } of parsed(changed).rows)
        expect(checkDimensions(tree, sourceDimensionRegistry(quantities)).status).toBe(
          "consistent",
        );
      refuses(() => compile(changed), "printed-source-operation");
    }
  });

  test("coordinate time cannot silently become proper time or the other frame's clock", () => {
    for (const id of ["eq-s3-d18", "eq-s4-d4", "eq-s4-d6"]) {
      const value = display(id);
      for (const quantityId of ["properTimeElapsed", "coordinateTimeStationary"]) {
        const changed = {
          ...value,
          terms: value.terms.map((term) =>
            term.quantityId === "coordinateTimeMoving" ? { ...term, quantityId } : term,
          ),
        };
        refuses(() => compile(changed), "printed-source-operation");
      }
    }
  });

  test("wrong signs in the rate, position offset and lag are rejected", () => {
    for (const [id, from, to] of [
      ["eq-s4-d2", "1 - ", "1 + "],
      ["eq-s4-d3", "1 - ", "1 + "],
      ["eq-s4-d4", " t - ", " t + "],
      ["eq-s4-d6", "= t - ", "= t + "],
      ["eq-s4-d6", "1 - \\sqrt", "1 + \\sqrt"],
    ] as const) {
      const value = display(id);
      const changed = changedSource(value, value.latex.replace(from, to));
      refuses(() => compile(changed), "printed-source-operation");
      expect(() => compile(value)).not.toThrow();
    }
  });

  test("changing the coefficient, a dimensional power or the number of semiaxes is refused", () => {
    const rate = display("eq-s4-d4");
    refuses(
      () => compile(changedSource(rate, rate.latex.replace("\\frac{1}", "\\frac{2}"))),
      "printed-source-operation",
    );
    const front = display("eq-s3-d17");
    refuses(
      () => compile(changedSource(front, front.latex.replace("V^2", "V^4"))),
      "printed-source-dimension",
    );
    const axes = display("eq-s4-d3");
    refuses(
      () => compile(changedSource(axes, axes.latex.replace("R .", "R , \\quad R ."))),
      "printed-source-dimension",
    );
    const clock = display("eq-s4-d6");
    refuses(
      () =>
        compile(changedSource(clock, clock.latex.slice(0, clock.latex.indexOf(" = t - ")) + ".")),
      "printed-source-operation",
    );
  });

  test("unselected scale functions and direction-angle formulas still need their own guides", () => {
    for (const id of ["eq-s3-d15", "eq-s5-d4"]) {
      const value = display(id);
      expect(
        compilePrintedSourceSemantics(value, compilePrintedDisplay(value), quantities),
      ).toBeUndefined();
    }
  });
});

describe("the source operations reach the reader", () => {
  test("each display publishes a no-JavaScript reference and real prerequisite links", async () => {
    const result = await printedDisplays(ROOT, ["special-relativity"], []);
    expect(result.problems).toEqual([]);
    for (const id of REQUIRED) {
      const values = result.displays.filter((value) => value.display === id);
      expect(values.length).toBeGreaterThan(0);
      for (const value of values) {
        assert(value.semantics);
        const markup = renderToStaticMarkup(
          <PrintedDisplayTerms display={value} inline={false}>
            <span>Source equation</span>
          </PrintedDisplayTerms>,
        );
        expect(markup).toContain('href="/equations/special-relativity/' + id + '/#operations"');
        const reference = renderToStaticMarkup(
          <PrintedOperationReference reading={value.semantics} spoken={value.spoken} />,
        );
        for (const operation of value.semantics.operations) {
          expect(reference).toContain('id="operation-' + operation.id + '"');
          expect(reference).toContain('href="/foundations/' + operation.foundation + '/"');
        }
        expect(reference).toContain(value.semantics.next.href);
      }
    }
  });

  test("selecting the clock's lag highlights only that printed contribution and announces its meaning", async () => {
    const result = await printedDisplays(ROOT, ["special-relativity"], []);
    const value = result.displays.find((item) => item.display === "eq-s4-d6");
    assert(value?.semantics);
    const lag = value.semantics.operations.find(
      (operation) => operation.path === "row2.right.args.1",
    );
    assert(lag);
    await installDom();
    setLiveRegionElement(null);
    clearAnnouncement();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(
          <PrintedDisplayTerms display={value} inline={false}>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted checked source compiler output is the subject of this reader test. */}
            <span dangerouslySetInnerHTML={{ __html: value.html }} />
          </PrintedDisplayTerms>,
        ),
      );
      const toggle = container.querySelector<HTMLAnchorElement>(".printed-operation-toggle");
      assert(toggle);
      await act(async () => {
        toggle.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      const select = container.querySelector<HTMLSelectElement>(".printed-operation-choice select");
      assert(select);
      await act(async () => {
        select.value = lag.id;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(
        container.querySelector("[data-operation-note]")?.getAttribute("data-operation-note"),
      ).toBe(lag.id);
      expect(getLastAnnouncement()).toContain(lag.does);
      const highlighted = [...container.querySelectorAll("[data-term][data-operation-selected]")]
        .map((element) => element.getAttribute("data-term"))
        .sort();
      expect(highlighted).toEqual([...lag.termIds].sort());
      const highlightedOwners = value.terms
        .filter((term) => highlighted.includes(term.termId))
        .map((term) => term.quantityId);
      expect(highlightedOwners).toContain("coordinateTimeStationary");
      expect(highlightedOwners).not.toContain("coordinateTimeMoving");
    } finally {
      await act(async () => root.unmount());
      clearAnnouncement();
      setLiveRegionElement(null);
      await uninstallDom();
    }
  });
});
