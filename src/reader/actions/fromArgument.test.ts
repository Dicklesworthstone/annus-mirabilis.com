import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Argument } from "../../content/schemas/reading.ts";
import { loadPaper } from "../../content/server";
import { passageActionsFromArgument } from "./fromArgument.ts";
import { ObstacleMenu } from "./ObstacleMenu.tsx";
import { OBSTACLE_KIND_IDS } from "./passageActions.schema.ts";

const ARG: Argument = {
  schemaVersion: 1,
  kind: "argument",
  id: "arg-bm-observable",
  paper: "brownian-motion",
  section: "s4",
  title: "Zero average is not no movement",
  question: "What can we measure when left and right cancel?",
  recap: "Signed displacements can cancel.",
  review: "draft",
  premises: [],
  limitations: [],
  citations: [],
  readings: { overview: [], full: [], steps: [], margin: [] },
  prerequisites: [],
  help: {
    why: "mean-variance-rms",
    missingStep: "bridge-squaring-square-roots",
    example: "mean-variance-rms",
  },
  experiments: ["bm-01"],
  meaning: {
    logicalRole: "definition",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "exact-within-model",
    executionStatus: "static-illustration",
  },
};

describe("passageActionsFromArgument", () => {
  test("the observable argument exposes why, example, try-it, and an answer for every obstacle", () => {
    const actions = passageActionsFromArgument(ARG);
    expect(actions.hard).toBe(true);
    expect(actions.why).toBe("mean-variance-rms");
    expect(actions.tryIt).toEqual({ kind: "instrument", instrumentId: "bm-01" });
    expect(actions.obstacleResponses?.algebraicMove?.foundationLinks?.[0]?.foundationId).toBe(
      "bridge-squaring-square-roots",
    );
    // Every one of the six kinds is answered, each with its own lesson to open.
    for (const kind of OBSTACLE_KIND_IDS) {
      expect(actions.obstacleResponses?.[kind]?.explanation.length ?? 0).toBeGreaterThan(40);
      expect(actions.obstacleResponses?.[kind]?.foundationLinks?.length ?? 0).toBeGreaterThan(0);
    }
  });

  test("planted negative: a different argument does not inherit invented obstacle answers", () => {
    const actions = passageActionsFromArgument({ ...ARG, id: "arg-unlisted-obstacle-fixture" });
    expect(actions.hard).toBe(false);
    expect(actions.obstacleResponses).toBeUndefined();
    expect(actions.why).toBe("mean-variance-rms");
  });
});

describe("every hard passage, in every paper", () => {
  const PAPERS = ["brownian-motion", "light-quanta", "special-relativity", "mass-energy"] as const;

  test("answers all six obstacles, one existing lesson each, pointing back at itself", async () => {
    const hard: string[] = [];
    for (const paper of PAPERS) {
      const { arguments: args } = await loadPaper(paper);
      for (const argument of args) {
        const actions = passageActionsFromArgument(argument as Argument);
        if (!actions.hard) continue;
        hard.push(argument.id);
        for (const kind of OBSTACLE_KIND_IDS) {
          const answer = actions.obstacleResponses?.[kind];
          expect(answer?.explanation.length ?? 0).toBeGreaterThan(40);
          // No em dash in reader copy (AGENTS.md, Editorial Voice).
          expect(answer?.explanation).not.toContain("\u2014");
          // Exactly one lesson: ObstacleMenu names each link by its obstacle, so a second link
          // in one answer would share that name and lead somewhere else.
          expect(answer?.foundationLinks?.length).toBe(1);
          const link = answer?.foundationLinks?.[0];
          expect(link?.callingAnchor).toBe(argument.id);
          expect(
            existsSync(join(process.cwd(), "content/foundations", `${link?.foundationId}.json`)),
          ).toBe(true);
        }
      }
    }
    // Keep the original four and the difficult derivations reachable without freezing the
    // number of passages for which editors may subsequently author help.
    for (const id of [
      "arg-bm-observable",
      "arg-bm-inference",
      "arg-bm-independent-steps",
      "arg-bm-diffusion-equation",
      "arg-bm-gaussian",
      "arg-lq-independent-configurations",
      "arg-lq-entropy-temperature",
      "arg-lq-wien-integration",
      "arg-me-subtraction",
      "arg-me-constant-premise",
      "arg-me-small-speed",
      "arg-sr-lorentz-map",
      "arg-sr-velocity-composition",
    ]) {
      expect(hard).toContain(id);
    }
  });

  test("each worked example says the passage's own numbers", async () => {
    const example = async (paper: string, id: string) => {
      const argument = (await loadPaper(paper)).arguments.find((a) => a.id === id);
      return passageActionsFromArgument(argument as Argument).obstacleResponses?.tooMuchAtOnce
        ?.explanation;
    };
    expect(await example("light-quanta", "arg-lq-independent-configurations")).toContain("1/16");
    expect(await example("special-relativity", "arg-sr-velocity-composition")).toContain("15c/17");
    expect(await example("mass-energy", "arg-me-subtraction")).toContain("10 × (1.25 − 1)");
  });
});

