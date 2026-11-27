/**
 * Reduced Motion Utility Bun Test Suite.
 *
 * Spec: AGENTS.md §10.1 and am-a11y-baseline-1cg5
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  isReducedMotionPreferred,
  onReducedMotionChange,
  shouldAnimate,
} from "../../a11y/reducedMotion.ts";
import { installDom, uninstallDom } from "../reactDom.ts";

describe("Reduced Motion Detection and Listeners (am-a11y-baseline-1cg5)", () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(async () => {
    await installDom();
    originalMatchMedia = window.matchMedia;
    document.documentElement.removeAttribute("data-reduced-motion");
  });

  afterEach(async () => {
    window.matchMedia = originalMatchMedia;
    document.documentElement.removeAttribute("data-reduced-motion");
    await uninstallDom();
  });

  it("detects system prefers-reduced-motion: reduce accurately", () => {
    window.matchMedia = (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    });

    expect(isReducedMotionPreferred()).toBe(true);
    expect(shouldAnimate()).toBe(false);
  });

  it("prioritizes site reading setting attribute data-reduced-motion='true' over media query", () => {
    window.matchMedia = (query: string) => ({
      matches: false, // system says no reduced motion
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    });

    expect(isReducedMotionPreferred()).toBe(false);

    // Set site setting attribute
    document.documentElement.setAttribute("data-reduced-motion", "true");
    expect(isReducedMotionPreferred()).toBe(true);
    expect(shouldAnimate()).toBe(false);
  });

  it("honours explicit override in shouldAnimate(override)", () => {
    expect(shouldAnimate(true)).toBe(false);
    expect(shouldAnimate(false)).toBe(true);
  });

  it("subscribes to media query changes and invokes callback", () => {
    let changeHandler: ((e: MediaQueryListEvent) => void) | null = null;
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (event: string, handler: any) => {
        if (event === "change") changeHandler = handler;
      },
      removeEventListener: () => {
        changeHandler = null;
      },
      dispatchEvent: () => true,
    });

    let currentPreference = false;
    const unsubscribe = onReducedMotionChange((reduced) => {
      currentPreference = reduced;
    });

    expect(changeHandler).toBeDefined();

    // Trigger change event
    if (changeHandler) {
      (changeHandler as (e: MediaQueryListEvent) => void)({ matches: true } as MediaQueryListEvent);
    }
    expect(currentPreference).toBe(true);

    unsubscribe();
    expect(changeHandler).toBeNull();
  });

  it("reports an explicit document preference immediately, including reading-only mode", () => {
    document.documentElement.dataset.readingOnly = "on";
    expect(isReducedMotionPreferred()).toBe(true);
    expect(shouldAnimate()).toBe(false);
    const values: boolean[] = [];
    const unsubscribe = onReducedMotionChange((reduced) => values.push(reduced));
    expect(values).toEqual([true]);
    unsubscribe();
  });

  it("keeps a pause until every active source is removed and observes live document changes", async () => {
    let systemReduced = false;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    Object.defineProperty(query, "matches", { configurable: true, get: () => systemReduced });
    window.matchMedia = () => query;
    const values: boolean[] = [];
    const unsubscribe = onReducedMotionChange((reduced) => values.push(reduced));
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    try {
      expect(values).toEqual([false]);
      document.documentElement.dataset.reducedMotion = "true";
      await flush();
      expect(values).toEqual([false, true]);
      document.documentElement.dataset.readingOnly = "on";
      await flush();
      delete document.documentElement.dataset.reducedMotion;
      await flush();
      expect(values).toEqual([false, true]);
      systemReduced = true;
      query.dispatchEvent(new Event("change"));
      delete document.documentElement.dataset.readingOnly;
      await flush();
      expect(values).toEqual([false, true]);
      systemReduced = false;
      query.dispatchEvent(new Event("change"));
      expect(values).toEqual([false, true, false]);
      unsubscribe();
      document.documentElement.dataset.reducedMotion = "true";
      systemReduced = true;
      query.dispatchEvent(new Event("change"));
      await flush();
      expect(values).toEqual([false, true, false]);
    } finally {
      unsubscribe();
    }
  });

  it("uses only the modern listener when both APIs exist and detaches it on cleanup", () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    let legacyRegistrations = 0;
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: (_type: string, handler: any) => listeners.add(handler),
      removeEventListener: (_type: string, handler: any) => listeners.delete(handler),
      addListener: () => {
        legacyRegistrations++;
      },
      removeListener: () => {},
      dispatchEvent: () => true,
    });
    const unsubscribe = onReducedMotionChange(() => {});
    expect(listeners.size).toBe(1);
    expect(legacyRegistrations).toBe(0);
    unsubscribe();
    expect(listeners.size).toBe(0);
  });

  it("retains legacy media-query support without depending on the modern API", () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    window.matchMedia = (query) =>
      ({
        matches: false,
        media: query,
        addListener: (handler: (event: MediaQueryListEvent) => void) => listeners.add(handler),
        removeListener: (handler: (event: MediaQueryListEvent) => void) =>
          listeners.delete(handler),
      }) as MediaQueryList;
    const values: boolean[] = [];
    const unsubscribe = onReducedMotionChange((reduced) => values.push(reduced));
    expect(listeners.size).toBe(1);
    for (const listener of listeners) listener({ matches: true } as MediaQueryListEvent);
    expect(values).toEqual([false, true]);
    unsubscribe();
    expect(listeners.size).toBe(0);
  });

  it("keeps document preferences functional when the media-query API is unavailable", async () => {
    window.matchMedia = () => {
      throw new Error("Media queries are unavailable here.");
    };
    const values: boolean[] = [];
    const unsubscribe = onReducedMotionChange((reduced) => values.push(reduced));
    try {
      expect(values).toEqual([false]);
      document.documentElement.dataset.reducedMotion = "true";
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(values).toEqual([false, true]);
      expect(isReducedMotionPreferred()).toBe(true);
    } finally {
      unsubscribe();
    }
  });
});
