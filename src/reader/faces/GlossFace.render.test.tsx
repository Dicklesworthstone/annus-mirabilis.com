import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
    expect(html).toContain("Gloss not yet available for this section.");
    expect(html).toContain('href="/papers/mass-energy/?view=parallel#me-p2-s2"');
    expect(html).toContain('data-parallel-fallback="true"');
  });

  test("sentence actions: 3 standard actions present in stable order; 4th action present only when toggle is on", () => {
    // Toggle OFF
    const htmlOff = renderToStaticMarkup(
      <GlossFace {...defaultProps} initialReasoningWords={false} />,
    );
    expect(htmlOff).toContain('data-action="read-german"');
    expect(htmlOff).toContain('data-action="read-glosses"');
    expect(htmlOff).toContain('data-action="read-translation"');
    expect(htmlOff).not.toContain('data-action="read-reasoning"');

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
      <GlossFace paper={FIXTURE_MASS_ENERGY_PAPER} blocks={[]} glossUnits={[]} />,
    );

    expect(htmlFallback).toContain('data-face-fallback="gloss"');
    expect(htmlFallback).toContain(
      "German source text and interlinear gloss for this paper are in preparation.",
    );
    expect(htmlFallback).not.toContain("gloss-pairs-container");
  });
});
