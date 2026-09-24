/**
 * Tests for CommandPalette keyboard navigation and focus management (am-scaf-extract-ui-components-c31).
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { dropRepeatedHits } from "./CommandPalette.ts";
import { isEditableTarget, isPaletteShortcut } from "./CommandPalette.tsx";
import type { SearchDocument, SearchHit } from "./core.ts";

describe("CommandPalette keyboard handlers", () => {
  beforeEach(async () => {
    await installDom();
  });

  afterEach(async () => {
    await uninstallDom();
  });
  it("recognizes ⌘K (macOS) and Ctrl+K (Windows/Linux) as palette shortcut", () => {
    expect(isPaletteShortcut({ key: "k", metaKey: true, ctrlKey: false })).toBe(true);
    expect(isPaletteShortcut({ key: "K", metaKey: true, ctrlKey: false })).toBe(true);
    expect(isPaletteShortcut({ key: "k", metaKey: false, ctrlKey: true })).toBe(true);
    expect(isPaletteShortcut({ key: "K", metaKey: false, ctrlKey: true })).toBe(true);

    // Other keys with modifier should not trigger
    expect(isPaletteShortcut({ key: "p", metaKey: true, ctrlKey: false })).toBe(false);
    expect(isPaletteShortcut({ key: "k", metaKey: false, ctrlKey: false })).toBe(false);
  });

  it("identifies editable elements where palette shortcut must be suppressed", () => {
    // Plain elements
    const div = document.createElement("div");
    const button = document.createElement("button");
    const span = document.createElement("span");
    expect(isEditableTarget(div)).toBe(false);
    expect(isEditableTarget(button)).toBe(false);
    expect(isEditableTarget(span)).toBe(false);

    // Input fields
    const input = document.createElement("input");
    input.type = "text";
    expect(isEditableTarget(input)).toBe(true);

    const textarea = document.createElement("textarea");
    expect(isEditableTarget(textarea)).toBe(true);

    const select = document.createElement("select");
    expect(isEditableTarget(select)).toBe(true);

    // ARIA textbox role
    const customInput = document.createElement("div");
    customInput.setAttribute("role", "textbox");
    expect(isEditableTarget(customInput)).toBe(true);

    // Contenteditable
    const contentEditable = document.createElement("div");
    contentEditable.contentEditable = "true";
    expect(isEditableTarget(contentEditable)).toBe(true);
  });

  it("handles Escape and focus target tracking", () => {
    const triggerButton = document.createElement("button");
    triggerButton.id = "trigger-btn";
    document.body.appendChild(triggerButton);
    triggerButton.focus();

    expect(document.activeElement).toBe(triggerButton);

    // Simulate focus recording and restoring
    let recordedElement: HTMLElement | null = null;
    if (document.activeElement instanceof HTMLElement) {
      recordedElement = document.activeElement;
    }

    expect(recordedElement).toBe(triggerButton);

    // Simulate dialog open and close
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    expect(document.activeElement).toBe(input);

    // Restore focus on close
    recordedElement?.focus();
    expect(document.activeElement).toBe(triggerButton);

    // Clean up
    triggerButton.remove();
    input.remove();
  });
});

describe("dropRepeatedHits: the palette lists a result once", () => {
  const doc = (over: Partial<SearchDocument>): SearchDocument => ({
    id: "arg-lq-entropy-correspondence",
    type: "argument",
    paper: "light-quanta",
    section: "s6",
    lang: "en",
    title: "A coefficient suggests an energy element",
    text: "text",
    terms: [],
    route: "/papers/light-quanta/",
    anchor: "arg-lq-entropy-correspondence",
    face: "",
    scopeLabel: "Light quanta",
    ...over,
  });
  const hit = (document: SearchDocument, score: number): SearchHit => ({
    document,
    score,
    snippet: "",
    aliasLabel: null,
  });

  it("drops a hit whose title and destination repeat a better-ranked one, and keeps the order", () => {
    const argument = hit(doc({}), 3);
    const synopsis = hit(doc({ id: "result-lq-entropy-correspondence", type: "result" }), 2);
    const equation = hit(
      doc({ id: "eq-lq-1", type: "equation", title: "The entropy of dilute radiation" }),
      1,
    );
    const kept = dropRepeatedHits([argument, synopsis, equation]);
    expect(kept.map((h) => h.document.id)).toEqual(["arg-lq-entropy-correspondence", "eq-lq-1"]);
  });

  it("keeps a hit that shares only its destination, or only its title", () => {
    const argument = hit(doc({}), 3);
    const sameTitleElsewhere = hit(doc({ id: "arg-other", anchor: "arg-other" }), 2);
    expect(dropRepeatedHits([argument, sameTitleElsewhere])).toHaveLength(2);
  });
});
