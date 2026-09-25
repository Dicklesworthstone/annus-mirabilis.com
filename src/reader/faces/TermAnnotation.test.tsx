import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FIXTURE_BROWNIAN_ALIGNMENT,
  FIXTURE_BROWNIAN_PAPER,
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  FIXTURE_BROWNIAN_TRANSLATION_UNITS,
  FIXTURE_EDITORIAL_NOTES,
  FIXTURE_REVIEW_RECORDS,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { EnglishFace } from "./EnglishFace.tsx";
import { GermanFace } from "./GermanFace.tsx";
import { ParallelFace } from "./ParallelFace.tsx";
import { TermAnnotation } from "./TermAnnotation.tsx";

describe("TermAnnotation unit and face integration", () => {
  let container: HTMLElement;

  beforeEach(async () => {
    await installDom();
    container = createContainer();
  });

  afterEach(async () => {
    removeContainer(container);
    await uninstallDom();
  });

  test("without JavaScript the word is plain text, so the no-script rule cannot hide it", () => {
    // The layout hides every enabled button when scripts do not run
    // (components/chrome/noScriptControls.ts). The server markup is what a reader without
    // JavaScript gets, so it must carry the word as text and no button at all.
    const html = renderToStaticMarkup(
      <TermAnnotation
        termId="term-verschiebung"
        text="Verschiebung"
        definition="Die räumliche Ortsveränderung eines suspendierten mikroskopischen Teilchens infolge unregelmäßiger molekularer Stöße der umgebenden Flüssigkeitsmoleküle."
        lang="de"
      />,
    );
    expect(html).toContain('data-term-text="term-verschiebung"');
    expect(html).toContain('lang="de"');
    expect(html).toContain(">Verschiebung<");
    expect(html).not.toContain("<button");
  });

  test("once hydrated, the trigger is a native button with its accessible attributes", async () => {
    const termDef =
      "Die räumliche Ortsveränderung eines suspendierten mikroskopischen Teilchens infolge unregelmäßiger molekularer Stöße der umgebenden Flüssigkeitsmoleküle.";
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <TermAnnotation
          termId="term-verschiebung"
          text="Verschiebung"
          definition={termDef}
          lang="de"
        />,
      );
    });
    const html = container.innerHTML;

    expect(html).toContain('data-term-id="term-verschiebung"');
    expect(html).toContain('data-term-expanded="false"');
    // A native <button>, so the trigger needs no role override and no tabindex:
    // it is focusable and Enter/Space-activated by the platform. Both absences
    // are asserted, so a silent regression to <abbr role="button" tabindex="0">
    // would fail here rather than pass quietly.
    expect(html).toContain("<button");
    expect(html).toContain('type="button"');
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain('tabindex="0"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(`title="${termDef}"`);
    expect(html).toContain("Verschiebung");
  });

  test("period term definition strictly satisfies the > 80 characters requirement", () => {
    const s4Block = FIXTURE_BROWNIAN_SOURCE_BLOCKS.find((b) => b.id === "bm-s4-p1");
    expect(s4Block).toBeDefined();

    const termInline = s4Block?.inlines.find((i) => i.kind === "term");
    expect(termInline).toBeDefined();
    if (termInline && termInline.kind === "term") {
      expect(termInline.definition).toBeDefined();
      expect((termInline.definition ?? "").length).toBeGreaterThan(80);
      expect(termInline.termId).toBe("term-verschiebung");
      expect(termInline.text).toBe("Verschiebung");
    }

    const trUnit = FIXTURE_BROWNIAN_TRANSLATION_UNITS.find((u) => u.id === "tr-bm-s4-p1-u2");
    expect(trUnit).toBeDefined();
    const trTermInline = trUnit?.inlines.find((i) => i.kind === "term");
    expect(trTermInline).toBeDefined();
    if (trTermInline && trTermInline.kind === "term") {
      expect(trTermInline.definition).toBeDefined();
      expect((trTermInline.definition ?? "").length).toBeGreaterThan(80);
      expect(trTermInline.termId).toBe("term-verschiebung");
      expect(trTermInline.text).toBe("displacement");
    }
  });

  test("click/touch interaction opens popover dialog with authored definition, and close button dismisses it", async () => {
    const root = createRoot(container);
    const definitionText =
      "Die räumliche Ortsveränderung eines suspendierten mikroskopischen Teilchens infolge unregelmäßiger molekularer Stöße der umgebenden Flüssigkeitsmoleküle.";

    await act(async () => {
      root.render(
        <TermAnnotation
          termId="term-verschiebung"
          text="Verschiebung"
          definition={definitionText}
          lang="de"
        />,
      );
    });

    const trigger = container.querySelector<HTMLElement>('[data-term-id="term-verschiebung"]');
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute("data-term-expanded")).toBe("false");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");

    // Initially popover is not present
    expect(container.querySelector('[data-term-popover="term-verschiebung"]')).toBeNull();

    // Click / touch to activate
    await act(async () => {
      trigger?.click();
    });

    expect(trigger?.getAttribute("data-term-expanded")).toBe("true");
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");

    const popover = container.querySelector<HTMLElement>('[data-term-popover="term-verschiebung"]');
    expect(popover).not.toBeNull();
    expect(popover?.getAttribute("role")).toBe("dialog");
    expect(popover?.textContent).toContain(definitionText);

    // Dismiss using the close button
    const closeBtn = container.querySelector<HTMLButtonElement>(
      'button[data-term-close="term-verschiebung"]',
    );
    expect(closeBtn).not.toBeNull();

    await act(async () => {
      closeBtn?.click();
    });

    expect(trigger?.getAttribute("data-term-expanded")).toBe("false");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector('[data-term-popover="term-verschiebung"]')).toBeNull();
  });

  test("keyboard activation: Enter toggles open/close, Escape dismisses popover, Space toggles open", async () => {
    const root = createRoot(container);
    const definitionText =
      "Die räumliche Ortsveränderung eines suspendierten mikroskopischen Teilchens infolge unregelmäßiger molekularer Stöße der umgebenden Flüssigkeitsmoleküle.";

    await act(async () => {
      root.render(
        <TermAnnotation
          termId="term-verschiebung"
          text="Verschiebung"
          definition={definitionText}
          lang="de"
        />,
      );
    });

    const trigger = container.querySelector<HTMLElement>('[data-term-id="term-verschiebung"]');
    expect(trigger).not.toBeNull();

    // Press Enter to open
    await act(async () => {
      trigger?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(trigger?.getAttribute("data-term-expanded")).toBe("true");
    expect(container.querySelector('[data-term-popover="term-verschiebung"]')).not.toBeNull();

    // Press Escape to close
    await act(async () => {
      trigger?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(trigger?.getAttribute("data-term-expanded")).toBe("false");
    expect(container.querySelector('[data-term-popover="term-verschiebung"]')).toBeNull();

    // Press Space to open
    await act(async () => {
      trigger?.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    });

    expect(trigger?.getAttribute("data-term-expanded")).toBe("true");
    expect(container.querySelector('[data-term-popover="term-verschiebung"]')).not.toBeNull();
  });

  test("an English note on a German word is read in English, and the word in German", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <TermAnnotation
          termId="term-traegheit"
          text="Trägheit"
          definition="Inertia: a body's resistance to a change in its motion, measured by its mass, as this note explains."
          lang="de"
          definitionLang="en"
        />,
      );
    });
    const trigger = container.querySelector<HTMLElement>('[data-term-id="term-traegheit"]');
    expect(trigger?.getAttribute("lang")).toBe("de");
    await act(async () => {
      trigger?.click();
    });
    const definition = container.querySelector<HTMLElement>(".term-annotation-definition");
    expect(definition).not.toBeNull();
    expect(definition?.getAttribute("lang")).toBe("en");
  });

  test("all three faces render term annotations with authored definitions", () => {
    // 1. GermanFace
    const germanHtml = renderToStaticMarkup(
      <GermanFace
        paper={FIXTURE_BROWNIAN_PAPER}
        blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        editorialNotes={FIXTURE_EDITORIAL_NOTES}
      />,
    );
    expect(germanHtml).toContain('data-term-text="term-verschiebung"');
    expect(germanHtml).toContain("Verschiebung");

    // 2. EnglishFace
    const englishHtml = renderToStaticMarkup(
      <EnglishFace
        paper={FIXTURE_BROWNIAN_PAPER}
        units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        editorialNotes={FIXTURE_EDITORIAL_NOTES}
        reviewRecords={FIXTURE_REVIEW_RECORDS}
      />,
    );
    expect(englishHtml).toContain('data-term-text="term-verschiebung"');
    expect(englishHtml).toContain("displacement");

    // 3. ParallelFace
    const parallelHtml = renderToStaticMarkup(
      <ParallelFace
        paper={FIXTURE_BROWNIAN_PAPER}
        blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
        units={FIXTURE_BROWNIAN_TRANSLATION_UNITS}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        editorialNotes={FIXTURE_EDITORIAL_NOTES}
        reviewRecords={FIXTURE_REVIEW_RECORDS}
      />,
    );
    expect(parallelHtml).toContain('data-term-text="term-verschiebung"');
    expect(parallelHtml).toContain("Verschiebung");
    expect(parallelHtml).toContain("displacement");
  });
});
