import { describe, expect, it } from "bun:test";
import { focusOpenedHeading, resolveFocusReturnTarget } from "../reader/stack/focus.ts";
import type { StackFrame } from "../reader/stack/stackStore.ts";

function mockFrame(overrides: Partial<StackFrame> = {}): StackFrame {
  return {
    anchor: "p-brownian-1",
    face: "reading",
    detail: 1,
    perspective: null,
    notation: null,
    unitLayer: null,
    selectionId: null,
    formId: null,
    clarification: { kind: "instrument-view", id: "bm-01" },
    title: "Brownian Motion Lab",
    question: "How do particles move?",
    triggerId: "origin-btn-1",
    scrollFraction: 0.35,
    lab: null,
    ...overrides,
  };
}

describe("focus (am-read-return-stack-oxa)", () => {
  it("resolves origin element when present and visible", () => {
    const originEl = {
      id: "origin-btn-1",
      getClientRects: () => [{ width: 100, height: 30 } as DOMRect],
    } as unknown as HTMLElement;

    const mockDoc = {
      getElementById: (id: string) => (id === "origin-btn-1" ? originEl : null),
    } as unknown as Document;

    const target = resolveFocusReturnTarget(mockDoc, mockFrame(), "fallback-anchor");
    expect(target).not.toBeNull();
    expect(target?.element).toBe(originEl);
    expect(target?.isOrigin).toBe(true);
    expect(target?.relativeYFraction).toBe(0.35);
  });

  it("falls back to anchor element when origin is not found or hidden", () => {
    const anchorEl = {
      id: "fallback-anchor",
      getClientRects: () => [{ width: 100, height: 30 } as DOMRect],
    } as unknown as HTMLElement;

    const mockDoc = {
      getElementById: (id: string) => (id === "fallback-anchor" ? anchorEl : null),
    } as unknown as Document;

    const target = resolveFocusReturnTarget(
      mockDoc,
      mockFrame({ triggerId: "missing-btn" }),
      "fallback-anchor",
    );
    expect(target).not.toBeNull();
    expect(target?.element).toBe(anchorEl);
    expect(target?.isOrigin).toBe(false);
    expect(target?.relativeYFraction).toBe(0.15);
  });

  it("returns null when neither origin nor fallback anchor exist", () => {
    const mockDoc = {
      getElementById: () => null,
    } as unknown as Document;

    const target = resolveFocusReturnTarget(mockDoc, mockFrame(), "missing-anchor");
    expect(target).toBeNull();
  });

  it("focusOpenedHeading safely calls focus on heading element", () => {
    let focused = false;
    const mockHeading = {
      focus: () => {
        focused = true;
      },
    } as unknown as HTMLElement;

    focusOpenedHeading(mockHeading);
    expect(focused).toBe(true);

    // Safe on null
    expect(() => focusOpenedHeading(null)).not.toThrow();
  });
});
