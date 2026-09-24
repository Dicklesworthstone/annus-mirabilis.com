import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Argument } from "../../content/schemas/reading.ts";
import { loadPaper } from "../../content/server";
import { passageActionsFromArgument } from "./fromArgument.ts";
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
    const actions = passageActionsFromArgument({ ...ARG, id: "arg-bm-independent-steps" });
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
    // Not vacuous, and every paper has one (am-ep-reader-k0z): the four passages by name.
    expect(hard.sort()).toEqual([
      "arg-bm-observable",
      "arg-lq-independent-configurations",
      "arg-me-subtraction",
      "arg-sr-velocity-composition",
    ]);
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
