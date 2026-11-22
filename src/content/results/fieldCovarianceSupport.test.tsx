import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import bxRecord from "../../../content/equations/special-relativity/eq-model-sr-field-bx.json";
import byRecord from "../../../content/equations/special-relativity/eq-model-sr-field-by.json";
import bzRecord from "../../../content/equations/special-relativity/eq-model-sr-field-bz.json";
import exRecord from "../../../content/equations/special-relativity/eq-model-sr-field-ex.json";
import eyRecord from "../../../content/equations/special-relativity/eq-model-sr-field-ey.json";
import ezRecord from "../../../content/equations/special-relativity/eq-model-sr-field-ez.json";
import type { Expression } from "../../equations/ast.ts";
import {
  verifySRFieldCovariance,
  verifySRFieldSIComponents,
} from "../../equations/derivations/srFieldCovariance.ts";
import type { SRFieldComponent } from "../../equations/derivations/srFieldTransforms.ts";
import { type EquationRecord, parseEquationRecord } from "../../equations/record.ts";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { ResultCard } from "../../reader/faces/results/ResultCard.tsx";
import { SRFieldDerivation } from "../../reader/SRFieldDerivation.tsx";
import { checkedSupportFor } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards } from "./resultCards.ts";

const records = [exRecord, eyRecord, ezRecord, bxRecord, byRecord, bzRecord];
const equations = records.map((record) => parseEquationRecord(record, record.id));
const components: readonly SRFieldComponent[] = ["X", "Y", "Z", "L", "M", "N"];
const rows = equations.map((record, index) => ({
  component: components[index]!,
  tree: record.tree,
}));
const loaded = loadResultCards(process.cwd(), "special-relativity");
const card = loaded?.cards.find((record) => record.id === "sr-field-transformation");

function support(source: readonly EquationRecord[] = equations) {
  if (!card) throw new Error("The actual §6 result card is absent.");
  return checkedSupportFor(card, source);
}

test("§6 links six checked field identities and retains its physical premises", () => {
  expect(loaded?.problems).toEqual([]);
  const checked = support();
  expect(checked?.proofId).toBe("sr-field-covariance");
  expect(checked?.conclusion.equationId).toBe(eyRecord.id);
  expect(checked?.scope).toContain("not conclusions of this algebra");
  expect(checked?.assumptions.map((item) => item.id)).toContain("sr-field-vacuum-divergences");
  expect(checked?.assumptions.map((item) => item.id)).toContain(
    "sr-field-identification-and-normalization",
  );
  if (!card || !checked) throw new Error("The actual result must have checked support.");
  const passages = new Map(
    card.arguments.map((id) => [
      id,
      JSON.parse(
        readFileSync(
          join(process.cwd(), "content/arguments/special-relativity", `${id}.json`),
          "utf8",
        ),
      ),
    ]),
  );
  const projected = toCard(process.cwd(), card, passages, undefined, undefined, equations);
  const html = renderToStaticMarkup(<ResultCard card={projected} />);
  expect(html).toContain("Why should I believe this step?");
  expect(html).toContain('href="/papers/special-relativity/s6/#sr-field-covariance-check"');
  expect(html).toContain("Both vacuum divergence conditions");
  expect(html).toContain("Physical identification and normalization are separate");
  const destination = renderToStaticMarkup(
    <SRFieldDerivation covarianceReport={verifySRFieldCovariance()} />,
  );
  expect(destination).toContain('id="sr-field-covariance-check"');
  expect(destination).toContain("All six changes of variables");
});

test("result-support-field-not-checked rejects missing and changed-premise components", () => {
  expect(support()?.kind).toBe("checked-proof");
  for (const record of equations) {
    expect(() => support(equations.filter((item) => item.id !== record.id))).toThrow(
      ResultCardsError,
    );
    expect(() => support([...equations, record])).toThrow(ResultCardsError);
    expect(() =>
      support(
        equations.map((item) =>
          item.id === record.id
            ? { ...item, assumptions: [...item.assumptions, "A changed physical premise."] }
            : item,
        ),
      ),
    ).toThrow(ResultCardsError);
  }
});

test("result-support-field-not-checked rejects wrong algebra in each supplied component", () => {
  expect(support()?.kind).toBe("checked-proof");
  for (const record of equations) {
    if (record.tree.kind !== "relation") throw new Error("A field component must be an equality.");
    // This remains dimensionally valid. Reversing a field cannot be rescued by a
    // title, a correct neighboring component, or an unrelated covariance report.
    const wrong: EquationRecord = {
      ...record,
      tree: { ...record.tree, right: { kind: "negate", argument: record.tree.right } },
    };
    expect(() => support(equations.map((item) => (item.id === record.id ? wrong : item)))).toThrow(
      "does not match its checked Gaussian candidate",
    );
  }
});

test("the SI bridge rejects wrong signs, units, frames and component identities", () => {
  expect(verifySRFieldSIComponents(rows)).toEqual({ passed: true, components });
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]!;
    if (row.tree.kind !== "relation" || row.tree.left.kind !== "symbol")
      throw new Error("Expected a named component equality.");
    const corruptions: Expression[] = [
      { ...row.tree, right: { kind: "negate", argument: row.tree.right } },
      {
        ...row.tree,
        right: {
          kind: "product",
          args: [row.tree.right, { kind: "symbol", termId: "c", quantityId: "speedOfLight" }],
        },
      },
      { ...row.tree, operator: "approx" },
      { ...row.tree, left: { kind: "number", value: "0" } },
      { ...row.tree, left: { ...row.tree.left, index: "not-a-field-axis" } },
      {
        ...row.tree,
        left: { ...row.tree.left, quantityId: "electricFieldStationary" },
      },
    ];
    for (const tree of corruptions)
      expect(
        verifySRFieldSIComponents(
          rows.map((item, at) => (at === index ? { ...item, tree } : item)),
        ).passed,
      ).toBe(false);
  }
  expect(verifySRFieldSIComponents(rows.slice(1)).passed).toBe(false);
  expect(verifySRFieldSIComponents([...rows].reverse()).passed).toBe(false);
  expect(verifySRFieldSIComponents([...rows.slice(0, -1), rows[0]!]).passed).toBe(false);
});

test("the SI bridge accepts algebraically equivalent sums", () => {
  const equivalent = rows.map((row) => {
    if (row.tree.kind !== "relation") throw new Error("Expected an equality.");
    return {
      ...row,
      tree: {
        ...row.tree,
        right: {
          kind: "sum" as const,
          args: [{ kind: "number" as const, value: "0" }, row.tree.right],
        },
      },
    };
  });
  expect(verifySRFieldSIComponents(equivalent).passed).toBe(true);
  expect(
    support(equations.map((record, index) => ({ ...record, tree: equivalent[index]!.tree })))?.kind,
  ).toBe("checked-proof");
});
