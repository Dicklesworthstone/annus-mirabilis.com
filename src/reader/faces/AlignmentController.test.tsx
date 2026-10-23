import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Alignment, SourceBlock, TranslationUnit } from "../../content/schemas/source.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { AlignmentController } from "./AlignmentController.tsx";
import { buildAlignmentIndex } from "./alignment.ts";

/**
 * THE LIVE ALIGNMENT BEHAVIOUR, WHICH HAD NO TEST WHILE ITS UNUSED TWIN HAD 6.5 KB OF THEM.
 *
 * Measured 2026-10-23: `src/reader/faces/alignmentHighlight.ts` -- a pure module exporting
 * `computeHighlights`, `nextSentenceId` and `prevSentenceId`, with `alignmentHighlight.test.ts`
 * beside it -- was imported by NO production module. `AlignmentController.tsx`, the client island
 * a reader actually runs, reached the same answers by walking the index itself, and the only test
 * naming it was `GlossFace.render.test.tsx`, which renders a face rather than exercising
 * alignment. So the assertions existed and the behaviour was unproven, which is the shape
 * AGENTS.md calls "A Check Inherits The Silence Of Whatever It Reads" one level up: the check was
 * reading a module nobody executed.
 *
 * The controller now delegates to that module, which is what makes its test mean something. This
 * file is the other half: the DOM behaviour the delegation must not have changed. It drives the
 * real island over a real happy-dom document with an index built by the real
 * `buildAlignmentIndex`, so nothing here is a restatement of the controller's own code.
 *
 * THE INDEX IS DELIBERATELY ASYMMETRIC. s1-p1-s1 aligns to TWO units and s1-p1-s2 to one, because
 * a one-to-one fixture cannot tell "highlight the partners" from "highlight the partner", and
 * many-to-many is the alignment model AGENTS.md requires ("never relies on matching paragraph
 * counts"). s1-p1-s3 is aligned to nothing, which is the control for a controller that highlights
 * whatever it can find.
 */

const ALIGNMENT = {
  paper: "mass-energy",
  edges: [
    { source: { blockId: "s1-p1", sentenceId: "s1-p1-s1" }, target: { translationUnitId: "u1" } },
    { source: { blockId: "s1-p1", sentenceId: "s1-p1-s1" }, target: { translationUnitId: "u2" } },
    { source: { blockId: "s1-p1", sentenceId: "s1-p1-s2" }, target: { translationUnitId: "u3" } },
  ],
} as unknown as Alignment;

const BLOCKS = [
  {
    id: "s1-p1",
    sentenceSpans: [{ id: "s1-p1-s1" }, { id: "s1-p1-s2" }, { id: "s1-p1-s3" }],
  },
] as unknown as readonly SourceBlock[];

const UNITS = [{ id: "u1" }, { id: "u2" }, { id: "u3" }] as unknown as readonly TranslationUnit[];

const index = buildAlignmentIndex(ALIGNMENT, BLOCKS, UNITS);

function markup(): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-reader-root", "true");
  root.innerHTML = `
    <p data-block-id="s1-p1">
      <span data-source-sentence="true" data-sentence-id="s1-p1-s1" id="s1-p1-s1" tabindex="0">Erstens.</span>
      <span data-source-sentence="true" data-sentence-id="s1-p1-s2" id="s1-p1-s2" tabindex="0">Zweitens.</span>
      <span data-source-sentence="true" data-sentence-id="s1-p1-s3" id="s1-p1-s3" tabindex="0">Drittens.</span>
    </p>
    <div data-translation-unit-id="u1" id="u1" tabindex="0">First, in English.</div>
    <div data-translation-unit-id="u2" id="u2" tabindex="0">Also first, split.</div>
    <div data-translation-unit-id="u3" id="u3" tabindex="0">Second, in English.</div>
  `;
  document.body.appendChild(root);
  return root;
}

/**
 * A highlighted element's identity. `id` for a sentence or a unit, and `data-block-id` for a
 * paragraph, which carries no `id` in the served markup -- reading `el.id` alone reported the
 * paragraph as `""` and made a real highlight look like a bug in the fixture.
 */
function identify(el: Element): string {
  return el.id || el.getAttribute("data-block-id") || el.tagName.toLowerCase();
}
function activeIds(root: HTMLElement): string[] {
  return [...root.querySelectorAll("[data-aligned-active]")].map(identify);
}
function partnerIds(root: HTMLElement): string[] {
  return [...root.querySelectorAll("[data-aligned-partner]")].map(identify).sort();
}

let container: HTMLElement;
let readerRoot: HTMLElement;
let reactRoot: ReturnType<typeof createRoot>;

beforeEach(async () => {
  await installDom();
  readerRoot = markup();
  container = document.createElement("div");
  document.body.appendChild(container);
  reactRoot = createRoot(container);
  await act(() => {
    reactRoot.render(<AlignmentController index={index} />);
  });
});

afterEach(async () => {
  await act(() => {
    reactRoot.unmount();
  });
  await uninstallDom();
});

async function fire(el: Element, type: string): Promise<void> {
  await act(() => {
    el.dispatchEvent(new window.MouseEvent(type, { bubbles: true }));
  });
}

async function key(k: string): Promise<void> {
  await act(() => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }));
  });
}

