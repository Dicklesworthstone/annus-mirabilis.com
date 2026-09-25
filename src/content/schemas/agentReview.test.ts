/**
 * Agent-reviewed translation units (docs/DECISIONS.md D-2026-09-25-agent-reviewed-translations):
 * a unit counts as checked only with the ruling as its basis and at least two rounds by distinct
 * AI agents, none of them its translator. Each refusal is reached here by its code.
 */
import { describe, expect, test } from "bun:test";
import {
  AGENT_REVIEW_BASIS,
  SchemaValidationError,
  validateAgentReview,
  validateTranslationUnit,
} from "./source.ts";

const agent = (name: string) => ({
  id: `agent:${name}`,
  name,
  kind: "model",
  modelId: "claude-opus-5-5",
});
const TRANSLATOR = agent("Translator");
const review = (rounds: unknown[], basis: string = AGENT_REVIEW_BASIS) => ({ basis, rounds });
const round = (name: string, date = "2026-09-25") => ({ reviewer: agent(name), date });
const unit = (extra: Record<string, unknown>) => ({
  id: "s0-p1-s1",
  sourceRefs: [{ paper: "mass-energy", id: "s0-p1-s1" }],
  inlines: [{ kind: "text", text: "A sentence." }],
  translator: TRANSLATOR,
  revision: 1,
  unresolvedAlternatives: [],
  reviewState: "reviewed",
  lang: "en",
  ...extra,
});

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (e) {
    if (e instanceof SchemaValidationError) return e.code;
    throw e;
  }
  return "accepted";
}

describe("an agent review is accepted only as the ruling allows", () => {
  test("two rounds by two agents other than the translator: accepted, with no human editor", () => {
    const u = validateTranslationUnit(unit({ agentReview: review([round("A"), round("B")]) }));
    expect(u.reviewState).toBe("reviewed");
    expect(u.agentReview?.rounds.map((r) => r.reviewer.id)).toEqual(["agent:A", "agent:B"]);
    expect(u.editor).toBeUndefined();
  });

  test("without an agent review, a reviewed unit still needs its editor: missing-editor", () => {
    expect(codeOf(() => validateTranslationUnit(unit({})))).toBe("missing-editor");
  });

  test("an agent review on a unit not marked reviewed: agent-review-state", () => {
    const draft = unit({
      reviewState: "machine-draft",
      agentReview: review([round("A"), round("B")]),
    });
    expect(codeOf(() => validateTranslationUnit(draft))).toBe("agent-review-state");
    // The control: the same unit without the review is an ordinary draft and is accepted.
    expect(codeOf(() => validateTranslationUnit(unit({ reviewState: "machine-draft" })))).toBe(
      "accepted",
    );
  });

  test("not an object: invalid-agent-review", () => {
    expect(codeOf(() => validateAgentReview("yes", TRANSLATOR.id))).toBe("invalid-agent-review");
  });

  test("another basis: agent-review-basis", () => {
    expect(
      codeOf(() => validateAgentReview(review([round("A"), round("B")], "D-other"), TRANSLATOR.id)),
    ).toBe("agent-review-basis");
  });

  test("one round is not enough: agent-review-rounds", () => {
    expect(codeOf(() => validateAgentReview(review([round("A")]), TRANSLATOR.id))).toBe(
      "agent-review-rounds",
    );
  });

  test("a human in a round: agent-review-not-agent", () => {
    const human = { reviewer: { id: "jemanuel", name: "J", kind: "human" }, date: "2026-09-25" };
    expect(codeOf(() => validateAgentReview(review([round("A"), human]), TRANSLATOR.id))).toBe(
      "agent-review-not-agent",
    );
  });

  test("the translator reviewing its own work: agent-review-by-translator", () => {
    expect(
      codeOf(() => validateAgentReview(review([round("A"), round("Translator")]), TRANSLATOR.id)),
    ).toBe("agent-review-by-translator");
  });

  test("one agent reviewing twice is not two fresh eyes: agent-review-repeat-reviewer", () => {
    expect(codeOf(() => validateAgentReview(review([round("A"), round("A")]), TRANSLATOR.id))).toBe(
      "agent-review-repeat-reviewer",
    );
  });

  test("a round without a date: agent-review-date", () => {
    expect(
      codeOf(() => validateAgentReview(review([round("A"), round("B", "today")]), TRANSLATOR.id)),
    ).toBe("agent-review-date");
  });
});
