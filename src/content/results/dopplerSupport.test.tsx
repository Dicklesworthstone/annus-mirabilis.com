import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import aberrationRecord from "../../../content/equations/special-relativity/eq-model-sr-aberration.json";
import factorRecord from "../../../content/equations/special-relativity/eq-model-sr-doppler-factor.json";
import ratioRecord from "../../../content/equations/special-relativity/eq-model-sr-doppler-ratio.json";
import inversePositionRecord from "../../../content/equations/special-relativity/eq-model-sr-inverse-position.json";
import inverseTimeRecord from "../../../content/equations/special-relativity/eq-model-sr-inverse-time.json";
import { parseEquationRecord } from "../../equations/record.ts";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { ResultCard } from "../../reader/faces/results/ResultCard.tsx";
import { checkedSupportFor } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards } from "./resultCards.ts";

const records = [
  inversePositionRecord,
  inverseTimeRecord,
  factorRecord,
  ratioRecord,
  aberrationRecord,
];
const equations = records.map((record) => parseEquationRecord(record, record.id));
const loaded = loadResultCards(process.cwd(), "special-relativity");
const card = loaded?.cards.find((record) => record.id === "sr-doppler-aberration");

test("the real result card exposes the complete phase proof and its independent premises", () => {
  expect(loaded?.problems).toEqual([]);
  expect(card).toBeDefined();
  if (!card) throw new Error("The actual Doppler result card is absent.");
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
  expect(projected.support?.kind).toBe("checked-proof");
  const html = renderToStaticMarkup(<ResultCard card={projected} />);
  expect(html).toContain("Why should I believe this step?");
  expect(html).toContain('href="/papers/special-relativity/s7/#sr-doppler-derivation"');
  expect(html).toContain("Equality at all events, not just on a ray");
  expect(html).toContain("positive frequency and a subluminal frame");
  expect(html).toContain("field-amplitude");
});

test("missing or changed maps, frequency definitions and direction equations cannot earn support", () => {
  if (!card) throw new Error("The actual Doppler result card is absent.");
  expect(checkedSupportFor(card, equations)?.proofId).toBe("sr-doppler-phase");
  for (const record of equations) {
    expect(() =>
      checkedSupportFor(
        card,
        equations.filter((item) => item.id !== record.id),
      ),
    ).toThrow(ResultCardsError);
    expect(() =>
      checkedSupportFor(
        card,
        equations.map((item) =>
          item.id === record.id
            ? { ...item, assumptions: [...item.assumptions, "A changed physical premise."] }
            : item,
        ),
      ),
    ).toThrow(ResultCardsError);
  }
  const cosine = equations.find((record) => record.id === aberrationRecord.id)!;
  if (cosine.tree.kind !== "relation") throw new Error("The aberration record must be a relation.");
  const wrongDirection = {
    ...cosine,
    tree: { ...cosine.tree, right: { kind: "number" as const, value: "1" } },
  };
  expect(() =>
    checkedSupportFor(
      card,
      equations.map((item) => (item.id === cosine.id ? wrongDirection : item)),
    ),
  ).toThrow(ResultCardsError);
});
