import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { checkVoice } from "../../content/checks/voice/index.ts";
import {
  explanationOutcome,
  HUMAN_READING_SENTENCE,
} from "../../discovery/exercises/explanation.ts";
import { type ExplanationExercisePart, ExplanationPart } from "./ExplanationPart.tsx";

/**
 * Explanation parts (am-disc-exercise-checker-i4h2): "a private text box, a worked explanation,
 * and a few concrete comparison criteria revealed on request. It is never auto-graded, and its
 * text is never analyzed by any code, including word detection." The last clause is asserted
 * structurally: the outcome function takes no reader text, and the component ships no client code.
 */

const PART: ExplanationExercisePart = {
  id: "demo-explanation",
  prompt: "Why does the spread grow as the square root of time?",
  criteria: ["The steps are independent.", "The mean squares add."],
  workedExplanation: "Independent steps add their mean squares, so the root grows as sqrt(t).",
};

const html = renderToStaticMarkup(<ExplanationPart part={PART} />);

describe("an explanation part renders completely without JavaScript", () => {
  test("the prompt, a labelled text box, and the privacy note it is described by", () => {
    expect(html).toContain("Why does the spread grow as the square root of time?");
    expect(html).toContain('<label for="explanation-demo-explanation">Your explanation</label>');
    expect(html).toContain('<textarea id="explanation-demo-explanation"');
    expect(html).toContain('aria-describedby="explanation-demo-explanation-note"');
    expect(html).toContain('id="explanation-demo-explanation-note"');
  });

  test("criteria and worked explanation sit in a disclosure the reader opens when ready", () => {
    const details = html.slice(html.indexOf("<details"));
    expect(details).toContain("<summary>Compare with a worked explanation</summary>");
    expect(details).toContain("<li>The steps are independent.</li>");
    expect(details).toContain("<li>The mean squares add.</li>");
    expect(details).toContain("Independent steps add their mean squares");
    expect(details).not.toContain(" open");
  });

  test("its outcome is needs-human-reading, stated on the part", () => {
    expect(html).toContain('data-outcome="needs-human-reading"');
    expect(html).toContain(HUMAN_READING_SENTENCE);
  });
});

describe("nothing reads what the reader writes", () => {
  test("the outcome is computed from the settings alone: explanationOutcome takes one argument", () => {
    expect(explanationOutcome.length).toBe(1);
    expect(explanationOutcome(PART)).toEqual(explanationOutcome({ ...PART }));
  });

  test("the component is a server component, so the page ships no code that could read the box", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/discover/ExplanationPart.tsx"),
      "utf8",
    );
    expect(source.trimStart().startsWith('"use client"')).toBe(false);
    expect(source).not.toMatch(/\buse(State|Effect|Ref)\b|\bon(Change|Input|Submit|Blur)=/);
  });

  test("the text box belongs to no form and has no name, so nothing can submit it", () => {
    const box = html.slice(html.indexOf("<textarea"), html.indexOf("</textarea>"));
    expect(box).not.toMatch(/\bname=|\bform=/);
    expect(html).not.toContain("<form");
  });

  test("no score, cross, attempt count or judgement anywhere in the part", () => {
    const text = html.replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/\b(score|attempts?|wrong|incorrect|correct)\b/i);
    expect(text).not.toMatch(/[✓✗✘❌]/u);
  });
});

describe("invalid settings", () => {
  const cases: readonly [string, ExplanationExercisePart][] = [
    ["one criterion", { ...PART, criteria: ["Only one."] }],
    ["six criteria", { ...PART, criteria: ["a", "b", "c", "d", "e", "f"] }],
    ["a repeated criterion", { ...PART, criteria: ["Same.", "Same."] }],
    ["a criterion on two lines", { ...PART, criteria: ["One\ntwo.", "Three."] }],
    ["an empty worked explanation", { ...PART, workedExplanation: " " }],
    ["an id with capitals", { ...PART, id: "Demo" }],
  ];
  for (const [name, part] of cases)
    test(`${name}: the part says it is unavailable instead of rendering half a task`, () => {
      expect(explanationOutcome(part).kind).toBe("invalid");
      const markup = renderToStaticMarkup(<ExplanationPart part={part} />);
      expect(markup).toContain("This exercise is unavailable because its settings are invalid.");
      expect(markup).not.toContain("<textarea");
    });
});

describe("the reader-facing sentences pass the voice lint", () => {
  test("the outcome sentence and the privacy note, as task feedback", () => {
    const note = html.slice(
      html.indexOf('-note">') + 7,
      html.indexOf("</p>", html.indexOf('-note">')),
    );
    expect(note).toStartWith("What you write stays in this box.");
    for (const sentence of [HUMAN_READING_SENTENCE, note]) {
      const errors = checkVoice(sentence, { context: "task-feedback" }).filter(
        (f) => f.severity === "error",
      );
      expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
    }
  });
});
