import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import factorRecord from "../../../content/equations/special-relativity/eq-model-sr-lorentz-factor.json";
import positionRecord from "../../../content/equations/special-relativity/eq-model-sr-map-position.json";
import timeRecord from "../../../content/equations/special-relativity/eq-model-sr-map-time.json";
import {
  srCoordinateConstructionChains,
  srCoordinateConstructionPremises,
  verifySRCoordinateConstruction,
  verifySRCoordinateSource,
} from "../../equations/derivations/srCoordinateSourceProof.ts";
import type { PremiseRef } from "../../equations/derivations/types.ts";
import { parseEquationRecord } from "../../equations/record.ts";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { ResultCard } from "../../reader/faces/results/ResultCard.tsx";
import { PaperPage } from "../../reader/PaperPage.tsx";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { checkedResultChains, checkedSupportFor } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards } from "./resultCards.ts";

const equations = [timeRecord, positionRecord, factorRecord].map((record) =>
  parseEquationRecord(record, record.id),
);
const loaded = loadResultCards(process.cwd(), "special-relativity");
const card = loaded!.cards.find((record) => record.id === "sr-transformation-equations")!;

test("the actual coordinate result joins all source stages, three canonical records and the explicit conditional scope", () => {
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
  if (support?.kind !== "checked-proof") return;
  expect(support.proofId).toBe("sr-coordinate-construction");
  expect(support.conclusion.equationId).toBe("eq-model-sr-map-time");
  expect(support.scope).toContain("All four coordinates");
  expect(support.scope).toContain("only within the admitted linear ansatz");
  expect(support.scope).toContain("arbitrary real event coordinates and v = 0");
  expect(support.scope).toContain("The modern linear reconstruction is a separate route");
  expect(support.scope).toContain("do not establish historical fidelity");
  for (const premise of srCoordinateConstructionPremises)
    expect(support.assumptions.map((item) => item.id)).toContain(premise.id);
  expect(checkedResultChains(support.proofId)).toEqual(srCoordinateConstructionChains);
  const html = renderToStaticMarkup(<ResultCard card={projected} />);
  expect(html).toContain('data-proof-id="sr-coordinate-construction"');
  expect(html).toContain('href="/papers/special-relativity/s3/#sr-coordinate-construction-check"');
  expect(html).toContain("Linearity is admitted from homogeneity");
  expect(html).toContain("Reciprocity alone does not set either scale to one.");
  expect(JSON.parse(JSON.stringify(support))).toEqual(support);
});

test("missing, repeated, changed or opposite-frame canonical inputs cannot inherit construction support", () => {
  expect(checkedSupportFor(card, equations)?.proofId).toBe("sr-coordinate-construction");
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
      { ...record, assumptions: [...record.assumptions, "Assume every event time is positive."] },
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

test("the real registry refuses a cross-stage dependency cycle even when every stage passes separately", () => {
  const first = srCoordinateConstructionChains[0]!.steps[0]! as {
    premiseRefs: readonly PremiseRef[];
  };
  const original = first.premiseRefs;
  const later = srCoordinateConstructionChains[1]!.steps[0]!;
  try {
    // Plant a future premise in the actual authored owner, not a separately supplied fixture.
    // Each local graph sees an external input; only the assembled source route closes the cycle.
    first.premiseRefs = [...original, { ref: later.id, edgeType: "historical-derivation" }];
    expect(
      srCoordinateConstructionChains.every((chain) => verifySRCoordinateSource(chain).passed),
    ).toBe(true);
    const report = verifySRCoordinateConstruction();
    expect(report.passed).toBe(false);
    expect(report.errors.some((error) => error.includes("cyclic"))).toBe(true);
    expect(() => checkedSupportFor(card, equations)).toThrow(ResultCardsError);
  } finally {
    first.premiseRefs = original;
  }
  expect(checkedSupportFor(card, equations)?.proofId).toBe("sr-coordinate-construction");
});

test("the real section delivers the source proof before hydration and the full paper links to it", async () => {
  const section = await exportMarkup(
    await PaperPage({ paperId: "special-relativity", section: "s3" }),
  );
  expect(section.includes('id="sr-coordinate-construction-check"')).toBe(true);
  expect(section.includes('data-coordinate-proof="checked"')).toBe(true);
  expect(section.includes('id="sr-coordinate-source-transverse-flight"')).toBe(true);
  expect(section.includes('id="sr-coordinate-source-rod-isotropy"')).toBe(true);
  expect(
    section.includes(
      "All 42 source-route steps pass exact checks within the admitted linear ansatz.",
    ),
  ).toBe(true);
  const paper = await exportMarkup(await PaperPage({ paperId: "special-relativity" }));
  expect(paper.includes('href="/papers/special-relativity/s3/#sr-coordinate-derivation"')).toBe(
    true,
  );
}, 15000);