describe("derivation help is usable in the static reader", () => {
  const passages = [
    ["light-quanta", "arg-lq-entropy-temperature"],
    ["light-quanta", "arg-lq-wien-integration"],
    ["special-relativity", "arg-sr-lorentz-map"],
    ["brownian-motion", "arg-bm-inference"],
    ["brownian-motion", "arg-bm-independent-steps"],
    ["brownian-motion", "arg-bm-diffusion-equation"],
    ["brownian-motion", "arg-bm-gaussian"],
    ["mass-energy", "arg-me-constant-premise"],
    ["mass-energy", "arg-me-small-speed"],
  ] as const;

  for (const [paper, id] of passages) {
    test(`${id}: every answer is in the HTML with its own disclosure and a real returnable lesson`, async () => {
      const argument = (await loadPaper(paper)).arguments.find((item) => item.id === id);
      expect(argument).toBeDefined();
      const actions = passageActionsFromArgument(argument as Argument);
      expect(actions.hard).toBe(true);
      const html = renderToStaticMarkup(
        createElement(ObstacleMenu, {
          passageId: id,
          passageLabel: (argument as Argument).title,
          hard: actions.hard,
          responses: actions.obstacleResponses,
        }),
      );
      // A missing record must not silently become an unavailable answer or a hidden menu.
      expect(html).toContain("data-obstacle-menu");
      expect(html).not.toContain("data-obstacle-unavailable");
      for (const kind of OBSTACLE_KIND_IDS) {
        const answer = actions.obstacleResponses?.[kind];
        expect(answer).toBeDefined();
        expect(html).toContain(`id="${id}-obstacle-${kind}"`);
        expect(html).toContain(renderToStaticMarkup(createElement("p", null, answer?.explanation)));
        const link = answer?.foundationLinks?.[0];
        expect(html).toContain(`href="/foundations/${link?.foundationId}/"`);
        expect(link?.callingAnchor).toBe(id);
        expect(link?.returnCaption).toMatch(/^Return to .{20,}/);
        expect(html).toContain("data-return-caption=");
      }
    });
  }
});

describe("the Brownian and mass-energy explanations retain their scientific conditions", () => {
  async function answers(paper: string, id: string) {
    const argument = (await loadPaper(paper)).arguments.find((item) => item.id === id);
    expect(argument).toBeDefined();
    return passageActionsFromArgument(argument as Argument).obstacleResponses;
  }

  test("independent steps explain both assumptions behind removing cross terms", async () => {
    const help = await answers("brownian-motion", "arg-bm-independent-steps");
    expect(help?.algebraicMove?.explanation).toContain("⟨AB⟩ = ⟨A⟩⟨B⟩");
    expect(help?.physicalReason?.explanation).toContain("Centred steps have zero average");
    expect(help?.physicalReason?.explanation).toContain("Neither condition alone");
    expect(help?.tooMuchAtOnce?.explanation).toContain("4 steps give mean square 4");
    expect(help?.tooMuchAtOnce?.explanation).toContain("After 16 steps");
    expect(help?.purposeOfCalculation?.explanation).toContain("mathematical reconstruction");
  });

  test("diffusion help preserves the approximation and the finite second moment", async () => {
    const help = await answers("brownian-motion", "arg-bm-diffusion-equation");
    expect(help?.algebraicMove?.explanation).toContain("finite second moment");
    expect(help?.physicalReason?.explanation).toContain(
      "τ still long enough for the independence assumption",
    );
    expect(help?.purposeOfCalculation?.explanation).toContain(
      "drops higher spatial and time terms",
    );
    expect(help?.purposeOfCalculation?.explanation).toContain("while D stays finite");
    expect(help?.purposeOfCalculation?.explanation).toContain(
      "Setting τ to zero with the same finite jumps would not justify the equation",
    );
  });

  test("Gaussian help distinguishes interval probability, coordinate RMS and the point state", async () => {
    const help = await answers("brownian-motion", "arg-bm-gaussian");
    expect(help?.unfamiliarWordOrSymbol?.explanation).toContain(
      "its height is not itself a probability",
    );
    expect(help?.connectionToPicture?.explanation).toContain("its area is the chance");
    expect(help?.tooMuchAtOnce?.explanation).toContain("about 68%");
    expect(help?.tooMuchAtOnce?.explanation).toContain("about 95%");
    expect(help?.purposeOfCalculation?.explanation).toContain("for one coordinate");
    expect(help?.purposeOfCalculation?.explanation).toContain(
      "At t = 0 every tracer is at the start, a point distribution",
    );
  });

  test("matching offsets are a premise, and unequal offsets remain in the subtraction", async () => {
    const help = await answers("mass-energy", "arg-me-constant-premise");
    expect(help?.physicalReason?.explanation).toContain(
      "The two energy balances alone do not establish it",
    );
    expect(help?.algebraicMove?.explanation).toContain("(K₀ − K₁) + (C₀ − C₁)");
    expect(help?.tooMuchAtOnce?.explanation).toContain(
      "Cancelling matching symbols does not prove that the offsets really match",
    );
  });

  test("mass-loss help separates the finite-speed proxy, low-speed limit and zero-speed quotient", async () => {
    const help = await answers("mass-energy", "arg-me-small-speed");
    expect(help?.connectionToPicture?.explanation).toContain("0.25L");
    expect(help?.connectionToPicture?.explanation).toContain("0.18L");
    expect(help?.tooMuchAtOnce?.explanation).toContain("0.0050378");
    expect(help?.algebraicMove?.explanation).toContain("Matching the limiting coefficients");
    expect(help?.purposeOfCalculation?.explanation).toContain(
      "finite-speed quotient 2L(γ − 1)/v² contains higher-speed corrections",
    );
    expect(help?.purposeOfCalculation?.explanation).toContain("0/0");
    expect(help?.purposeOfCalculation?.explanation).toContain(
      "use the limit rather than division by zero",
    );
    expect(help?.physicalReason?.explanation).toContain(
      "does not insert an absolute rest energy mc²",
    );
  });
});
