import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { brownianKernelRecords } from "../../equations/derivations/brownianKernel.ts";
import { type EquationRecord, parseEquationRecord } from "../../equations/record.ts";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { ResultCard } from "../../reader/faces/results/ResultCard.tsx";
import { checkedSupportFor } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards } from "./resultCards.ts";

const loaded = loadResultCards(process.cwd(), "brownian-motion");
const fixtures = [
  {
    id: "bm-diffusion-equation",
    proofId: "bm-kernel-diffusion",
    conclusion: "eq-model-bm-diffusion-equation",
    href: "/papers/brownian-motion/s4/#bm-kernel-checked-calculus",
    records: brownianKernelRecords.map((record) => parseEquationRecord(record, record.id)),
  },
] as const;

function card(id: string) {
  const found = loaded?.cards.find((record) => record.id === id);
  if (!found) throw new Error(`The actual Brownian result card ${id} is absent.`);
  return found;
}

for (const fixture of fixtures) {
  test(`${fixture.id} connects the actual Results card to its scoped source calculation`, () => {
    expect(loaded?.problems).toEqual([]);
    const record = card(fixture.id);
    const checked = checkedSupportFor(record, fixture.records);
    expect(checked?.proofId).toBe(fixture.proofId);
    expect(checked?.conclusion.equationId).toBe(fixture.conclusion);
    expect(checked?.href).toBe(fixture.href);
    expect(checked?.assumptions.length).toBeGreaterThan(0);
    const passages = new Map(
      record.arguments.map((id) => [
        id,
        JSON.parse(
          readFileSync(
            join(process.cwd(), "content/arguments/brownian-motion", `${id}.json`),
            "utf8",
          ),
        ),
      ]),
    );
    const html = renderToStaticMarkup(
      <ResultCard
        card={toCard(process.cwd(), record, passages, undefined, undefined, fixture.records)}
      />,
    );
    expect(html).toContain(`href="${fixture.href}"`);
    expect(html).toContain("Why should I believe this step?");
  });

  test(`${fixture.id} checks every supplied equation tree instead of crediting untouched imports`, () => {
    const record = card(fixture.id);
    for (const premise of fixture.records) {
      if (premise.tree.kind !== "relation")
        throw new Error("The source equation must be a relation.");
      const corrupted: EquationRecord = {
        ...premise,
        tree: { ...premise.tree, right: { kind: "negate", argument: premise.tree.right } },
      };
      expect(() =>
        checkedSupportFor(
          record,
          fixture.records.map((item) => (item.id === premise.id ? corrupted : item)),
        ),
      ).toThrow(ResultCardsError);
    }
  });
}

function rejectChangedPremises(fixture: (typeof fixtures)[number]) {
  const record = card(fixture.id);
  expect(checkedSupportFor(record, fixture.records)).toBeDefined();
  for (const premise of fixture.records) {
    expect(() =>
      checkedSupportFor(
        record,
        fixture.records.filter((item) => item.id !== premise.id),
      ),
    ).toThrow(ResultCardsError);
    expect(() => checkedSupportFor(record, [...fixture.records, premise])).toThrow(
      ResultCardsError,
    );
    const changed = fixture.records.map((item) =>
      item.id === premise.id
        ? { ...item, assumptions: ["A different physical or mathematical premise."] }
        : item,
    );
    expect(() => checkedSupportFor(record, changed)).toThrow(ResultCardsError);
  }
}

test("result-support-kernel-not-checked rejects absent, duplicate and changed premises", () => {
  rejectChangedPremises(fixtures[0]);
});

test("Brownian Results support retains the admitted convergence and finite-step qualifications", () => {
  const kernel = checkedSupportFor(card("bm-diffusion-equation"), fixtures[0].records);
  expect(kernel?.scope).toContain("convergence");
  expect(kernel?.scope).toContain("finite-step");
});
