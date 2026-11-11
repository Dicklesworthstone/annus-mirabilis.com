import { describe, expect, test } from "bun:test";
import { CROSS_JOURNEY_EXERCISES } from "../discovery/connections/records.ts";
import type { ConnectionExercise } from "../discovery/connections/types.ts";
import { connectionExerciseDocuments } from "./connectionExerciseDocuments.ts";
import { createSearchEngine, searchResultHref } from "./core.ts";

describe("finding a transfer exercise", () => {
  test("the real questions lead to their public connection anchors", () => {
    expect(CROSS_JOURNEY_EXERCISES.length).toBeGreaterThan(0);
    const documents = connectionExerciseDocuments(CROSS_JOURNEY_EXERCISES, "scaffold");
    const engine = createSearchEngine(documents);
    for (const exercise of CROSS_JOURNEY_EXERCISES) {
      const hits = engine.search(`"${exercise.title}"`, { type: "connection-thread" });
      expect(hits[0]?.document.id).toBe(`connection-exercise:${exercise.id}`);
      const document = hits[0]?.document;
      if (!document) continue;
      expect(searchResultHref(document)).toBe(`/connections/#${exercise.id}`);
      expect(document.paper).toBe("cross-paper");
      for (const section of exercise.sections) {
        for (const { part } of section.parts) {
          expect(document.text).toContain(part.prompt);
          expect(document.text).toContain(part.workedExplanation);
        }
      }
    }
    expect(engine.search("invariant mass", { type: "equation" })).toEqual([]);
    expect(engine.search("invariant mass", { paper: "brownian-motion" })).toEqual([]);
  });

  test("modern-lens labelling and publication restrictions survive indexing", () => {
    const documents = connectionExerciseDocuments(CROSS_JOURNEY_EXERCISES, "scaffold");
    const modern = documents.find((item) => item.anchor === "cross-journey-effective-mass");
    expect(modern?.scopeLabel).toContain("modern lens");
    expect(connectionExerciseDocuments(CROSS_JOURNEY_EXERCISES, "preview")).toEqual([]);
    expect(connectionExerciseDocuments(CROSS_JOURNEY_EXERCISES, "launch")).toEqual([]);
  });

  test("only public prose is projected, even if a caller also holds a reader draft", () => {
    const exercise: ConnectionExercise & { readerAnswer: string } = {
      id: "cross-journey-search-fixture",
      title: "Compare two kinds of evidence",
      introduction: ["An authored introduction."],
      readerAnswer: "private-answer-sentinel",
      sections: [
        {
          id: "comparison",
          title: "A comparison",
          paragraphs: ["An authored condition."],
          parts: [
            {
              kind: "explanation",
              part: {
                id: "explain-comparison",
                prompt: "Which premise changed?",
                workedExplanation: "The same result can rely on different premises.",
                criteria: ["State the premise.", "Distinguish the observations."],
              },
            },
          ],
        },
      ],
      links: [],
    };
    const [document] = connectionExerciseDocuments([exercise], "scaffold");
    expect(document?.text).toContain("Distinguish the observations.");
    expect(JSON.stringify(document)).not.toContain("private-answer-sentinel");
    expect(document?.terms).toEqual([]);
    expect(connectionExerciseDocuments([], "scaffold")).toEqual([]);
  });
});
