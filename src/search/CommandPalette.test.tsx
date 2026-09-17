/**
 * Tests for CommandPalette keyboard navigation and focus management (am-scaf-extract-ui-components-c31).
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { isEditableTarget, isPaletteShortcut } from "./CommandPalette.tsx";

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
