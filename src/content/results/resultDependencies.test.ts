import { describe, expect, test } from "bun:test";
import { premiseEdgesForGenealogy } from "../../equations/derivations/hooks.ts";
import { resultCardsFor } from "../../reader/faces/results/fromRecords.ts";
import { paperEquations } from "../../reader/paperEquations.ts";
import { loadConnections } from "../connections/connections.ts";
import { loadPaper } from "../server.ts";
import { checkedResultChains } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards } from "./resultCards.ts";
import {
  buildResultDependencies,
  type ResultDependency,
  resultDependenciesFor,
} from "./resultDependencies.ts";

const PAPERS = ["brownian-motion", "special-relativity", "light-quanta", "mass-energy"] as const;
const contexts = await Promise.all(
  PAPERS.map(async (paper) => {
    const cards = await resultCardsFor(paper);
    const loaded = loadResultCards(process.cwd(), paper);
    if (!cards || !loaded || loaded.problems.length > 0) throw new Error(`No real cards: ${paper}`);
    const supports = new Map(
      cards.flatMap((card) =>
        card.support?.kind === "checked-proof" ? [[card.resultId, card.support] as const] : [],
      ),
    );
    return { paper, cards, records: loaded.cards, supports, equations: paperEquations(paper) };
  }),
);
const connections = loadConnections();

function context(paper: string): Parameters<typeof buildResultDependencies>[0] {
  const found = contexts.find((candidate) => candidate.paper === paper);
  if (!found) throw new Error(`No context: ${paper}`);
  return {
    paper,
    resultIds: found.cards.map((card) => card.resultId),
    records: found.records,
    supports: found.supports,
    equations: found.equations,
    connections,
    relatedRecords: contexts
      .filter((candidate) => candidate.paper !== paper)
      .flatMap((c) => c.records),
  };
}
function node(nodes: readonly ResultDependency[], id: string): ResultDependency {
  const found = nodes.find((candidate) => candidate.resultId === id);
  if (!found) throw new Error(`No result: ${id}`);
  return found;
}
function refused(run: () => unknown, reason: RegExp): void {
  try {
    run();
    throw new Error("The unresolved dependency was accepted.");
  } catch (error) {
    expect(error).toBeInstanceOf(ResultCardsError);
    expect((error as ResultCardsError).rule).toBe("result-dependencies-unresolved");
    expect((error as Error).message).toMatch(reason);
  }
}