describe("AlignmentController highlights what the alignment index says, and nothing else", () => {
  test("hovering a German sentence lights it and BOTH of its translation units", async () => {
    const sentence = readerRoot.querySelector('[data-sentence-id="s1-p1-s1"]');
    if (!sentence) throw new Error("fixture lost its sentence");
    await fire(sentence, "mouseover");
    expect(activeIds(readerRoot)).toEqual(["s1-p1-s1"]);
    expect(partnerIds(readerRoot)).toEqual(["u1", "u2"]);
  });

  test("hovering a sentence aligned to nothing lights it alone", async () => {
    // The control. A controller that highlighted every unit, or the whole block, would pass the
    // case above and fail this one.
    const sentence = readerRoot.querySelector('[data-sentence-id="s1-p1-s3"]');
    if (!sentence) throw new Error("fixture lost its sentence");
    await fire(sentence, "mouseover");
    expect(activeIds(readerRoot)).toEqual(["s1-p1-s3"]);
    expect(partnerIds(readerRoot)).toEqual([]);
  });

  test("leaving the sentence clears both attributes", async () => {
    const sentence = readerRoot.querySelector('[data-sentence-id="s1-p1-s1"]');
    if (!sentence) throw new Error("fixture lost its sentence");
    await fire(sentence, "mouseover");
    expect(activeIds(readerRoot)).toHaveLength(1);
    await fire(sentence, "mouseout");
    expect(activeIds(readerRoot)).toEqual([]);
    expect(partnerIds(readerRoot)).toEqual([]);
  });

  test("the relation runs the other way too: a unit lights its German sentence AND its paragraph", async () => {
    // `buildAlignmentIndex` indexes an edge under both the sentence id and its block id, so
    // `getAlignedSources("u3")` returns two ids and the controller lights the sentence and the
    // paragraph that contains it. That is the behaviour a reader gets, and it is asserted rather
    // than trimmed: the first draft of this test expected the sentence alone, and the paragraph
    // highlight is what the alignment records actually say.
    const unit = readerRoot.querySelector('[data-translation-unit-id="u3"]');
    if (!unit) throw new Error("fixture lost its unit");
    await fire(unit, "mouseover");
    expect(activeIds(readerRoot)).toEqual(["u3"]);
    expect(partnerIds(readerRoot)).toEqual(["s1-p1", "s1-p1-s2"]);
  });

  test("focus lights the same pair as hover, which is what a keyboard reader gets", async () => {
    const sentence = readerRoot.querySelector<HTMLElement>('[data-sentence-id="s1-p1-s2"]');
    if (!sentence) throw new Error("fixture lost its sentence");
    await act(() => {
      sentence.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true }));
    });
    expect(activeIds(readerRoot)).toEqual(["s1-p1-s2"]);
    expect(partnerIds(readerRoot)).toEqual(["u3"]);
  });

  test("j and k walk the sentences in document order and stop at the ends", async () => {
    await key("j");
    expect(activeIds(readerRoot)).toEqual(["s1-p1-s1"]);
    await key("j");
    expect(activeIds(readerRoot)).toEqual(["s1-p1-s2"]);
    await key("j");
    expect(activeIds(readerRoot)).toEqual(["s1-p1-s3"]);
    // At the last sentence, j holds rather than wrapping.
    await key("j");
    expect(activeIds(readerRoot)).toEqual(["s1-p1-s3"]);
    await key("k");
    expect(activeIds(readerRoot)).toEqual(["s1-p1-s2"]);
    await key("k");
    expect(activeIds(readerRoot)).toEqual(["s1-p1-s1"]);
    // And at the first, k holds.
    await key("k");
    expect(activeIds(readerRoot)).toEqual(["s1-p1-s1"]);
  });

  test("ArrowDown and ArrowUp are the same two moves", async () => {
    await key("ArrowDown");
    expect(activeIds(readerRoot)).toEqual(["s1-p1-s1"]);
    await key("ArrowDown");
    expect(activeIds(readerRoot)).toEqual(["s1-p1-s2"]);
    await key("ArrowUp");
    expect(activeIds(readerRoot)).toEqual(["s1-p1-s1"]);
  });

  test("walking to a sentence also lights its translation, so the two faces stay joined", async () => {
    await key("j");
    expect(partnerIds(readerRoot)).toEqual(["u1", "u2"]);
    await key("j");
    expect(partnerIds(readerRoot)).toEqual(["u3"]);
  });

  test("Escape clears the highlight and says so in the live region", async () => {
    await key("j");
    expect(activeIds(readerRoot)).toHaveLength(1);
    await key("Escape");
    expect(activeIds(readerRoot)).toEqual([]);
    expect(container.textContent).toContain("Exited sentence mode");
  });

  test("Enter announces the English of the active German sentence, read from the page", async () => {
    // The announcement is the nonvisual equivalent AGENTS.md requires of this action, and it is
    // read out of the DOM rather than from the records, so it says what the reader can see.
    await key("j");
    await key("Enter");
    expect(container.textContent).toContain("First, in English.");
    expect(container.textContent).toContain("Also first, split.");
  });

  test("unmounting removes the listeners, so a second reader page does not inherit them", async () => {
    await act(() => {
      reactRoot.unmount();
    });
    const sentence = readerRoot.querySelector('[data-sentence-id="s1-p1-s1"]');
    if (!sentence) throw new Error("fixture lost its sentence");
    await fire(sentence, "mouseover");
    expect(activeIds(readerRoot)).toEqual([]);
    // Re-mount so afterEach's unmount has a root to unmount.
    reactRoot = createRoot(container);
    await act(() => {
      reactRoot.render(<AlignmentController index={index} />);
    });
  });
});
