import { describe, expect, test } from "bun:test";
import { citedLessonTitles } from "./citedLessonTitles.ts";

const foundations = [
  { id: "random-walks", title: "From steps to spread" },
  { id: "mean-variance-rms", title: "Mean, variance and RMS" },
  { id: "derivatives", title: "Rates of change" },
];
const note = (foundation: string) => ({ foundation });

describe("citedLessonTitles", () => {
  test("names each cited lesson once, sorted by id, and no uncited lesson", () => {
    const titles = citedLessonTitles(
      [
        { notes: [note("random-walks"), note("mean-variance-rms")] },
        { notes: [note("random-walks")] },
      ],
      foundations,
    );
    expect(titles).toEqual({
      "mean-variance-rms": "Mean, variance and RMS",
      "random-walks": "From steps to spread",
    });
    expect(Object.keys(titles)).not.toContain("derivatives");
  });

  test("refusal equation-note-foundation-missing: a note citing a lesson the content lacks stops generation", () => {
    let caught: unknown;
    try {
      citedLessonTitles([{ notes: [note("random-walks"), note("no-such-lesson")] }], foundations);
    } catch (error) {
      caught = error;
    }
    expect((caught as { code?: string }).code).toBe("equation-note-foundation-missing");
    expect((caught as { path?: string }).path).toBe("no-such-lesson");
  });
});