describe("navigation through actual checked result routes", () => {
  test("retains every result in paper order and preserves each owner's full support", () => {
    for (const paper of PAPERS) {
      const input = context(paper);
      const nodes = resultDependenciesFor(paper, input.resultIds, input.supports, input.equations);
      expect(nodes.map((result) => result.resultId)).toEqual(input.resultIds);
      expect(nodes.length).toBeGreaterThan(0);
      for (const result of nodes) {
        expect(result.support).toBe(input.supports.get(result.resultId) ?? null);
        expect(result.sourceHref).toContain(`/papers/${paper}/view/german/#`);
        expect(result.explanationHref).toContain(`/papers/${paper}/#arg-`);
        if (!result.support) expect(result.routes).toEqual([]);
      }
    }
  });

  test("Brownian inputs distinguish the source balance from the later inference route", () => {
    const nodes = buildResultDependencies(context("brownian-motion"));
    const diffusion = node(nodes, "bm-diffusion-coefficient");
    expect(diffusion.routes.map((route) => route.kind)).toEqual(["source-order"]);
    expect(diffusion.routes[0]?.inputs[0]).toMatchObject({
      ref: "arg-bm-osmotic-suspended",
      kind: "passage",
      href: "/papers/brownian-motion/#arg-bm-osmotic-suspended",
      resultId: null,
    });
    const inference = node(nodes, "bm-molecular-number");
    expect(inference.routes.map((route) => route.kind)).toEqual(["teaching"]);
    expect(
      inference.routes[0]?.inputs.find((input) => input.ref === "eq-model-bm-diffusivity-molar")
        ?.resultId,
    ).toBe("bm-diffusion-coefficient");
    const growth = inference.routes[0]?.inputs.find(
      (input) => input.ref === "eq-model-bm-mean-square-growth",
    );
    expect(growth?.kind).toBe("equation");
    expect(growth?.resultId).toBeNull();
    expect(growth?.href).toBe("/papers/brownian-motion/#arg-bm-independent-steps");
    expect(node(nodes, "bm-osmotic-pressure").uses).toEqual([]);
    expect(diffusion.uses).toContainEqual({
      resultId: inference.resultId,
      title: inference.title,
      href: inference.href,
      kind: "teaching",
    });
    expect(node(nodes, "bm-diffusion-equation").support?.assumptions.length).toBeGreaterThan(0);
    expect(node(nodes, "bm-diffusion-equation").routes).toEqual([]);
  });

  test("the admitted time map explains simultaneity without becoming a historical backwards edge", () => {
    const nodes = buildResultDependencies(context("special-relativity"));
    const simultaneity = node(nodes, "sr-relativity-of-simultaneity");
    expect(simultaneity.support?.proofId).toBe("sr-simultaneity-offset");
    expect(simultaneity.routes.map((route) => route.kind)).toEqual(["teaching"]);
    expect(simultaneity.routes[0]?.inputs[0]).toMatchObject({
      ref: "arg-sr-lorentz-map",
      kind: "passage",
      href: "/papers/special-relativity/#arg-sr-lorentz-map",
      resultId: null,
    });
    expect(node(nodes, "sr-transformation-equations").support).toBeNull();
    const energy = node(nodes, "sr-electron-kinetic-energy");
    expect(
      energy.routes
        .find((route) => route.kind === "source-order")
        ?.inputs.some(
          (input) => input.ref === "arg-sr-electron-conventions" && input.kind === "passage",
        ),
    ).toBe(true);
  });

  test("new light-quanta proofs appear through their owners and the entropy comparison names both inputs", () => {
    const nodes = buildResultDependencies(context("light-quanta"));
    expect(node(nodes, "lq-classical-difficulty").support?.proofId).toBe("lq-classical-cutoff");
    expect(node(nodes, "lq-boltzmann-principle").support?.proofId).toBe("lq-independent-entropy");
    const quanta = node(nodes, "lq-energy-quanta");
    expect(quanta.routes.flatMap((route) => route.inputs.map((input) => input.ref))).toEqual([
      "arg-lq-fixed-band-volume",
      "arg-lq-independent-configurations",
    ]);
    expect(
      quanta.routes.flatMap((route) => route.inputs).every((input) => input.kind === "passage"),
    ).toBe(true);
    expect(quanta.routes.every((route) => route.kind === "teaching")).toBe(true);
    expect(node(nodes, "lq-planck-constants").support).toBeNull();
  });

  test("cross-paper borrowing keeps the derived formula separate from the premises", () => {
    const sr = buildResultDependencies(context("special-relativity"));
    const me = buildResultDependencies(context("mass-energy"));
    expect(node(sr, "sr-light-complex-energy").crossPaper[0]).toMatchObject({
      connectionId: "energy-transformation",
      direction: "use",
      label: "Uses a result",
      href: "/papers/mass-energy/view/results/#result-me-light-energy-transformation",
    });
    expect(node(sr, "sr-two-postulates").crossPaper[0]).toMatchObject({
      connectionId: "relativity-premises",
      label: "Takes a premise",
    });
    expect(node(me, "me-two-balances").crossPaper[0]).toMatchObject({
      direction: "input",
      href: "/papers/special-relativity/view/results/#result-sr-two-postulates",
    });
    expect(node(me, "me-light-energy-transformation").support).toBeNull();
    const all = PAPERS.flatMap((paper) => buildResultDependencies(context(paper)));
    expect(
      new Set(all.flatMap((result) => result.crossPaper.map((use) => use.connectionId))),
    ).toEqual(
      new Set(connections.filter((connection) => connection.kind === "borrows").map((c) => c.id)),
    );
  });

  test("each input has an actual premise edge or entry assumption and each equation link has an emitted passage", async () => {
    let inputs = 0;
    for (const paper of PAPERS) {
      const argumentIds = new Set(
        (await loadPaper(paper)).arguments.map((argument) => argument.id),
      );
      for (const result of buildResultDependencies(context(paper))) {
        if (!result.support) continue;
        const chains = checkedResultChains(result.support.proofId);
        for (const route of result.routes) {
          for (const input of route.inputs) {
            inputs++;
            expect(input.evidence.length).toBeGreaterThan(0);
            if (input.kind === "equation" || input.kind === "passage") {
              expect(argumentIds.has(input.href.split("#")[1] ?? "")).toBe(true);
              expect(input.href).not.toContain("#eq-model-");
            }
            for (const evidence of input.evidence) {
              const chain = chains.find((candidate) => candidate.id === evidence.chainId);
              expect(chain).toBeDefined();
              const references =
                evidence.stepId === null
                  ? chain?.entryAssumptions.map((ref) => ({
                      from: ref.ref,
                      edgeType: ref.edgeType,
                    }))
                  : premiseEdgesForGenealogy(chain ? [chain] : []).filter(
                      (edge) => edge.to === evidence.stepId,
                    );
              expect(
                references?.some(
                  (ref) => ref.from === input.ref && ref.edgeType === evidence.edgeType,
                ),
              ).toBe(true);
              if (route.kind === "source-order") {
                expect(chain?.routeKind).toBe("source-order");
                expect(evidence.edgeType).toBe("historical-derivation");
              }
            }
          }
        }
      }
    }
    expect(inputs).toBeGreaterThan(0);
  });

  test("a section-local selection links out to the complete result face", () => {
    const input = context("brownian-motion");
    const selected = buildResultDependencies({ ...input, resultIds: ["bm-molecular-number"] });
    expect(selected.length).toBe(1);
    expect(selected[0]?.routes[0]?.inputs[0]?.href).toBe(
      "/papers/brownian-motion/view/results/#result-bm-diffusion-coefficient",
    );
  });

  test("cross-references and modern oracles cannot create historical or teaching inputs", () => {
    const input = context("brownian-motion");
    const original = checkedResultChains("bm-equilibrium-diffusivity")[0];
    if (!original) throw new Error("The balance must have a real chain.");
    for (const edgeType of ["cross-reference", "modern-verification-oracle"] as const) {
      const projected = buildResultDependencies({
        ...input,
        resultIds: ["bm-diffusion-coefficient"],
        chainsForProof: () => [
          {
            ...original,
            entryAssumptions: [{ ref: "arg-bm-osmotic-suspended", edgeType }],
            steps: original.steps.map((step) => ({
              ...step,
              premiseRefs: [{ ref: "arg-bm-osmotic-suspended", edgeType }],
            })),
          },
        ],
      });
      expect(projected[0]?.routes).toEqual([]);
    }
    const modern = buildResultDependencies({
      ...input,
      resultIds: ["bm-diffusion-coefficient"],
      chainsForProof: () => [{ ...original, routeKind: "modern-verification" }],
    });
    expect(modern[0]?.routes).toEqual([]);
  });
});

