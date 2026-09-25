/**
 * A translation checked by AI agents under D-2026-09-25 records it, and never claims a person. The
 * record's summary still says so exactly (reviewState.ts). The English face shows no notice at all
 * (D-2026-09-25-no-review-status-banners), whether every unit is checked or only some.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AGENT_REVIEW_BASIS, type TranslationUnit } from "../../content/schemas/source.ts";
import {
  FIXTURE_BROWNIAN_ALIGNMENT,
  FIXTURE_BROWNIAN_PAPER,
  FIXTURE_BROWNIAN_TRANSLATION_UNITS,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { EnglishFace } from "./EnglishFace.tsx";
import { evaluateUnitReviewState, translationReviewSummary } from "./reviewState.ts";

const agent = (name: string) =>
  ({ id: `agent:${name}`, name, kind: "model", modelId: "claude-opus-5-5" }) as const;
const checked = (u: TranslationUnit): TranslationUnit => ({
  ...u,
  editor: undefined,
  reviewState: "reviewed",
  agentReview: {
    basis: AGENT_REVIEW_BASIS,
    rounds: [
      { reviewer: agent("TopazPrairie"), date: "2026-09-25" },
      { reviewer: agent("TanElk"), date: "2026-09-25" },
    ],
  },
});
const ALL = FIXTURE_BROWNIAN_TRANSLATION_UNITS.map(checked);
// The fixture's translator is a person; these are the same units as translated by an AI model.
const TRANSLATOR = agent("Translator");
const BY_AGENT = ALL.map((u) => ({ ...u, translator: TRANSLATOR }));
const MIXED = FIXTURE_BROWNIAN_TRANSLATION_UNITS.map((u, i) => (i === 0 ? checked(u) : u));

describe("a translation checked by AI agents", () => {
  test("each unit's badge says AI agents checked it, and that no person did", () => {
    const badge = evaluateUnitReviewState(ALL[0] as TranslationUnit);
    expect(badge.isReviewed).toBe(true);
    expect(badge.label).toBe("Checked by AI agents");
    expect(badge.description).toContain("TopazPrairie and TanElk, AI agents, in 2 independent");
    expect(badge.description).toContain("No person has reviewed it.");
  });

  test("the summary names the translator and the reviewing agents, and claims no person", () => {
    const s = translationReviewSummary(BY_AGENT);
    expect(s.agentChecked).toBe(true);
    expect(s.title).toBe("Translated and checked by AI agents");
    expect(s.message).toContain("Translator translated this from the German.");
    expect(s.message).toContain("TopazPrairie and TanElk");
    expect(s.message).toContain("one review round each. No person has reviewed it.");
  });

  test("reviewers of the translating model are called sessions of the same model", () => {
    expect(translationReviewSummary(BY_AGENT).message).toContain(
      "TopazPrairie and TanElk, further sessions of the same AI model, checked all",
    );
  });

  test("a reviewer of another model makes them other AI agents, not the same model", () => {
    const other = BY_AGENT.map((u) => ({
      ...u,
      agentReview: {
        basis: AGENT_REVIEW_BASIS,
        rounds: [
          { reviewer: agent("TopazPrairie"), date: "2026-09-25" },
          { reviewer: { ...agent("TanElk"), modelId: "another-model" }, date: "2026-09-25" },
        ],
      },
    }));
    const m = translationReviewSummary(other).message;
    expect(m).toContain("TopazPrairie and TanElk, other AI agents, checked all");
    expect(m).not.toContain("same AI model");
  });

  test("a person's translation checked by agents is never said to be translated by AI", () => {
    const s = translationReviewSummary(ALL);
    expect(s.agentChecked).toBe(true);
    expect(s.title).toBe("Checked by AI agents");
    // The fixture mixes a person and a model as translators, so not every translator is AI.
    expect(s.message).toContain("A translation made from the German by Fixture Translator");
    expect(s.message).toContain("TopazPrairie and TanElk, AI agents, checked all");
    expect(s.message).not.toContain("same AI model");
    expect(s.message).not.toContain("translated this");
  });

  test("the English face shows no review notice, and claims no person", () => {
    const html = renderToStaticMarkup(
      <EnglishFace
        paper={FIXTURE_BROWNIAN_PAPER}
        units={BY_AGENT}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        reviewRecords={[]}
      />,
    );
    expect(html).not.toContain("data-agent-checked-banner");
    expect(html).not.toContain("data-unreviewed-banner");
    expect(html).not.toContain("AI agents");
    expect(html).not.toMatch(/reviewed by|No person has reviewed/);
  });

  test("partly checked: the agents are named as AI agents, never as plain reviewers", () => {
    // Two units final under D-2026-09-25, the rest still drafts: the notice names the agents as
    // agents and says no person checked them.
    const partial = BY_AGENT.map((u, i) =>
      i < 2 ? u : { ...u, reviewState: "machine-draft" as const, agentReview: undefined },
    );
    const s = translationReviewSummary(partial);
    expect(s.agentChecked).toBe(false);
    expect(s.title).toBe("Translation partly checked by AI agents");
    expect(s.message).toContain(
      "2 of its 6 sentences and displays have been checked against the German by AI agents, TopazPrairie and TanElk, and by no person",
    );
    expect(s.message).not.toContain("reviewed against the German by TopazPrairie");
    // Beside a person's review, each is said for what it is.
    const mixed = translationReviewSummary(MIXED);
    expect(mixed.message).toContain("by AI agents, TopazPrairie and TanElk, and by no person");
    expect(mixed.message).not.toContain("reviewed against the German by TopazPrairie");
  });

  test("a paper only partly checked shows no banner either, and no agent notice", () => {
    expect(translationReviewSummary(MIXED).agentChecked).toBe(false);
    const html = renderToStaticMarkup(
      <EnglishFace
        paper={FIXTURE_BROWNIAN_PAPER}
        units={MIXED}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        reviewRecords={[]}
      />,
    );
    expect(html).not.toContain("data-unreviewed-banner");
    expect(html).not.toContain("data-agent-checked-banner");
    expect(html).not.toMatch(/partly (?:checked|reviewed)/);
  });
});
