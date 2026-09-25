/**
 * The English face reads as Einstein's paragraphs, and says nothing about review: no banner and no
 * chip, whatever the units' states (TranslationParagraphs.tsx; D-2026-09-25-no-review-status-banners).
 *
 * The fixture has the shapes mass-energy has: a two-sentence paragraph with a footnote mark, a
 * sentence that runs through a display (split at it, s1a and s1b), a footnote, and a closing line.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type SourceBlock,
  type TranslationUnit,
  validateAlignment,
  validateTranslationUnit,
} from "../../content/schemas/source.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { FIXTURE_MASS_ENERGY_PAPER } from "../../testing/fixtures/bilingual/massEnergyGlossFixture.ts";
import { PaperPage } from "../PaperPage.tsx";
import { loadBilingualEdition } from "./bilingualLoader.ts";
import { EnglishFace } from "./EnglishFace.tsx";

const TRANSLATOR = {
  id: "agent:test-model",
  name: "Test Model (agent)",
  kind: "model",
  modelId: "t",
};
const unit = (
  id: string,
  source: string,
  inlines: TranslationUnit["inlines"],
  over: Record<string, unknown> = {},
) =>
  validateTranslationUnit({
    id,
    sourceRefs: [{ paper: "mass-energy", id: source }],
    inlines,
    translator: TRANSLATOR,
    revision: 1,
    reviewState: "machine-draft",
    lang: "en",
    ...over,
  });
const text = (t: string) => [{ kind: "text" as const, text: t }];
const UNITS: TranslationUnit[] = [
  unit("t-p1-s1", "t-p1-s1", [
    { kind: "text", text: "The results lead to a conclusion" },
    { kind: "footnote-mark", mark: "1)", footnoteId: "t-fn1" },
    { kind: "text", text: "." },
  ]),
  unit("t-p1-s2", "t-p1-s2", text("It is to be derived here.")),
  unit("t-p2-s1a", "t-p2-s1", text("Then the light possesses the energy:")),
  unit("eq-t-d1", "eq-t-d1", [{ kind: "math", latex: "l^* = l", equationId: "eq-t-d1" }]),
  unit("t-p2-s1b", "t-p2-s1", text("where V denotes the velocity of light.")),
  unit("t-fn1", "t-fn1", text("A. Einstein, Ann. d. Phys. 17.")),
  unit("closing-dateline", "closing-dateline", text("Bern, September 1905.")),
];
const edge = (blockId: string, sentenceId: string | undefined, unitId: string) => ({
  source: { paper: "mass-energy", blockId, ...(sentenceId ? { sentenceId } : {}) },
  target: { translationUnitId: unitId },
});
const ALIGNMENT = validateAlignment({
  id: "align-t",
  paper: "mass-energy",
  edges: [
    edge("t-p1", "t-p1-s1", "t-p1-s1"),
    edge("t-p1", "t-p1-s2", "t-p1-s2"),
    edge("t-p2", "t-p2-s1", "t-p2-s1a"),
    edge("eq-t-d1", undefined, "eq-t-d1"),
    edge("t-p2", "t-p2-s1", "t-p2-s1b"),
    edge("t-fn1", undefined, "t-fn1"),
    edge("closing-dateline", undefined, "closing-dateline"),
  ],
});

const measure = (html: string) => ({
  paragraphs: [...html.matchAll(/data-source-paragraph="([^"]+)"/g)].map((m) => m[1]),
  badges: [...html.matchAll(/data-review-badge="([^"]+)"/g)].map((m) => m[1]),
  status: html.split('role="status"').length - 1,
  liveRegions: html.split('role="status" aria-live="polite" data-alignment-live-region').length - 1,
  banner:
    /data-unreviewed-banner="true">([\s\S]*?)<\/aside>/.exec(html)?.[1]?.replace(/<[^>]+>/g, " ") ??
    "",
  agentBanner:
    /data-agent-checked-banner="true">([\s\S]*?)<\/aside>/
      .exec(html)?.[1]
      ?.replace(/<[^>]+>/g, " ") ?? "",
});

// The German blocks PaperPage passes: only kind, containedIn and sentence ids matter to grouping.
const block = (id: string, kind: string, spans: string[] = [], containedIn?: string) =>
  ({
    id,
    kind,
    ...(containedIn ? { containedIn } : {}),
    sentenceSpans: spans.map((s) => ({ id: s })),
  }) as unknown as SourceBlock;
const BLOCKS: SourceBlock[] = [
  block("t-p1", "paragraph", ["t-p1-s1", "t-p1-s2"]),
  block("t-p2", "paragraph", ["t-p2-s1"]),
  block("eq-t-d1", "equation", [], "t-p2"),
  block("t-fn1", "footnote", ["t-fn1"]),
  block("closing-dateline", "closing", ["closing-dateline"]),
];

describe("the English face reads as paragraphs", () => {
  const html = renderToStaticMarkup(
    <EnglishFace
      paper={FIXTURE_MASS_ENERGY_PAPER}
      units={UNITS}
      alignment={ALIGNMENT}
      blocks={BLOCKS}
    />,
  );

  test("with no blocks to ask, a display still joins the paragraph it follows", () => {
    const bare = renderToStaticMarkup(
      <EnglishFace paper={FIXTURE_MASS_ENERGY_PAPER} units={UNITS} alignment={ALIGNMENT} />,
    );
    // Nothing says closing-dateline is a closing line, so it is set as a paragraph of its own.
    expect(measure(bare).paragraphs).toEqual(["t-p1", "t-p2", "closing-dateline"]);
    const p2 = bare.slice(bare.indexOf('data-source-paragraph="t-p2"'));
    expect(p2.slice(0, p2.indexOf("</p>"))).toContain(' id="eq-t-d1"');
  });

  test("sentence units run on as one paragraph per source paragraph, a display inside its own", () => {
    const m = measure(html);
    expect(m.paragraphs).toEqual(["t-p1", "t-p2"]);
    const p2 = html.slice(html.indexOf('data-source-paragraph="t-p2"'));
    const para = p2.slice(0, p2.indexOf("</p>"));
    expect(para.indexOf(' id="t-p2-s1a"')).toBeLessThan(para.indexOf(' id="eq-t-d1"'));
    expect(para.indexOf(' id="eq-t-d1"')).toBeLessThan(para.indexOf(' id="t-p2-s1b"'));
    expect(para).toContain('class="katex-display"');
    // The footnote stands alone, headed by its printed mark; the closing line is no paragraph.
    expect(html).toContain(
      '<aside class="translation-footnote" data-source-footnote="t-fn1"><span class="footnote-ref">1) </span>',
    );
    expect(html).toContain('data-source-block="closing-dateline"');
  });

  test("every unit keeps its id and its own keyboard-reachable 'Show the German source'", () => {
    for (const u of UNITS) expect(html).toContain(` id="${u.id}"`);
    const buttons = [...html.matchAll(/<button[^>]*data-action="show-aligned-source"[^>]*>/g)].map(
      (m) => m[0],
    );
    expect(buttons.length).toBe(UNITS.length);
    for (const b of buttons) expect(b).not.toContain('tabindex="-1"');
  });

  test("no review banner or chip, and no static content is a live region", () => {
    const m = measure(html);
    expect(m.badges).toEqual([]);
    expect(m.banner).toBe("");
    expect(m.agentBanner).toBe("");
    expect(m.status).toBe(m.liveRegions);
    expect(m.liveRegions).toBe(1);
  });

  // Mixed states were the case that earned a chip (the one unit that differs from the rest) and a
  // "partly reviewed" banner. Now they earn neither, and the reviewer's name stays in the record.
  test("one reviewed unit among drafts: still no chip, no banner and no reviewer named", () => {
    const reviewedOne = UNITS.map((u) =>
      u.id === "t-p1-s2"
        ? unit(u.id, "t-p1-s2", u.inlines, {
            reviewState: "reviewed",
            editor: { id: "reviewer-a", name: "Reviewer A", kind: "human" },
          })
        : u,
    );
    const mixed = renderToStaticMarkup(
      <EnglishFace
        paper={FIXTURE_MASS_ENERGY_PAPER}
        units={reviewedOne}
        alignment={ALIGNMENT}
        blocks={BLOCKS}
      />,
    );
    const m = measure(mixed);
    expect(m.badges).toEqual([]);
    expect(m.banner).toBe("");
    expect(m.agentBanner).toBe("");
    expect(mixed).not.toContain("Reviewer A");
  });
});

describe("mass-energy's live English face", () => {
  test("has one paragraph per printed paragraph, every unit, no badge, and one live region", async () => {
    const edition = await loadBilingualEdition("mass-energy");
    const printed = (edition?.blocks ?? []).filter((b) => b.kind === "paragraph").map((b) => b.id);
    expect(printed.length).toBeGreaterThan(0);
    const html = await exportMarkup(await PaperPage({ paperId: "mass-energy", face: "english" }));
    const m = measure(html);
    expect([...m.paragraphs].sort()).toEqual([...printed].sort());
    expect(m.paragraphs.length).toBe(printed.length);
    for (const u of edition?.units ?? []) expect(html).toContain(` id="${u.id}"`);
    expect(m.badges).toEqual([]);
    expect(m.status).toBe(1);
    // Every unit is final under D-2026-09-25-agent-reviewed-translations, and since
    // D-2026-09-25-no-review-status-banners the face says nothing about it: no banner, and no
    // claim of a person's review either.
    expect(m.banner).toBe("");
    expect(m.agentBanner).toBe("");
    expect(html).not.toContain("AI agents");
    expect(html).not.toMatch(/reviewed by (?:a person|[A-Z][a-z]+ [A-Z])/);
  });
});
