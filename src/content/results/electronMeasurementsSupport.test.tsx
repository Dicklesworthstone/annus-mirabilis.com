import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  srElectronMeasurementChains,
  srElectronMeasurementPremises,
  srElectronMeasurementRecords,
} from "../../equations/derivations/srElectronMeasurements.ts";
import {
  verifySRElectronMeasurementRoute,
  verifySRElectronMeasurements,
} from "../../equations/derivations/srElectronMeasurementsProof.ts";
import { parseEquationRecord } from "../../equations/record.ts";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { ResultCard } from "../../reader/faces/results/ResultCard.tsx";
import { PaperPage } from "../../reader/PaperPage.tsx";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { checkedResultChains, checkedSupportFor } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards } from "./resultCards.ts";

const equations = srElectronMeasurementRecords.map((record) =>
  parseEquationRecord(record, record.id),
);
const loaded = loadResultCards(process.cwd(), "special-relativity");
const card = loaded!.cards.find((record) => record.id === "sr-electron-laws")!;

test("the actual electron-laws result exposes every measured consequence and its premises", () => {
  expect(loaded?.problems).toEqual([]);
  expect(card).toBeDefined();
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
  if (support?.kind !== "checked-proof")
    throw new Error("The measurement argument has no support.");
  expect(support.proofId).toBe("sr-electron-measurements");
  expect(support.conclusion.equationId).toBe("eq-model-sr-magnetic-radius");
  expect(support.href).toBe("/papers/special-relativity/s10/#sr-electron-measurements-derivation");
  expect(support.scope).toContain("Gaussian printed relations and SI forms remain distinct");
  expect(support.scope).toContain("positive speed below c");
  expect(support.scope).toContain("not experimental confirmation");
  expect(support.scope).toContain("does not establish rest energy");
  expect(srElectronMeasurementChains.length).toBeGreaterThan(0);
  expect(checkedResultChains(support.proofId)).toEqual(srElectronMeasurementChains);
  for (const premise of srElectronMeasurementPremises)
    expect(support.assumptions.map((item) => item.id)).toContain(premise.id);
  const html = renderToStaticMarkup(<ResultCard card={projected} />);
  expect(html).toContain('data-proof-id="sr-electron-measurements"');
  expect(html).toContain(
    'href="/papers/special-relativity/s10/#sr-electron-measurements-derivation"',
  );
  expect(JSON.parse(JSON.stringify(support))).toEqual(support);
});

test("a missing, repeated or altered input cannot inherit checked electron consequences", () => {
  expect(checkedSupportFor(card, equations)?.proofId).toBe("sr-electron-measurements");
  for (const record of equations) {
    expect(() =>
      checkedSupportFor(
        card,
        equations.filter((item) => item.id !== record.id),
      ),
    ).toThrow(ResultCardsError);
    expect(() => checkedSupportFor(card, [...equations, record])).toThrow(ResultCardsError);
    for (const changed of [
      { ...record, argument: "arg-sr-inverse-map" },
      // Exercise a supplied object that bypassed the canonical record parser.
      { ...record, unitSystem: "gaussian" } as unknown as typeof record,
      { ...record, notation: "historical" } as unknown as typeof record,
      { ...record, assumptions: [...record.assumptions, "Radiation is always negligible."] },
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

test("registered premises are immutable and altered or incomplete routes cannot pass", () => {
  for (const chain of srElectronMeasurementChains) {
    expect(chain.entryAssumptions.length).toBeGreaterThan(0);
    expect(Object.isFrozen(chain)).toBe(true);
    expect(Object.isFrozen(chain.entryAssumptions)).toBe(true);
    expect(Reflect.set(chain, "entryAssumptions", [])).toBe(false);
    expect(
      verifySRElectronMeasurements({ ...structuredClone(chain), entryAssumptions: [] }).passed,
    ).toBe(false);
  }
  expect(verifySRElectronMeasurementRoute(srElectronMeasurementChains.slice(1)).passed).toBe(false);
  expect(verifySRElectronMeasurementRoute([...srElectronMeasurementChains].reverse()).passed).toBe(
    false,
  );
  expect(checkedSupportFor(card, equations)?.proofId).toBe("sr-electron-measurements");
});

test("the complete section renders the measured laws and the full paper links to them", async () => {
  const section = await exportMarkup(
    await PaperPage({ paperId: "special-relativity", section: "s10" }),
  );
  expect(section).toContain('id="sr-electron-measurements-derivation"');
  for (const chain of srElectronMeasurementChains)
    for (const step of chain.steps) expect(section).toContain('data-step-id="' + step.id + '"');
  const paper = await exportMarkup(await PaperPage({ paperId: "special-relativity" }));
  expect(paper).toContain(
    'href="/papers/special-relativity/s10/#sr-electron-measurements-derivation"',
  );
}, 15000);
