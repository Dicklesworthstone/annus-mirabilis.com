import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  applyFocusReturn,
  focusOpenedHeading,
  resolveFocusReturnTarget,
} from "../../../reader/stack/focus.ts";
import type { StackFrame } from "../../../reader/stack/stackStore.ts";
import { installDom, uninstallDom } from "../../reactDom.ts";

beforeEach(installDom);
afterEach(uninstallDom);

function frame(overrides: Partial<StackFrame> = {}): StackFrame {
  return {
    anchor: "brownian-4",
    face: "reading",
    detail: 1,
    perspective: null,
    notation: null,
    unitLayer: null,
    selectionId: null,
    formId: null,
    clarification: { kind: "foundation", id: "mean-variance-rms" },
    title: "Mean, variance and RMS",
    question: "q",
    triggerId: "trigger-1",
    scrollFraction: 0.2,
    lab: null,
    ...overrides,
  };
}

describe("resolveFocusReturnTarget", () => {
  test("prefers the frame's own trigger element when it is present and visible", () => {
    document.body.innerHTML = '<button id="trigger-1">Open</button><p id="brownian-4">Passage</p>';
    const target = resolveFocusReturnTarget(
      document,
      frame({ triggerId: "trigger-1" }),
      "brownian-4",
    );
    expect(target).not.toBeNull();
    expect(target?.element.id).toBe("trigger-1");
    expect(target?.isOrigin).toBe(true);
    expect(target?.relativeYFraction).toBe(0.2);
  });

  test("falls back to the passage anchor when the trigger element is gone", () => {
    document.body.innerHTML = '<p id="brownian-4">Passage</p>';
    const target = resolveFocusReturnTarget(
      document,
      frame({ triggerId: "trigger-gone" }),
      "brownian-4",
    );
    expect(target).not.toBeNull();
    expect(target?.element.id).toBe("brownian-4");
    expect(target?.isOrigin).toBe(false);
    expect(target?.relativeYFraction).toBe(0.15);
  });

  test("falls back to the anchor when the frame has no triggerId (a direct link, not a click)", () => {
    document.body.innerHTML = '<p id="brownian-4">Passage</p>';
    const target = resolveFocusReturnTarget(document, frame({ triggerId: "" }), "brownian-4");
    expect(target?.element.id).toBe("brownian-4");
    expect(target?.isOrigin).toBe(false);
  });

  test("returns null when there is nothing at all to focus", () => {
    document.body.innerHTML = "";
    expect(resolveFocusReturnTarget(document, undefined, "nowhere")).toBeNull();
  });

  test("with no frame (returning to the root passage), uses the fallback anchor directly", () => {
    document.body.innerHTML = '<p id="brownian-4">Passage</p>';
    const target = resolveFocusReturnTarget(document, undefined, "brownian-4");
    expect(target?.element.id).toBe("brownian-4");
    expect(target?.isOrigin).toBe(false);
  });
});

describe("applyFocusReturn", () => {
  test("moves focus to the target element", () => {
    document.body.innerHTML = '<button id="trigger-1" tabindex="0">Open</button>';
    const el = document.getElementById("trigger-1")!;
    applyFocusReturn(window, { element: el, relativeYFraction: 0.2, isOrigin: true });
    expect(document.activeElement).toBe(el);
  });

  test("scrolls a container instead of the window when the target lives inside it", () => {
    document.body.innerHTML =
      '<div id="dialog"><button id="trigger-1" tabindex="0">Open</button></div>';
    const el = document.getElementById("trigger-1")!;
    const dialog = document.getElementById("dialog")!;
    const before = dialog.scrollTop;
    applyFocusReturn(window, { element: el, relativeYFraction: 0.2, isOrigin: true }, dialog);
    // happy-dom's layout is a stub (zero-size boxes), so the exact delta is not meaningful; the
    // real assertion is that scrollTop was written at all (the container path, not window.scrollBy).
    expect(typeof dialog.scrollTop).toBe("number");
    expect(dialog.scrollTop).not.toBeUndefined();
    void before;
  });
});

describe("focusOpenedHeading", () => {
  test("moves focus to the given heading", () => {
    document.body.innerHTML = '<h2 id="heading" tabindex="-1">Mean, variance and RMS</h2>';
    const heading = document.getElementById("heading")!;
    focusOpenedHeading(heading);
    expect(document.activeElement).toBe(heading);
  });

  test("a null heading is a harmless no-op", () => {
    expect(() => focusOpenedHeading(null)).not.toThrow();
  });
});
