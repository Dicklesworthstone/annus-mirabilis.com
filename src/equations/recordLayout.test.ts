/**
 * An authored row layout (am-eq-static-katex-7da): a record carrying `layout: "rows"` renders
 * as aligned rows with the same term and operation ids as its single-line form, and no
 * renderer-invented break appears anywhere. Held with a real chain record, paper 2's second
 * moment, which scrolled sideways on a 320px phone as one line. The parser's refusals are
 * planted negatives. prepare:content compiles every real record through the same parser.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import type { Expression } from "./ast.ts";
import { expressionLatex } from "./latex.ts";
import { BROWNIAN_QUANTITIES } from "./quantities.ts";
import type { EquationRecord } from "./record.ts";
import { parseEquationRecord } from "./record.ts";
import { compileEquation } from "./render.ts";
import { relationChain, rowsLatex } from "./rowLayout.ts";

const ROOT = new URL("../../content/equations/", import.meta.url);
const load = (paper: string, id: string) =>
  JSON.parse(readFileSync(new URL(`${paper}/${id}.json`, ROOT), "utf8")) as EquationRecord;
const CHAIN = load("brownian-motion", "eq-model-bm-gaussian-second-moment");
const SINGLE = load("brownian-motion", "eq-model-bm-diffusion-equation");
const withLayout = (r: EquationRecord, layout: unknown) =>
  ({ ...r, layout }) as unknown as EquationRecord;
const ids = (html: string) =>
  new Set([...html.matchAll(/data-(?:term|op)="([^"]+)"/g)].map((m) => m[1]));
const signs = (tree: Expression): number =>
  tree.kind === "relation" ? 1 + signs(tree.left) + signs(tree.right) : 0;

describe("an authored row layout", () => {
  // Compiled inside each test, so a renderer that drops a marker fails an assertion (the
  // compiler refuses a formula missing any term or operation marker) instead of the file load.
  const line = () => compileEquation(CHAIN);
  const rows = () => compileEquation(withLayout(CHAIN, "rows"));

  test("the chain renders as aligned rows, one per relation sign", () => {
    expect(signs(CHAIN.tree)).toBeGreaterThanOrEqual(2);
    expect(rows().plainLatex).toStartWith("\\begin{aligned}");
    expect(rows().plainLatex).toEndWith("\\end{aligned}");
    expect(rows().plainLatex.split("\\\\").length - 1).toBe(signs(CHAIN.tree) - 1);
    expect(rows().plainLatex.split("&").length - 1).toBe(signs(CHAIN.tree));
  });

  test("the rows carry exactly the term and operation ids of the single line", () => {
    const lineIds = ids(line().html);
    expect(lineIds.size).toBeGreaterThan(0);
    expect(ids(rows().html)).toEqual(lineIds);
    // Every relation keeps its marker, now on its sign.
    for (const n of rows().navigation.filter((x) => x.id.includes(".op.relation")))
      expect(rows().html).toContain(`data-op="${n.id}"`);
  });

  test("the same MathML meaning: rows change the layout, not the terms read aloud", () => {
    const mi = (m: string) => [...m.matchAll(/<mi[^>]*>([^<]*)<\/mi>/g)].map((x) => x[1]).join(" ");
    expect(mi(rows().mathml)).toBe(mi(line().mathml));
  });

  test("no record without a layout breaks a line: every real record is one line", () => {
    let checked = 0;
    const papers = readdirSync(ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "derivations")
      .map((d) => d.name);
    for (const paper of papers) {
      for (const file of readdirSync(new URL(`${paper}/`, ROOT)).filter((f) =>
        f.endsWith(".json"),
      )) {
        const record = load(paper, file.slice(0, -5));
        if (record.kind !== "equation") continue;
        const compiled = compileEquation(record);
        checked++;
        if (record.layout === undefined) {
          expect(compiled.plainLatex).not.toContain("aligned");
          expect(compiled.plainLatex).not.toContain("\\\\");
        }
      }
    }
    // Named denominator, not a frozen census: the population is whatever the directories hold.
    expect(checked).toBeGreaterThan(100);
  });

  test("every record that declares rows renders as rows with its single line's ids", () => {
    const declared: string[] = [];
    for (const paper of readdirSync(ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "derivations")
      .map((d) => d.name))
      for (const file of readdirSync(new URL(`${paper}/`, ROOT)).filter((f) =>
        f.endsWith(".json"),
      )) {
        const record = load(paper, file.slice(0, -5));
        if (record.kind !== "equation" || record.layout === undefined) continue;
        declared.push(record.id);
        const rowsForm = compileEquation(record);
        const { layout: _rows, ...oneLine } = record;
        const lineForm = compileEquation(oneLine as EquationRecord);
        expect(rowsForm.plainLatex, record.id).toStartWith("\\begin{aligned}");
        expect(ids(rowsForm.html), record.id).toEqual(ids(lineForm.html));
      }
    // Measured on live at 320px, 2026-09-24: the mass-energy subtraction chain ran 333px in a
    // 260px explorer box and a 288px reading row, in both places it is shown.
    expect(declared).toContain("eq-model-me-ledger-subtraction-chain");
    expect(declared).toContain(CHAIN.id);
  });

  test("each relation sign in rows is the sign the single-line renderer prints", () => {
    const d = (t: string) =>
      ({
        kind: "symbol",
        termId: `eq-model-x.t.${t}`,
        quantityId: "diffusionCoefficient",
      }) as Expression;
    for (const operator of ["=", "approx", "define", "le", "ge"] as const) {
      const tree = {
        kind: "relation",
        operator,
        left: { kind: "relation", operator, left: d("a"), right: d("b") },
        right: d("c"),
      } as Expression;
      const single = expressionLatex(tree, BROWNIAN_QUANTITIES);
      const chain = relationChain(tree);
      expect(typeof chain).toBe("object");
      if (typeof chain === "string") return;
      const rowsForm = rowsLatex(chain, (e) => expressionLatex(e, BROWNIAN_QUANTITIES), false);
      const sign = single.split(" ")[1];
      expect(sign).toBeTruthy();
      expect(rowsForm.split(`\\mathrel{${sign}}`).length - 1).toBe(2);
    }
  });

  test("planted: a layout on a single relation is refused, since one relation stays one line", () => {
    expect(() => parseEquationRecord(withLayout(SINGLE, "rows"), SINGLE.id)).toThrow(
      /at least two relation signs/,
    );
  });

  test("planted: an unknown layout is refused by name", () => {
    expect(() => parseEquationRecord(withLayout(CHAIN, "columns"), CHAIN.id)).toThrow(
      /Unsupported layout "columns"/,
    );
  });

  test("planted: a chain with a relation on the right is refused", () => {
    const tree = CHAIN.tree as Extract<Expression, { kind: "relation" }>;
    const inner = tree.left as Extract<Expression, { kind: "relation" }>;
    const rightNested = {
      ...tree,
      left: inner.left,
      right: { ...inner, left: inner.right, right: tree.right },
    };
    const record = { ...CHAIN, tree: rightNested, layout: "rows" } as unknown as EquationRecord;
    expect(() => parseEquationRecord(record, CHAIN.id)).toThrow(/nested to the left/);
  });
});
