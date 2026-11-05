import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type TranslationUnit,
  validateAlignment,
  validateTranslationUnit,
} from "../../content/schemas/source.ts";
import { TranslationParagraphs } from "./TranslationParagraphs.tsx";

function unit(id: string, sourceId: string): TranslationUnit {
  return validateTranslationUnit({
    id,
    sourceRefs: [{ paper: "mass-energy", id: sourceId }],
    inlines: [{ kind: "text", text: "An English sentence." }],
    translator: { id: "agent:test", kind: "model", modelId: "test" },
    revision: 1,
    reviewState: "machine-draft",
    lang: "en",
  });
}

function links(html: string): readonly string[] {
  return [...html.matchAll(/<a[^>]*data-action="show-aligned-source"[^>]*>/g)].map(
    (match) => match[0],
  );
}

describe("English sentences have German source links before hydration", () => {
  test("both halves of a split translation use the recorded German sentence", () => {
    const units = [unit("s0-p2-s1a", "s0-p2-s1"), unit("s0-p2-s1b", "s0-p2-s1")];
    const html = renderToStaticMarkup(<TranslationParagraphs units={units} />);
    const actions = links(html);
    expect(actions).toHaveLength(2);
    for (const link of actions) {
      expect(link).toContain('href="/papers/mass-energy/view/german/#s0-p2-s1"');
      expect(link).not.toContain('tabindex="-1"');
    }
    expect(html).not.toMatch(/<button[^>]*data-action="show-aligned-source"/);
  });

  test("the alignment edge, rather than the English id or a guessed suffix, owns the target", () => {
    const units = [unit("s0-p2-s1a", "s0-p2-s1")];
    const alignment = validateAlignment({
      id: "source-link-alignment",
      paper: "mass-energy",
      edges: [
        {
          source: { paper: "mass-energy", blockId: "s0-p3", sentenceId: "s0-p3-s2" },
          target: { translationUnitId: units[0]?.id },
        },
        {
          source: { paper: "mass-energy", blockId: "s0-p4", sentenceId: "s0-p4-s1" },
          target: { translationUnitId: units[0]?.id },
        },
      ],
    });
    const actions = links(
      renderToStaticMarkup(<TranslationParagraphs units={units} alignment={alignment} />),
    );
    expect(actions).toHaveLength(1);
    expect(actions[0]).toContain('href="/papers/mass-energy/view/german/#s0-p3-s2"');
    expect(actions[0]).not.toContain("#s0-p2-s1");
  });

  test("a display aligned to a whole source block links to that block", () => {
    const units = [unit("eq-s0-d1", "eq-s0-d1")];
    const alignment = validateAlignment({
      id: "display-source-link",
      paper: "mass-energy",
      edges: [
        {
          source: { paper: "mass-energy", blockId: "eq-s0-d1" },
          target: { translationUnitId: "eq-s0-d1" },
        },
      ],
    });
    const actions = links(
      renderToStaticMarkup(
        <TranslationParagraphs units={units} alignment={alignment} anchorPrefix="en-" />,
      ),
    );
    expect(actions).toHaveLength(1);
    expect(actions[0]).toContain('href="/papers/mass-energy/view/german/#eq-s0-d1"');
    expect(actions[0]).not.toContain("#en-");
  });
});
