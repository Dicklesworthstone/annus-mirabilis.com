import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { SR_SIMULTANEITY_RECORDS } from "../../equations/derivations/srSimultaneity.ts";
import { parseEquationRecord } from "../../equations/record.ts";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { ResultCard } from "../../reader/faces/results/ResultCard.tsx";
import { checkedSupportFor } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards } from "./resultCards.ts";

const equations = Object.values(SR_SIMULTANEITY_RECORDS).map((record) =>
  parseEquationRecord(record, record.id),
);
const loaded = loadResultCards(process.cwd(), "special-relativity");
const card = loaded?.cards.find((record) => record.id === "sr-relativity-of-simultaneity");
if (!card) throw new Error("Missing the actual relativity-of-simultaneity result.");

test("the actual result card joins the exact signed-offset owner with its admitted map and limited scope", () => {
  expect(loaded?.problems).toEqual([]);
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
  const support = projected.support;
  expect(support?.kind).toBe("checked-proof");
  if (support?.kind !== "checked-proof") throw new Error("Missing exact simultaneity support.");
  expect(support.proofId).toBe("sr-simultaneity-offset");
  expect(support.conclusion.equationId).toBe("eq-model-sr-simultaneity-offset");
  expect(support.scope).toContain("not the earlier §2 light-chase derivation");
  expect(support.scope).toContain("zero speed and zero longitudinal separation");
  for (const premise of [
    "arg-sr-lorentz-map",
    "sr-simultaneity-inertial-domain",
    "sr-simultaneity-ordered-event-differences",
    "sr-simultaneity-equal-stationary-times",
  ])
    expect(support.assumptions.map((item) => item.id)).toContain(premise);
  const html = renderToStaticMarkup(<ResultCard card={projected} />);
  expect(html).toContain('data-proof-id="sr-simultaneity-offset"');
  expect(html).toContain('href="/papers/special-relativity/s2/#sr-simultaneity-derivation"');
  expect(html).toContain("The time transformation is already admitted");
  expect(html).toContain("Why should I believe this step?");
  expect(JSON.parse(JSON.stringify(support))).toEqual(support);
});

test("missing, duplicate or changed canonical inputs never inherit checked support", () => {
  expect(checkedSupportFor(card, equations)?.proofId).toBe("sr-simultaneity-offset");
  for (const record of equations) {
    expect(() =>
      checkedSupportFor(
        card,
        equations.filter((item) => item.id !== record.id),
      ),
    ).toThrow(ResultCardsError);
    expect(() => checkedSupportFor(card, [...equations, record])).toThrow(ResultCardsError);
    for (const changed of [
      { ...record, argument: "arg-sr-lorentz-map-changed" },
      { ...record, assumptions: [...record.assumptions, "A changed measurement condition."] },
      { ...record, tree: { kind: "number" as const, value: "1" } },
    ])
      expect(() =>
        checkedSupportFor(
          card,
          equations.map((item) => (item.id === record.id ? changed : item)),
        ),
      ).toThrow(ResultCardsError);
  }
});
