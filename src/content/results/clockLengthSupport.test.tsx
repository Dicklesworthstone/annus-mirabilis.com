import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { SR_CLOCKS_AND_LENGTHS_RECORDS } from "../../equations/derivations/srClocksAndLengths.ts";
import { parseEquationRecord } from "../../equations/record.ts";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { ResultCard } from "../../reader/faces/results/ResultCard.tsx";
import { SRClocksAndLengthsDerivation } from "../../reader/SRClocksAndLengthsDerivation.tsx";
import { checkedSupportFor } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards } from "./resultCards.ts";

const equations = Object.values(SR_CLOCKS_AND_LENGTHS_RECORDS).map((record) =>
  parseEquationRecord(record, record.id),
);
const loaded = loadResultCards(process.cwd(), "special-relativity");
const examples = [
  {
    cardId: "sr-moving-clock",
    proofId: "sr-moving-clock",
    anchor: "sr-clock-length-clock",
    premise: "One ideal clock at rest in k",
    required: ["inverseTime", "factor", "clock"],
  },
  {
    cardId: "sr-moving-rigid-body",
    proofId: "sr-simultaneous-length",
    anchor: "sr-clock-length-rod",
    premise: "Simultaneous endpoint marks in K",
    required: ["position", "factor", "length"],
  },
] as const;

test("the real result cards expose both checked measurement arguments with working reader targets", () => {
  expect(loaded?.problems).toEqual([]);
  const reader = renderToStaticMarkup(<SRClocksAndLengthsDerivation />);
  for (const example of examples) {
    const card = loaded?.cards.find((record) => record.id === example.cardId);
    if (!card) throw new Error("The actual clock or length result card is absent.");
    const passages = new Map(
      card.arguments.map((id) => [
        id,
        JSON.parse(
          readFileSync(
            join(process.cwd(), "content/arguments/special-relativity", id + ".json"),
            "utf8",
          ),
        ),
      ]),
    );
    const projected = toCard(process.cwd(), card, passages, undefined, undefined, equations);
    expect(projected.support?.kind).toBe("checked-proof");
    const html = renderToStaticMarkup(<ResultCard card={projected} />);
    expect(html).toContain('data-proof-id="' + example.proofId + '"');
    expect(html).toContain('href="/papers/special-relativity/s4/#' + example.anchor + '"');
    expect(html).toContain(example.premise);
    expect(html).toContain("Why should I believe this step?");
    expect(reader).toContain('id="' + example.anchor + '"');
  }
});

test("missing or changed maps, definitions and physical assumptions cannot earn result support", () => {
  for (const example of examples) {
    const card = loaded?.cards.find((record) => record.id === example.cardId);
    if (!card) throw new Error("The actual clock or length result card is absent.");
    expect(checkedSupportFor(card, equations)?.proofId).toBe(example.proofId);
    for (const key of example.required) {
      const id = SR_CLOCKS_AND_LENGTHS_RECORDS[key].id;
      expect(() =>
        checkedSupportFor(
          card,
          equations.filter((record) => record.id !== id),
        ),
      ).toThrow(ResultCardsError);
      expect(() =>
        checkedSupportFor(
          card,
          equations.map((record) =>
            record.id === id
              ? {
                  ...record,
                  assumptions: [...record.assumptions, "Changed measurement condition."],
                }
              : record,
          ),
        ),
      ).toThrow(ResultCardsError);
      expect(() =>
        checkedSupportFor(
          card,
          equations.map((record) =>
            record.id === id
              ? { ...record, tree: { kind: "number" as const, value: "1" } }
              : record,
          ),
        ),
      ).toThrow(ResultCardsError);
    }
  }
});
