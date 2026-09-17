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
  });
});
