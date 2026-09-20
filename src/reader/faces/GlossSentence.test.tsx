/**
 * A gloss sentence is a fragment target, not a scroll region (am-6iz4).
 *
 * WHY THIS EXISTS. Both wrappers carried tabIndex={0}, which put every sentence of the
 * reading face into the tab order. Nothing in the CSS gives `.gloss-sentence` or
 * `.gloss-sentence-missing` overflow or a height, so there was nothing to scroll: the
 * stops were redundant, and the full-gloss variant already carries real stops of its own
 * in its actions nav, so each one sat in front of buttons that were already reachable.
 * They are focus targets for the `#sentenceId` deep link, which needs -1 and not 0.
 *
 * The negative a naive implementation fails: restoring tabIndex={0} - the state the file
 * was in - fails the first test here, not only biome's a11y rule.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { GlossUnit } from "../../content/schemas/source.ts";
import { GlossSentence } from "./GlossSentence.tsx";

const GLOSS: GlossUnit = {
  sentenceId: "s0-p1-s1",
  revision: 1,
  sourceRevision: 1,
  sourceTextDigest: "sha256:test",
  lang: "en",
  sourceLang: "de",
  attribution: { id: "agent:test", kind: "model" },
  reviewState: "draft",
  tokens: [
    { german: "Gibt", english: "Does" },
    { german: "die", english: "the" },
  ],
  multiwordUnits: [],
};

describe("GlossSentence (am-6iz4)", () => {
  test("neither variant puts the sentence wrapper in the tab order", () => {
    for (const [name, element] of [
      [
        "missing gloss",
        <GlossSentence
          key="a"
          sentenceId="s0-p1-s1"
          germanText="Gibt die Trägheit"
          modalityClasses={[]}
        />,
      ],
      [
        "full gloss",
        <GlossSentence
          key="b"
          sentenceId="s0-p1-s1"
          germanText="Gibt die Trägheit"
          glossUnit={GLOSS}
          modalityClasses={[]}
        />,
      ],
    ] as const) {
      const html = renderToStaticMarkup(element);
      const wrapper = html.slice(0, html.indexOf(">") + 1);
      expect(wrapper, `${name}: the sentence wrapper is a tab stop`).not.toContain('tabindex="0"');
      expect(wrapper, `${name}: the sentence wrapper is not focusable at all`).toContain(
        'tabindex="-1"',
      );
    }
  });

  test("both variants stay reachable as the deep link's focus target", () => {
    for (const element of [
      <GlossSentence key="a" sentenceId="s0-p1-s1" germanText="Gibt" modalityClasses={[]} />,
      <GlossSentence
        key="b"
        sentenceId="s0-p1-s1"
        germanText="Gibt"
        glossUnit={GLOSS}
        modalityClasses={[]}
      />,
    ]) {
      const html = renderToStaticMarkup(element);
      // The href in the missing variant points at this id from the parallel face.
      expect(html).toContain('id="s0-p1-s1"');
      expect(html).toContain('data-sentence-id="s0-p1-s1"');
    }
  });

  test("the missing-gloss sentence announces itself like its glossed sibling", () => {
    // 51fff71c turned this branch from a bare <div> into a labelled <section>. It had no
    // coverage, so the label could be dropped again without anything failing.
    const html = renderToStaticMarkup(
      <GlossSentence sentenceId="s0-p1-s1" germanText="Gibt die Trägheit" modalityClasses={[]} />,
    );
    expect(html).toContain('aria-labelledby="sentence-german-s0-p1-s1"');
    expect(html).toContain('id="sentence-german-s0-p1-s1"');
  });
});
