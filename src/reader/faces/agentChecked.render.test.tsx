/**
 * A translation checked by AI agents under D-2026-09-25 says so, and never claims a person.
 * The unreviewed banner gives way to one naming the agents; a paper only partly checked keeps the
 * partly-reviewed banner, so the agent notice cannot stand for units no agent checked.
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
    const s = translationReviewSummary(ALL);
    expect(s.agentChecked).toBe(true);
    expect(s.title).toBe("Translated and checked by AI agents");
    expect(s.message).toContain("TopazPrairie and TanElk");
    expect(s.message).toContain("No person has reviewed it.");
  });

  test("the English face shows the agent notice, not the unreviewed banner", () => {
    const html = renderToStaticMarkup(
      <EnglishFace
        paper={FIXTURE_BROWNIAN_PAPER}
        units={ALL}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        reviewRecords={[]}
      />,
    );
    expect(html).toContain('data-agent-checked-banner="true"');
    expect(html).not.toContain('data-unreviewed-banner="true"');
    expect(html).toContain("Translated and checked by AI agents");
  });

  test("a paper only partly checked keeps the unreviewed banner, never the agent notice", () => {
    expect(translationReviewSummary(MIXED).agentChecked).toBe(false);
    const html = renderToStaticMarkup(
      <EnglishFace
        paper={FIXTURE_BROWNIAN_PAPER}
        units={MIXED}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        reviewRecords={[]}
      />,
    );
    expect(html).toContain('data-unreviewed-banner="true"');
    expect(html).not.toContain('data-agent-checked-banner="true"');
  });
});
