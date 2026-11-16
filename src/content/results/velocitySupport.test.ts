import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import inverseTimeRecord from "../../../content/equations/special-relativity/eq-model-sr-inverse-time.json";
import positionRecord from "../../../content/equations/special-relativity/eq-model-sr-map-position.json";
import timeRecord from "../../../content/equations/special-relativity/eq-model-sr-map-time.json";
import longitudinalRecord from "../../../content/equations/special-relativity/eq-model-sr-composed-velocity-x.json";
import transverseRecord from "../../../content/equations/special-relativity/eq-model-sr-composed-velocity-y.json";
import { parseEquationRecord } from "../../equations/record.ts";
import { checkedSupportFor } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import type { ResultCardRecord } from "./resultCards.ts";

const equations = [positionRecord, timeRecord, inverseTimeRecord, longitudinalRecord, transverseRecord]
  .map((record) => parseEquationRecord(record, record.id));
const card: Pick<ResultCardRecord, "id" | "paper" | "arguments" | "support"> = {
  id: "sr-velocity-addition",
  paper: "special-relativity",
  arguments: ["arg-sr-velocity-composition"],
  support: {
    kind: "checked-proof",
    proofId: "sr-velocity-composition",
    conclusion: longitudinalRecord.id,
    scope: "The two component laws follow conditionally from the admitted coordinate map; broader speed and composition claims are separate.",
  },
};

test("the real canonical equation corpus earns support from both checked velocity routes", () => {
  const result = checkedSupportFor(card, equations);
  expect(result?.proofId).toBe("sr-velocity-composition");
  expect(result?.href).toBe("/papers/special-relativity/s5/#sr-velocity-derivation");
  expect(result?.conclusion.equationId).toBe(longitudinalRecord.id);
  expect(result?.assumptions.some((premise) => premise.id === "sr-velocity-nonzero-elapsed-time")).toBe(true);
  expect(result?.assumptions.some((premise) => premise.explanation.includes("eta = y"))).toBe(true);
});

test("missing or changed source maps, component equations and assumptions lose checked support", () => {
  for (const id of [positionRecord.id, timeRecord.id, inverseTimeRecord.id, longitudinalRecord.id, transverseRecord.id]) {
    expect(() => checkedSupportFor(card, equations.filter((record) => record.id !== id))).toThrow(ResultCardsError);
    const changed = equations.map((record) => record.id === id
      ? { ...record, assumptions: [...record.assumptions, "A different physical premise."] }
      : record);
    expect(() => checkedSupportFor(card, changed)).toThrow(ResultCardsError);
  }
});

test("the source-direction proof cannot be relabeled as the reverse-direction equation", () => {
  const support = card.support;
  assert(support.kind === "checked-proof");
  expect(() => checkedSupportFor({
    ...card,
    support: { ...support, conclusion: "eq-model-sr-velocity-x" },
  }, equations)).toThrow(ResultCardsError);
});
