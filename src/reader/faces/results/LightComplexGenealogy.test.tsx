import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadConnections } from "../../../content/connections/connections.ts";
import { checkedSupportFor } from "../../../content/results/checkedSupport.ts";
import { buildLightComplexGenealogy } from "../../../content/results/lightComplexGenealogy.ts";
import { ResultCardsError } from "../../../content/results/printedChecks.ts";
import { loadResultCards } from "../../../content/results/resultCards.ts";
import { srLightComplexDerivation } from "../../../equations/derivations/srLightComplex.ts";
import { parseEquationRecord } from "../../../equations/record.ts";
import { ResultsFace } from "../ResultsFace.tsx";
import { toCard } from "./fromRecords.ts";
import { LightComplexGenealogy } from "./LightComplexGenealogy.tsx";

const root = process.cwd();
const paper = "special-relativity";
const directory = join(root, "content/equations", paper);
const equations = readdirSync(directory)
  .filter((name) => name.endsWith(".json"))
  .map((name) =>
    parseEquationRecord(JSON.parse(readFileSync(join(directory, name), "utf8")), name),
  );
const records = loadResultCards(root, paper);
const record = records?.cards.find((card) => card.id === "sr-light-complex-energy");
if (!record) throw new Error("The light-complex result must exist.");
const support = checkedSupportFor(record, equations);
if (!support) throw new Error("The light-complex result must have checked support.");
const connections = loadConnections(root);

const passages = new Map(
  record.arguments.map((id) => {
    const passage = JSON.parse(
      readFileSync(join(root, "content/arguments", paper, id + ".json"), "utf8"),
    ) as { limitations: string[] };
    return [id, passage] as const;
  }),
);
const card = toCard(root, record, passages, undefined, connections, equations);

describe("the checked light-complex genealogy reaches the results reader", () => {
  test("joins both physical factors to the exact combination and recorded derived import", () => {
    expect(records?.problems).toEqual([]);
    const route = buildLightComplexGenealogy(support, connections);
    expect(route.density.id).toBe("sr-light-complex-density-factor");
    expect(route.volume.id).toBe("sr-light-complex-moving-volume");
    expect(route.combination.id).toBe("sr-light-complex-combine-factors");
    expect(route.frequency.id).toBe("sr-light-complex-same-frequency-factor");
    expect(route.importedUse.href).toBe(
      "/papers/mass-energy/view/results/#result-me-light-energy-transformation",
    );
    for (const step of [route.density, route.volume, route.combination, route.frequency]) {
      const owner = srLightComplexDerivation.steps.find((candidate) => candidate.id === step.id);
      expect(owner).toBeDefined();
      expect(step.summary).toBe(owner?.reasons.r0);
      expect(step.href).toBe("/papers/special-relativity/s8/#" + step.id);
      expect(step.sourceHref).toBe("/papers/special-relativity/s8/#" + owner?.sourceAnchor);
    }
  });

  test("a cited formula is not a dependency if it is only a cross-reference", () => {
    const chain = {
      ...srLightComplexDerivation,
      steps: srLightComplexDerivation.steps.map((step) =>
        step.id === "sr-light-complex-density-factor"
          ? {
              ...step,
              premiseRefs: step.premiseRefs.map((premise) =>
                premise.ref === "eq-model-sr-light-density"
                  ? { ...premise, edgeType: "cross-reference" as const }
                  : premise,
              ),
            }
          : step,
      ),
    };
    expect(() => buildLightComplexGenealogy(support, connections, chain)).toThrow(
      "no supported step sr-light-complex-density-factor",
    );
  });

  test("truncating the derivation cannot leave a plausible-looking route", () => {
    expect(() =>
      buildLightComplexGenealogy(support, connections, {
        ...srLightComplexDerivation,
        steps: srLightComplexDerivation.steps.slice(0, -1),
      }),
    ).toThrow();
  });

  test("the imported postulates and a later resemblance cannot replace the derived formula", () => {
    expect(() =>
      buildLightComplexGenealogy(
        support,
        connections.filter((connection) => connection.id !== "energy-transformation"),
      ),
    ).toThrow("recorded September import");
    let refusal: unknown;
    try {
      buildLightComplexGenealogy(
        { ...support, conclusion: { ...support.conclusion, equationId: "eq-model-sr-map-time" } },
        connections,
      );
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toBeInstanceOf(ResultCardsError);
    if (!(refusal instanceof ResultCardsError)) throw new Error("Expected a typed result refusal.");
    expect(refusal.rule).toBe("result-genealogy-unresolved");
    expect(refusal.message).toContain("checked light-complex route and conclusion");
  });

  test("the actual results face publishes the route and every action is a static link", () => {
    const html = renderToStaticMarkup(createElement(ResultsFace, { paper, cards: [card] }));
    expect(html).toContain('href="#light-complex-genealogy"');
    expect(html).toContain('id="light-complex-genealogy"');
    expect(html).toContain('data-genealogy-import="mass-energy"');
    expect(html).toContain('href="/papers/mass-energy/view/results/#result-me-two-balances"');
    expect(html).toContain(
      'href="/papers/mass-energy/view/results/#result-me-kinetic-energy-drop"',
    );
    const route = renderToStaticMarkup(createElement(LightComplexGenealogy, { support }));
    expect(route).toContain('href="/papers/special-relativity/s8/#sr-light-complex-moving-volume"');
    expect(route).not.toContain("<button");
    expect(route).not.toContain("<input");
  });

  test("the September results link back to the route that supplies their imported formula", () => {
    const imported = loadResultCards(root, "mass-energy")?.cards.find(
      (candidate) => candidate.id === "me-light-energy-transformation",
    );
    if (!imported) throw new Error("The September import card must exist.");
    const importedPassages = new Map(
      imported.arguments.map((id) => {
        const passage = JSON.parse(
          readFileSync(join(root, "content/arguments/mass-energy", id + ".json"), "utf8"),
        ) as { limitations: string[] };
        return [id, passage] as const;
      }),
    );
    const importedCard = toCard(root, imported, importedPassages, undefined, connections);
    const html = renderToStaticMarkup(
      createElement(ResultsFace, { paper: "mass-energy", cards: [importedCard] }),
    );
    expect(html).toContain(
      'href="/papers/special-relativity/view/results/#light-complex-genealogy"',
    );
    expect(html).not.toContain('data-result-genealogy="sr-light-complex-energy"');
  });

  test("a familiar result id without checked support cannot acquire the genealogy", () => {
    const html = renderToStaticMarkup(
      createElement(ResultsFace, { paper, cards: [{ ...card, support: undefined }] }),
    );
    expect(html).not.toContain('id="light-complex-genealogy"');
  });
});
