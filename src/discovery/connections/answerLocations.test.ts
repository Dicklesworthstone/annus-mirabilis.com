import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { exerciseResponseHref, parseExerciseCapture } from "../../reader/notebook/exerciseEntry.ts";
import { parseTeachBackCapture, teachBackHref } from "../../reader/notebook/teachBackEntry.ts";
import {
  CONNECTION_ANSWER_LOCATIONS,
  connectionAnswerHref,
  connectionAnswerLocation,
} from "./answerLocations.ts";
import { CROSS_JOURNEY_EXERCISES } from "./records.ts";

const parts = CROSS_JOURNEY_EXERCISES.flatMap((exercise) =>
  exercise.sections.flatMap((section) => section.parts),
);

describe("saved cross-paper answer locations", () => {
  test("every published answer has one matching source and an exact public return location", () => {
    expect(parts.length).toBeGreaterThan(0);
    expect(Object.keys(CONNECTION_ANSWER_LOCATIONS).sort()).toEqual(
      parts.map((entry) => entry.part.id).sort(),
    );
    for (const { part, kind } of parts) {
      const location = connectionAnswerLocation(part.id);
      expect(location?.kind).toBe(kind);
      if (!location) throw new Error("The authored answer needs its source location.");
      expect(existsSync(`content/arguments/${location.paper}/${location.sourceAnchor}.json`)).toBe(
        true,
      );
      const expected = `/connections/#${kind === "explanation" ? "explanation" : "exercise"}-${part.id}`;
      const href =
        kind === "explanation"
          ? teachBackHref(location.paper, {
              schemaVersion: 1,
              promptId: part.id,
              prompt: part.prompt,
              guideRevision: "connection:fixture",
            })
          : exerciseResponseHref(location.paper, {
              schemaVersion: 1,
              partId: part.id,
              prompt: part.prompt,
              guideRevision: "connection:fixture",
              partKind: kind,
              definitionKey: JSON.stringify(part),
              unit: kind === "numeric" ? "1" : null,
            });
      expect(href).toBe(expected);
      expect(href).not.toContain("fixture");
    }
  });

  test("known cross-paper questions refuse a different paper, a different answer kind and invented question ids", () => {
    const numeric = {
      schemaVersion: 1,
      partId: "cross-journey-avogadro-radiation",
      prompt: "private question",
      guideRevision: "connection:fixture",
      partKind: "numeric",
      definitionKey: "definition",
      unit: "1/mol",
    };
    expect(parseExerciseCapture(numeric, "light-quanta", "1").partId).toBe(numeric.partId);
    expect(() => parseExerciseCapture(numeric, "mass-energy", "1")).toThrow();
    expect(() =>
      parseExerciseCapture({ ...numeric, partKind: "expression", unit: null }, "light-quanta", "1"),
    ).toThrow();
    expect(() =>
      parseExerciseCapture({ ...numeric, partId: "cross-journey-invented" }, "light-quanta", "1"),
    ).toThrow();
    const prose = {
      schemaVersion: 1,
      promptId: "cross-journey-statistical-papers-explanation",
      prompt: "private question",
      guideRevision: "connection:fixture",
    };
    expect(parseTeachBackCapture(prose, "light-quanta").promptId).toBe(prose.promptId);
    expect(() => parseTeachBackCapture(prose, "brownian-motion")).toThrow();
    expect(() =>
      parseTeachBackCapture({ ...prose, promptId: numeric.partId }, "light-quanta"),
    ).toThrow();
    expect(() =>
      parseTeachBackCapture({ ...prose, promptId: "cross-journey-invented" }, "light-quanta"),
    ).toThrow();
    expect(connectionAnswerHref("brownian-motion", numeric.partId, "numeric")).toBeNull();
    expect(connectionAnswerHref("light-quanta", "../private?answer=words", "numeric")).toBeNull();
    expect(connectionAnswerLocation("constructor")).toBeNull();
  });

  test("existing guide captures retain their format and return destinations", () => {
    const exercise = {
      schemaVersion: 1 as const,
      partId: "bm-displacement-scale-rewrite",
      prompt: "The saved question",
      guideRevision: "3",
      partKind: "expression" as const,
      definitionKey: "original definition",
      unit: null,
    };
    const explanation = {
      schemaVersion: 1 as const,
      promptId: "bm-square-root-in-words",
      prompt: "The saved explanation question",
      guideRevision: "3",
    };
    expect(parseExerciseCapture(exercise, "brownian-motion", "sqrt(4*D*t)")).toEqual(exercise);
    expect(parseTeachBackCapture(explanation, "brownian-motion")).toEqual(explanation);
    expect(exerciseResponseHref("brownian-motion", exercise)).toBe(
      "/discover/brownian-motion/#exercise-bm-displacement-scale-rewrite",
    );
    expect(teachBackHref("brownian-motion", explanation)).toBe(
      "/discover/brownian-motion/#explanation-bm-square-root-in-words",
    );
  });
});
