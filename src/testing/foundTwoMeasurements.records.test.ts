import { describe, expect, test } from "bun:test";
import { checkVoice } from "../content/checks/voice/index.ts";
import { loadRegistry } from "../content/foundations/registry.ts";
import { foundationLinks, lesson, lessonExists, lessonText } from "./foundInference.shared.ts";

/**
 * am-found-statistics-inference-pzqv, foundTwoMeasurements.records: the registry entry, owner, kind
 * and authored status; the five labelled parts of the worked example; typed prerequisites; the
 * stopping point; captioned callers; voice lint; and the banned abstract vocabulary.
 */

const SLUG = "two-measurements-two-unknowns";
const record = lesson(SLUG) as {
  explanation: { text?: string }[];
  example: { kind: string; items: string[] }[];
  prerequisites: { foundationId: string; kind: string }[];
  stoppingPoint: string;
};

test("registered as a node, authored, owned by this bead", () => {
  expect(loadRegistry().entries.find((e) => e.id === `foundation:${SLUG}`)).toMatchObject({
    kind: "node",
    ownerBead: "am-found-statistics-inference-pzqv",
    status: "authored",
  });
});

test("the worked example has its five labelled parts, in order", () => {
  const items = record.example.flatMap((b) => b.items ?? []);
  const labels = [
    "The question:",
    "What is given:",
    "The first thought",
    "The decisive step:",
    "The limitation:",
  ];
  const positions = labels.map((label) => items.findIndex((item) => item.startsWith(label)));
  expect(positions.every((p) => p >= 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
});

test("every prerequisite is typed and names a lesson that exists", () => {
  expect(record.prerequisites.length).toBeGreaterThan(0);
  for (const p of record.prerequisites) {
    expect(["proof-edge", "cross-link"]).toContain(p.kind);
    expect(lessonExists(p.foundationId), p.foundationId).toBe(true);
  }
});

test("a stopping point, and every caller carries a return caption", () => {
  expect(record.stoppingPoint.trim().length).toBeGreaterThan(40);
  const calls = foundationLinks().filter((l) => l.id === SLUG);
  expect(calls.length).toBeGreaterThan(0);
  for (const call of calls)
    expect(typeof call.caption === "string" && call.caption.trim().length > 0, call.path).toBe(
      true,
    );
});

describe("the lesson's words", () => {
  test("no linear, differential, distribution or invariant in the explanation", () => {
    const explanation = record.explanation.map((b) => b.text ?? "").join(" ");
    expect(
      explanation.match(/\b(linear(ly)?|differentials?|distributions?|invariant|invariance)\b/gi),
    ).toBeNull();
  });

  test("the voice lint finds no error", () => {
    const errors = checkVoice(lessonText(SLUG), { context: "prose" }).filter(
      (f) => f.severity === "error",
    );
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});