describe("unresolved dependency joins are refused", () => {
  test("a declared proof cannot stand in for checked support or a different conclusion", () => {
    const input = context("brownian-motion");
    let missingSupport: unknown;
    try {
      buildResultDependencies({ ...input, supports: new Map() });
    } catch (error) {
      missingSupport = error;
    }
    expect(missingSupport).toBeInstanceOf(ResultCardsError);
    expect((missingSupport as ResultCardsError).rule).toBe("result-dependencies-unresolved");
    expect((missingSupport as Error).message).toMatch(/resolved support/);
    const support = input.supports.get("bm-diffusion-coefficient");
    if (!support) throw new Error("Missing actual checked balance.");
    const supports = new Map(input.supports);
    supports.set("bm-diffusion-coefficient", {
      ...support,
      conclusion: { ...support.conclusion, equationId: "eq-model-wrong" },
    });
    refused(() => buildResultDependencies({ ...input, supports }), /resolved support/);
  });

  test("unknown or duplicate results cannot produce a plausible-looking route", () => {
    const input = context("brownian-motion");
    refused(
      () => buildResultDependencies({ ...input, resultIds: ["missing-result"] }),
      /no result/,
    );
    refused(
      () =>
        buildResultDependencies({
          ...input,
          resultIds: ["bm-molecular-number", "bm-molecular-number"],
        }),
      /unambiguous/,
    );
  });

  test("a missing equation premise and a broken cross-paper destination have no guessed link", () => {
    const input = context("brownian-motion");
    const equations = new Map(input.equations);
    equations.delete("eq-model-bm-mean-square-growth");
    refused(() => buildResultDependencies({ ...input, equations }), /unresolved input/);
    refused(
      () => buildResultDependencies({ ...context("special-relativity"), relatedRecords: [] }),
      /result destination/,
    );
  });
});
