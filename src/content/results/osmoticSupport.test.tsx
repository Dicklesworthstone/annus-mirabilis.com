import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import pressureRecord from "../../../content/equations/brownian-motion/eq-model-bm-osmotic-pressure.json";
import { verifyBrownianOsmotic } from "../../equations/derivations/brownianOsmoticProof.ts";
import { type EquationRecord, parseEquationRecord } from "../../equations/record.ts";
import { BrownianOsmoticDerivation } from "../../reader/BrownianOsmoticDerivation.tsx";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { ResultCard } from "../../reader/faces/results/ResultCard.tsx";
import { checkedSupportFor } from "./checkedSupport.ts";
import { osmoticSupportAssumptions } from "./osmoticSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards } from "./resultCards.ts";

const equation = parseEquationRecord(pressureRecord, pressureRecord.id);
const loaded = loadResultCards(process.cwd(), "brownian-motion");
const card = loaded?.cards.find((record) => record.id === "bm-osmotic-pressure");

function support(source: readonly EquationRecord[] = [equation]) {
  if (!card) throw new Error("The actual osmotic-pressure result card is absent.");
  return checkedSupportFor(card, source);
}

function refusal(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof ResultCardsError) return error.rule;
    throw error;
  }
  throw new Error("Expected the supplied osmotic result to be refused.");
}

function argumentPassages() {
  if (!card) throw new Error("The actual osmotic-pressure result card is absent.");
  return new Map(
    card.arguments.map((id) => [
      id,
      JSON.parse(
        readFileSync(
          join(process.cwd(), "content/arguments/brownian-motion", `${id}.json`),
          "utf8",
        ),
      ),
    ]),
  );
}

test("the osmotic result exposes the checked volume calculation and its physical premises", () => {
  expect(loaded?.problems).toEqual([]);
  const checked = support();
  expect(checked?.proofId).toBe("bm-osmotic-volume");
  expect(checked?.conclusion.equationId).toBe(pressureRecord.id);
  expect(checked?.assumptions).toEqual(osmoticSupportAssumptions);
  expect(checked?.scope).toContain("does not prove those physical premises");
  expect(checked?.scope).toContain("interacting suspension");
  if (!card) throw new Error("The actual osmotic-pressure result card is absent.");
  expect(card.equations).toContain(pressureRecord.id);
  const projected = toCard(process.cwd(), card, argumentPassages(), undefined, undefined, [
    equation,
  ]);
  const html = renderToStaticMarkup(<ResultCard card={projected} />);
  expect(html).toContain("Why should I believe this step?");
  expect(html).toContain('href="/papers/brownian-motion/s2/#bm-osmotic-derivation"');
  expect(html).toContain("Independent placements in a homogeneous dilute suspension");
  expect(html).toContain("The remaining factor is independent of volume");
  const destination = renderToStaticMarkup(
    <BrownianOsmoticDerivation report={verifyBrownianOsmotic()} />,
  );
  expect(destination).toContain('id="bm-osmotic-derivation"');
});

test("result-support-osmotic-not-checked refuses missing, duplicate and altered premises", () => {
  expect(support()?.kind).toBe("checked-proof");
  for (const source of [
    [equation, equation],
    [{ ...equation, assumptions: ["The particles may interact."] }],
    [{ ...equation, notation: "source" }],
    [{ ...equation, unitSystem: "einstein-1905" }],
  ]) {
    expect(refusal(() => support(source as readonly EquationRecord[]))).toBe(
      "result-support-osmotic-not-checked",
    );
  }
  expect(refusal(() => support([]))).toBe("result-support-conclusion-mismatch");
  expect(refusal(() => support([{ ...equation, argument: "arg-bm-diffusivity" }]))).toBe(
    "result-support-conclusion-mismatch",
  );
});

test("result-support-osmotic-not-checked checks the supplied pressure rather than its own default", () => {
  expect(support()?.kind).toBe("checked-proof");
  if (equation.tree.kind !== "relation") throw new Error("Expected the pressure equality.");
  const wrongSign: EquationRecord = {
    ...equation,
    tree: { ...equation.tree, right: { kind: "negate", argument: equation.tree.right } },
  };
  expect(refusal(() => support([wrongSign]))).toBe("result-support-osmotic-not-checked");
  const wrongRelation: EquationRecord = {
    ...equation,
    tree: { ...equation.tree, operator: "le" },
  };
  expect(refusal(() => support([wrongRelation]))).toBe("result-support-osmotic-not-checked");
  if (!card) throw new Error("The actual osmotic-pressure result card is absent.");
  expect(
    refusal(() =>
      toCard(process.cwd(), card, argumentPassages(), undefined, undefined, [wrongSign]),
    ),
  ).toBe("result-support-osmotic-not-checked");
});

test("the osmotic support cannot stand in for the distinct diffusion-coefficient proof", () => {
  const diffusivity = loaded?.cards.find((record) => record.id === "bm-diffusion-coefficient");
  if (!diffusivity) throw new Error("The diffusion-coefficient result card is absent.");
  expect(() => checkedSupportFor(diffusivity, [equation])).toThrow(ResultCardsError);
});
