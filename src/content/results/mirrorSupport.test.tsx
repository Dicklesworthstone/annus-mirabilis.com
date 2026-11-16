import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import aberrationRecord from "../../../content/equations/special-relativity/eq-model-sr-aberration.json";
import dopplerRecord from "../../../content/equations/special-relativity/eq-model-sr-doppler-factor.json";
import mirrorRecord from "../../../content/equations/special-relativity/eq-model-sr-mirror-frequency.json";
import { parseEquationRecord } from "../../equations/record.ts";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { ResultCard } from "../../reader/faces/results/ResultCard.tsx";
import { checkedSupportFor } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards } from "./resultCards.ts";

const records = [dopplerRecord, aberrationRecord, mirrorRecord];
const equations = records.map((record) => parseEquationRecord(record, record.id));
const loaded = loadResultCards(process.cwd(), "special-relativity");
const card = loaded?.cards.find((record) => record.id === "sr-moving-mirror");

test("the real moving-mirror card exposes its reflection and energy proof with bounded premises", () => {
  expect(loaded?.problems).toEqual([]);
  expect(card).toBeDefined();
  if (!card) throw new Error("The actual moving-mirror result card is absent.");
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
  expect(html).toContain("Why should I believe this step?");
  expect(html).toContain('href="/papers/special-relativity/s8/#sr-mirror-derivation"');
  expect(html).toContain("The light reaches a subluminal mirror");
  expect(html).toContain("Energy crossing the moving surface");
  expect(html).toContain("A separate continuity premise at rest");
  expect(html).toContain("b ≠ 0");
});

test("changed wave inputs or canonical reflection equations cannot retain checked support", () => {
  if (!card) throw new Error("The actual moving-mirror result card is absent.");
  expect(checkedSupportFor(card, equations)?.proofId).toBe("sr-moving-mirror");
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
  const canonical = equations.find((record) => record.id === mirrorRecord.id)!;
  if (canonical.tree.kind !== "relation" || canonical.tree.left.kind !== "quotient")
    throw new Error("The mirror record must compare reflected and incident frequencies.");
  const ratio = canonical.tree.left;
  const reversed = {
    ...canonical,
    tree: {
      ...canonical.tree,
      left: { ...ratio, numerator: ratio.denominator, denominator: ratio.numerator },
    },
  };
  expect(() =>
    checkedSupportFor(
      card,
      equations.map((item) => (item.id === canonical.id ? reversed : item)),
    ),
  ).toThrow(ResultCardsError);
  const direction = equations.find((record) => record.id === aberrationRecord.id)!;
  if (direction.tree.kind !== "relation")
    throw new Error("The aberration input must be a relation.");
  const changedDirection = {
    ...direction,
    tree: { ...direction.tree, right: { kind: "number" as const, value: "1" } },
  };
  expect(() =>
    checkedSupportFor(
      card,
      equations.map((item) => (item.id === direction.id ? changedDirection : item)),
    ),
  ).toThrow(ResultCardsError);
});
