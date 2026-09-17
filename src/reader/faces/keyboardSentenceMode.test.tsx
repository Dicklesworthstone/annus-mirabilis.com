import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
  FIXTURE_BROWNIAN_ALIGNMENT,
  FIXTURE_BROWNIAN_PAPER,
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  FIXTURE_BROWNIAN_TRANSLATION_UNITS,
  FIXTURE_EDITORIAL_NOTES,
  FIXTURE_REVIEW_RECORDS,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../../testing/reactDom.ts";
import { ParallelFace } from "./ParallelFace.tsx";

describe("keyboard sentence mode and alignment interactions", () => {
  let container: HTMLElement;

  beforeEach(async () => {
    await installDom();
    container = createContainer();
  });

  afterEach(async () => {
    removeContainer(container);
    await uninstallDom();
  });

  test("Align sentences control enters sentence mode and focuses first sentence", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ParallelFace
          paper={FIXTURE_BROWNIAN_PAPER}
          blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
          units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
          alignment={FIXTURE_BROWNIAN_ALIGNMENT}
          editorialNotes={FIXTURE_EDITORIAL_NOTES}
          reviewRecords={FIXTURE_REVIEW_RECORDS}
        />,
      );
    });

    const alignBtn = container.querySelector<HTMLButtonElement>(
      'button[data-align-sentences-control="true"][data-block-id="bm-s4-p1"]',
    );
    expect(alignBtn).not.toBeNull();

    // Click "Align sentences" control
    await act(async () => {
      alignBtn?.click();
    });

    // First sentence in paragraph bm-s4-p1 should be active and focused
    const firstSentence = container.querySelector<HTMLElement>('[data-sentence-id="bm-s4-p1-s1"]');
    expect(firstSentence).not.toBeNull();
    expect(firstSentence?.getAttribute("data-aligned-active")).toBe("true");
    expect(document.activeElement).toBe(firstSentence);

    // Aligned translation partner tr-bm-s4-p1-u1 should be lit
    const partnerUnit = container.querySelector<HTMLElement>(
      '[data-translation-unit-id="tr-bm-s4-p1-u1"]',
    );
    expect(partnerUnit?.getAttribute("data-aligned-partner")).toBe("true");
  });

  test("keyboard navigation: ArrowDown / j steps forward, ArrowUp / k steps backward", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ParallelFace
          paper={FIXTURE_BROWNIAN_PAPER}
          blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
          units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
          alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        />,
      );
    });

    const alignBtn = container.querySelector<HTMLButtonElement>(
      'button[data-align-sentences-control="true"][data-block-id="bm-s4-p1"]',
    );
    await act(async () => {
      alignBtn?.click();
    });

    // Press ArrowDown to navigate to next sentence
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });

    const secondSentence = container.querySelector<HTMLElement>(
      '[data-sentence-id="bm-s4-p1-s2"]',
    );
    expect(secondSentence?.getAttribute("data-aligned-active")).toBe("true");
    expect(document.activeElement).toBe(secondSentence);

    // Press ArrowUp to navigate back
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    });

    const firstSentence = container.querySelector<HTMLElement>('[data-sentence-id="bm-s4-p1-s1"]');
    expect(firstSentence?.getAttribute("data-aligned-active")).toBe("true");
    expect(document.activeElement).toBe(firstSentence);
  });

  test("Enter announces aligned text in the other language to live region", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ParallelFace
          paper={FIXTURE_BROWNIAN_PAPER}
          blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
          units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
          alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        />,
      );
    });

    const alignBtn = container.querySelector<HTMLButtonElement>(
      'button[data-align-sentences-control="true"][data-block-id="bm-s4-p1"]',
    );
    await act(async () => {
      alignBtn?.click();
    });

    // Press Enter to announce English translation of current German sentence
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    const liveRegion = container.querySelector<HTMLElement>("[data-alignment-live-region]");
    expect(liveRegion?.textContent).toContain("English translation:");
    expect(liveRegion?.textContent).toContain("Let a time interval τ be given.");
  });

  test("Escape returns focus to the Align sentences control and clears highlights", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ParallelFace
          paper={FIXTURE_BROWNIAN_PAPER}
          blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
          units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
          alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        />,
      );
    });

    const alignBtn = container.querySelector<HTMLButtonElement>(
      'button[data-align-sentences-control="true"][data-block-id="bm-s4-p1"]',
    );
    await act(async () => {
      alignBtn?.click();
    });

    // Press Escape
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    // Focus returned to the control
    expect(document.activeElement).toBe(alignBtn);

    // Active highlight cleared
    const activeEl = container.querySelector("[data-aligned-active]");
    expect(activeEl).toBeNull();

    const liveRegion = container.querySelector<HTMLElement>("[data-alignment-live-region]");
    expect(liveRegion?.textContent).toContain("Exited sentence mode");
  });

  test("on-demand action: Show the German source announces original text", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ParallelFace
          paper={FIXTURE_BROWNIAN_PAPER}
          blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
          units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
          alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        />,
      );
    });

    const showSourceBtn = container.querySelector<HTMLButtonElement>(
      'button[data-action="show-aligned-source"][data-unit-id="tr-bm-s4-p1-u1"]',
    );
    expect(showSourceBtn).not.toBeNull();

    await act(async () => {
      showSourceBtn?.click();
    });

    const liveRegion = container.querySelector<HTMLElement>("[data-alignment-live-region]");
    expect(liveRegion?.textContent).toContain("German source:");
    expect(liveRegion?.textContent).toContain("Es sei ein Zeitintervall τ gegeben.");
  });
});
