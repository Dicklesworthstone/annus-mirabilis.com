import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_MODALITY_CLASSES } from "../../content/schemas/glossConventions.pure.ts";
import {
  FIXTURE_MASS_ENERGY_ALIGNMENT,
  FIXTURE_MASS_ENERGY_GLOSS_UNITS,
  FIXTURE_MASS_ENERGY_PAPER,
  FIXTURE_MASS_ENERGY_SOURCE_BLOCKS,
  FIXTURE_MASS_ENERGY_TRANSLATION_UNITS,
} from "../../testing/fixtures/bilingual/massEnergyGlossFixture.ts";
import { GlossFace } from "./GlossFace.tsx";

describe("GlossFace component rendering and interactions", () => {
  const defaultProps = {
    paper: FIXTURE_MASS_ENERGY_PAPER,
    blocks: FIXTURE_MASS_ENERGY_SOURCE_BLOCKS,
    glossUnits: FIXTURE_MASS_ENERGY_GLOSS_UNITS,
    translations: FIXTURE_MASS_ENERGY_TRANSLATION_UNITS,
    alignment: FIXTURE_MASS_ENERGY_ALIGNMENT,
    // GlossFace is a Client Component: the server resolves the modality
    // vocabulary and passes it in. This is the list loadGlossConventions()
    // returns while docs/editorial/GLOSS_CONVENTIONS.md is absent.
    modalityClasses: DEFAULT_MODALITY_CLASSES,
  };

  test("renders continuous gloss face with German title, subtitle, and default toggle state (off)", () => {
    const html = renderToStaticMarkup(<GlossFace {...defaultProps} />);

    expect(html).toContain("Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?");
    expect(html).toContain('data-face="gloss"');
    expect(html).toContain('data-reasoning-words="off"');
    expect(html).toContain("Show the reasoning words");
  });

  test("entry-link slot: empty slot renders nothing, configured slot renders real link with return caption", () => {
    // Empty slot
    const htmlEmpty = renderToStaticMarkup(<GlossFace {...defaultProps} entryLink={undefined} />);
    expect(htmlEmpty).not.toContain("gloss-entry-link-slot");
    expect(htmlEmpty).not.toContain("foundation-entry-link");

    // Configured slot
    const htmlConfigured = renderToStaticMarkup(
      <GlossFace
        {...defaultProps}
        entryLink={{
          href: "/foundations/reading-german-physics-sentence",
          caption: "Back to the gloss face at the same sentence",
          label: "Read the foundation on German physics sentences",
        }}
      />,
    );

    expect(htmlConfigured).toContain("gloss-entry-link-slot");
    expect(htmlConfigured).toContain('href="/foundations/reading-german-physics-sentence"');
    expect(htmlConfigured).toContain(
      'data-return-caption="Back to the gloss face at the same sentence"',
    );
    expect(htmlConfigured).toContain("Read the foundation on German physics sentences");
  });

  test("unglossed sentence renders honest coverage notice and link to parallel face", () => {
    const html = renderToStaticMarkup(<GlossFace {...defaultProps} />);

    // Sentence me-p2-s2 is intentionally unglossed
    expect(html).toContain('data-sentence-id="me-p2-s2"');
    // One quiet link, where a boxed notice stood under every unglossed sentence; which sections
    // have no gloss is said once, at the top of the face (glossUnglossedSentence.test.tsx).
    expect(html).not.toContain("Gloss not yet available for this section.");
    expect(html).toContain("Read this sentence in the parallel face");
    // The parallel face's own route. This asserted /papers/mass-energy/?view=parallel#me-p2-s2,
    // the paper's landing page, where no face renders and the sentence id does not exist
    // (glossUnglossedSentence.test.tsx).
    expect(html).toContain('href="/papers/mass-energy/view/parallel/#me-p2-s2"');
    expect(html).not.toContain("?view=parallel");
    expect(html).toContain('data-parallel-fallback="true"');
  });

  test("sentence actions: reasoning source is static and visibility follows the native toggle", () => {
    // Toggle OFF
    const htmlOff = renderToStaticMarkup(
      <GlossFace {...defaultProps} initialReasoningWords={false} />,
    );
    expect(htmlOff).toContain('data-action="read-german"');
    expect(htmlOff).toContain('data-action="read-glosses"');
    expect(htmlOff).toContain('data-action="read-translation"');
    // The source layer is rendered once on the server. Native :checked CSS,
    // rather than client-side removal/recreation, controls its visibility.
    expect(htmlOff).toContain('data-action="read-reasoning"');
    expect(htmlOff).toContain('data-reasoning-action="true"');
    expect(htmlOff).toContain('data-reasoning-words="off"');
    expect(htmlOff).not.toContain('checked=""');

    // Toggle ON
    const htmlOn = renderToStaticMarkup(
      <GlossFace {...defaultProps} initialReasoningWords={true} />,
    );
    expect(htmlOn).toContain('data-action="read-german"');
    expect(htmlOn).toContain('data-action="read-glosses"');
    expect(htmlOn).toContain('data-action="read-translation"');
    expect(htmlOn).toContain('data-action="read-reasoning"');
  });

  test("in-place reasoning words list: renders real static <ol> in token order when toggle is on", () => {
    const htmlOn = renderToStaticMarkup(
      <GlossFace {...defaultProps} initialReasoningWords={true} />,
    );

    expect(htmlOn).toContain("reasoning-words-details");
    expect(htmlOn).toContain("List the reasoning words in this sentence");
    expect(htmlOn).toContain("reasoning-words-ol");
    expect(htmlOn).toContain("reasoning-word-item");
    expect(htmlOn).toContain("[konjunktiv-i]");
  });

  test("when no blocks exist, renders honest FaceFallback notice without crashing or inventing text", () => {
    const htmlFallback = renderToStaticMarkup(
      <GlossFace
        paper={FIXTURE_MASS_ENERGY_PAPER}
        blocks={[]}
        glossUnits={[]}
        modalityClasses={DEFAULT_MODALITY_CLASSES}
      />,
    );

    expect(htmlFallback).toContain('data-face-fallback="gloss"');
    expect(htmlFallback).toContain(
      "German source text and interlinear gloss for this paper are in preparation.",
    );
    expect(htmlFallback).not.toContain("gloss-pairs-container");
  });

  test("sentence-alignment integration: renders data-reader-root, AlignmentController live region, and source-sentence anchors", () => {
    const html = renderToStaticMarkup(<GlossFace {...defaultProps} />);

    // Reader root contract
    expect(html).toContain("data-reader-root");

    // AlignmentController live region
    expect(html).toContain('data-alignment-live-region="true"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');

    // Sentence anchors for alignment highlighting and keyboard stepping
    expect(html).toContain('data-sentence-id="me-p1-s1"');
    expect(html).toContain('data-source-sentence="true"');

    // -1, NOT 0, and the distinction is the point rather than an implementation
    // detail. A gloss sentence is a FRAGMENT TARGET, not a scroll region: nothing
    // in the CSS gives it overflow or a height, so tabIndex={0} put every sentence
    // in the tab order for nothing - a keyboard reader tabbing through the face
    // stopped at each sentence with nothing to do there. 0c890a0f changed it to -1,
    // which keeps the element focusable for the #sentenceId deep link, the route
    // that returns a reader to the exact sentence, while removing it from the
    // sequential tab order.
    //
    // This assertion previously read tabindex="0" and was stale, not wrong about
    // the code: it outlived the fix by asserting the behaviour the fix removed.
    // Both directions are pinned below so restoring 0 fails here rather than
    // passing quietly.
    expect(html).toContain('tabindex="-1"');
    expect(html).not.toContain('tabindex="0"');
  });
});
