import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  brownianGaussianAssumptions,
  brownianGaussianRecords,
} from "../../equations/derivations/brownianGaussian.ts";
import { verifyBrownianGaussian } from "../../equations/derivations/brownianGaussianProof.ts";
import { type EquationRecord, parseEquationRecord } from "../../equations/record.ts";
import { BrownianGaussianDerivation } from "../../reader/BrownianGaussianDerivation.tsx";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { ResultCard } from "../../reader/faces/results/ResultCard.tsx";
import { checkedSupportFor } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards } from "./resultCards.ts";

const equations = brownianGaussianRecords.map((record) => parseEquationRecord(record, record.id));
const loaded = loadResultCards(process.cwd(), "brownian-motion");
const card = loaded?.cards.find((record) => record.id === "bm-displacement-law");

function support(source: readonly EquationRecord[] = equations) {
  if (!card) throw new Error("The actual displacement result card is absent.");
  return checkedSupportFor(card, source);
}

test("the displacement result links the Gaussian calculation to its RMS conclusion", () => {
  expect(loaded?.problems).toEqual([]);
  const checked = support();
  expect(checked?.proofId).toBe("bm-gaussian-displacement");
  expect(checked?.conclusion.equationId).toBe("eq-model-bm-rms-from-mean-square");
  expect(checked?.assumptions).toEqual(brownianGaussianAssumptions);
  expect(checked?.scope).toContain("does not derive the diffusion approximation");
  expect(checked?.scope).toContain("three-dimensional extension");
  if (!card) throw new Error("The actual displacement result card is absent.");
  const passages = new Map(
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
  const projected = toCard(process.cwd(), card, passages, undefined, undefined, equations);
  const html = renderToStaticMarkup(<ResultCard card={projected} />);
  expect(html).toContain("Why should I believe this step?");
  expect(html).toContain('href="/papers/brownian-motion/s4/#bm-gaussian-derivation"');
  expect(html).toContain("The Gaussian area identity");
  expect(html).toContain("Gaussian integrability and vanishing end terms");
  const destination = renderToStaticMarkup(
    <BrownianGaussianDerivation report={verifyBrownianGaussian()} />,
  );
  expect(destination).toContain('id="bm-gaussian-derivation"');
  expect(destination).toContain('data-gaussian-proof="checked"');
});

test("result-support-gaussian-not-checked rejects missing, duplicate and changed premises", () => {
  expect(support()?.kind).toBe("checked-proof");
  for (const record of equations) {
    expect(() => support(equations.filter((item) => item.id !== record.id))).toThrow(
      ResultCardsError,
    );
    expect(() => support([...equations, record])).toThrow(ResultCardsError);
    expect(() =>
      support(
        equations.map((item) =>
          item.id === record.id ? { ...item, assumptions: ["Different domain."] } : item,
        ),
      ),
    ).toThrow(ResultCardsError);
  }
});

test("result-support-gaussian-not-checked evaluates each supplied conclusion tree", () => {
  expect(support()?.kind).toBe("checked-proof");
  for (const record of equations) {
    if (record.tree.kind !== "relation") throw new Error("Expected a Gaussian equality.");
    const changed: EquationRecord = {
      ...record,
      tree: { ...record.tree, right: { kind: "negate", argument: record.tree.right } },
    };
    expect(() =>
      support(equations.map((item) => (item.id === record.id ? changed : item))),
    ).toThrow(ResultCardsError);
  }
});

test("Gaussian support cannot substitute for the jump-law or historical prediction calculation", () => {
  const diffusion = loaded?.cards.find((record) => record.id === "bm-diffusion-equation");
  if (!diffusion) throw new Error("The separate diffusion result card is absent.");
  expect(diffusion.support.kind).toBe("checked-proof");
  expect(() => checkedSupportFor(diffusion, equations)).toThrow(ResultCardsError);
  const historical = loaded?.cards.find((record) => record.id === "bm-predicted-displacement");
  if (!historical) throw new Error("The historical displacement result card is absent.");
  expect(historical.support.kind).toBe("checked-proof");
  expect(() => checkedSupportFor(historical, equations)).toThrow(ResultCardsError);
});
