/**
 * Automated Accessibility Checks Bun Test Suite.
 *
 * Spec: AGENTS.md §10.1 and am-a11y-baseline-1cg5
 */

import { describe, expect, it } from "bun:test";
import {
  type BoxRect,
  checkColorIndependence,
  checkFocusObscuring,
  checkLanguageOfParts,
  checkLinkPurpose,
  checkPageTitles,
  checkTargetSize,
  checkTextSpacing,
  evaluatePointerSequence,
} from "../../../scripts/a11y/checks.ts";

describe("Automated Accessibility Checks Bun Suite (am-a11y-baseline-1cg5)", () => {
  describe("1. Focus Obscuring Check (2.4.11 / 2.4.12)", () => {
    const target: BoxRect = {
      left: 100,
      top: 100,
      right: 200,
      bottom: 140,
      width: 100,
      height: 40,
    };

    it("passes when focused element is completely unobscured", () => {
      const result = checkFocusObscuring(target, []);
      expect(result.isObscured).toBe(false);
      expect(result.coveredPoints).toBe(0);
    });

    it("passes when focused element is only partially obscured", () => {
      const partialHeader: BoxRect = {
        left: 0,
        top: 0,
        right: 500,
        bottom: 110,
        width: 500,
        height: 110,
      };
      const result = checkFocusObscuring(target, [partialHeader]);
      expect(result.isObscured).toBe(false);
      expect(result.coveredPoints).toBeGreaterThan(0);
      expect(result.coveredPoints).toBeLessThan(result.totalPoints);
    });

    it("fails when a sticky header completely obscures the focused element (planted negative)", () => {
      const stickyHeader: BoxRect = {
        left: 0,
        top: 0,
        right: 500,
        bottom: 200,
        width: 500,
        height: 200,
      };
      const result = checkFocusObscuring(target, [stickyHeader]);
      expect(result.isObscured).toBe(true);
      expect(result.coveredPoints).toBe(9);
    });
  });

  describe("2. Target Size Minimum Check (2.5.8)", () => {
    it("passes when button is 24x24 px or larger", () => {
      const validBtn: BoxRect = { left: 0, top: 0, right: 32, bottom: 32, width: 32, height: 32 };
      const res = checkTargetSize(validBtn);
      expect(res.passes).toBe(true);
    });

    it("passes when a 20x20 px button satisfies the spacing exemption", () => {
      const smallBtn: BoxRect = { left: 10, top: 10, right: 30, bottom: 30, width: 20, height: 20 };
      const adjacentBtn: BoxRect = {
        left: 100,
        top: 10,
        right: 140,
        bottom: 50,
        width: 40,
        height: 40,
      };
      const res = checkTargetSize(smallBtn, [adjacentBtn]);
      expect(res.passes).toBe(true);
      expect(res.reason).toBe("spacing-exception");
    });

    it("fails when a 20x20 px button is tightly packed without spacing exemption (planted negative)", () => {
      const smallBtn: BoxRect = { left: 10, top: 10, right: 30, bottom: 30, width: 20, height: 20 };
      const tightAdj: BoxRect = { left: 32, top: 10, right: 52, bottom: 30, width: 20, height: 20 };
      const res = checkTargetSize(smallBtn, [tightAdj]);
      expect(res.passes).toBe(false);
      expect(res.reason?.includes("below minimum 24x24")).toBe(true);
    });
  });

  describe("3. Text Spacing Resilience (1.4.12)", () => {
    it("passes when container expands to fit text", () => {
      const el = {
        scrollHeight: 120,
        clientHeight: 120,
        scrollWidth: 300,
        clientWidth: 300,
        overflow: "visible",
      };
      const res = checkTextSpacing(el);
      expect(res.hasClipping).toBe(false);
    });

    it("fails when overflow:hidden container clips expanded text (planted negative)", () => {
      const el = {
        scrollHeight: 180,
        clientHeight: 100,
        scrollWidth: 300,
        clientWidth: 300,
        overflow: "hidden",
      };
      const res = checkTextSpacing(el);
      expect(res.hasClipping).toBe(true);
      expect(res.message?.includes("clipped")).toBe(true);
    });
  });

  describe("4. Language of Parts (3.1.2)", () => {
    it("passes when German original block carries lang='de'", () => {
      const blocks = [
        { id: "s1-p1", isGermanSource: true, lang: "de" },
        { id: "s1-p1-trans", isGermanSource: false, lang: "en" },
      ];
      const violations = checkLanguageOfParts(blocks);
      expect(violations.length).toBe(0);
    });

    it("fails when German original block is missing lang='de' (planted negative)", () => {
      const blocks = [{ id: "s1-p1", isGermanSource: true, lang: undefined }];
      const violations = checkLanguageOfParts(blocks);
      expect(violations.length).toBe(1);
      expect(violations[0]?.rule).toBe("language-of-parts");
      expect(violations[0]?.criterion).toBe("3.1.2");
    });
  });

  describe("5. Page Titles (2.4.2)", () => {
    it("passes when all routes have unique, non-empty titles", () => {
      const routes = [
        { route: "/", title: "Annus Mirabilis — Interactive Critical Edition (1905)" },
        { route: "/papers/brownian-motion", title: "Brownian Motion (1905) — Annus Mirabilis" },
        {
          route: "/papers/special-relativity",
          title: "Special Relativity (1905) — Annus Mirabilis",
        },
      ];
      const violations = checkPageTitles(routes);
      expect(violations.length).toBe(0);
    });

    it("fails on duplicate and empty page titles (planted negative)", () => {
      const routes = [
        { route: "/a", title: "Overview" },
        { route: "/b", title: "Overview" },
        { route: "/c", title: "" },
      ];
      const violations = checkPageTitles(routes);
      expect(violations.length).toBe(2);
      expect(violations.some((v) => v.message.includes("empty"))).toBe(true);
      expect(violations.some((v) => v.message.includes("Duplicate"))).toBe(true);

      // WHICH RULE each violation is reported under, which these assertions did not check.
      // A count and a message substring pass unchanged if a violation is emitted under the
      // wrong rule id, and the rule id is the whole product here: these feed a WCAG report
      // where "2.4.2" is the claim being made. Both sites carry page-titled, so neither could
      // be credited by mention alone.
      const empty = violations.find((v) => v.message.includes("empty"));
      expect(empty?.rule).toBe("page-titled"); // (checks.ts:173)
      expect(empty?.criterion).toBe("2.4.2");
      const duplicate = violations.find((v) => v.message.includes("Duplicate"));
      expect(duplicate?.rule).toBe("page-titled"); // (checks.ts:185)
      expect(duplicate?.criterion).toBe("2.4.2");
      // And they are two distinct routes, so one violation is not answering for both.
      expect(empty?.elementId).toBe("/c");
      expect(duplicate?.elementId).toBe("/b");
    });
  });

  describe("6. Link Purpose in Context (2.4.4)", () => {
    it("passes on descriptive link text", () => {
      const links = [
        {
          href: "/papers/brownian-motion",
          accessibleName: "Read Einstein's Brownian Motion Paper",
        },
        { href: "/lab/bm-01", accessibleName: "Open Observation & Brownian Drift Laboratory" },
      ];
      const violations = checkLinkPurpose(links);
      expect(violations.length).toBe(0);
    });

    it("fails on vague link texts like 'here', 'click here', 'more' (planted negative)", () => {
      const links = [
        { href: "/about", accessibleName: "here" },
        { href: "/papers", accessibleName: "click here" },
        { href: "/glossary", accessibleName: "" },
      ];
      const violations = checkLinkPurpose(links);
      expect(violations.length).toBe(3);
      expect(violations.some((v) => v.message.includes("no accessible name"))).toBe(true);
      expect(violations.some((v) => v.message.includes("vague"))).toBe(true);

      // Same gap as the page-title case: the rule id was never asserted. The two sites are a
      // missing name and a vague name, which are different failures for an author to fix -
      // one link has no text at all, the other has text that says nothing.
      const missingName = violations.find((v) => v.message.includes("no accessible name"));
      expect(missingName?.rule).toBe("link-purpose"); // (checks.ts:214)
      expect(missingName?.criterion).toBe("2.4.4");
      expect(missingName?.elementId).toBe("/glossary");
      const vague = violations.find((v) => v.message.includes("vague"));
      expect(vague?.rule).toBe("link-purpose"); // (checks.ts:222)
      expect(vague?.criterion).toBe("2.4.4");
      // Both vague links are reported, not just the first one matched.
      expect(violations.filter((v) => v.message.includes("vague")).length).toBe(2);
    });
  });

  describe("7. Use of Color (1.4.1)", () => {
    it("passes when semantic color is accompanied by secondary non-color channel", () => {
      const items = [
        {
          id: "term-kappa",
          hasSemanticColor: true,
          nonColorChannel: { hasVisibleText: true, hasDataTermBinding: true },
        },
        {
          id: "graph-curve-stokes",
          hasSemanticColor: true,
          nonColorChannel: { hasDashPatternOrMarker: true },
        },
      ];
      const violations = checkColorIndependence(items);
      expect(violations.length).toBe(0);
    });

    it("fails when semantic color is the sole indicator (planted negative)", () => {
      const items = [
        {
          id: "legend-only-color",
          hasSemanticColor: true,
          nonColorChannel: { hasVisibleText: false },
        },
      ];
      const violations = checkColorIndependence(items);
      expect(violations.length).toBe(1);
      expect(violations[0]?.rule).toBe("use-of-color");
      expect(violations[0]?.criterion).toBe("1.4.1");
    });
  });

  describe("8. Pointer Cancellation (2.5.2)", () => {
    const btnBounds: BoxRect = {
      left: 50,
      top: 50,
      right: 150,
      bottom: 90,
      width: 100,
      height: 40,
    };

    it("commits action when pointerdown is followed by pointerup inside bounds", () => {
      const seq = [
        { type: "pointerdown" as const, x: 60, y: 60 },
        { type: "pointermove" as const, x: 70, y: 65 },
        { type: "pointerup" as const, x: 70, y: 65 },
      ];
      const res = evaluatePointerSequence(seq, btnBounds);
      expect(res.didCommit).toBe(true);
      expect(res.reason).toBe("committed-on-valid-release");
    });

    it("aborts and does not commit when pointer is released outside bounds", () => {
      const seq = [
        { type: "pointerdown" as const, x: 60, y: 60 },
        { type: "pointermove" as const, x: 200, y: 200 },
        { type: "pointerup" as const, x: 200, y: 200 },
      ];
      const res = evaluatePointerSequence(seq, btnBounds);
      expect(res.didCommit).toBe(false);
      expect(res.reason).toBe("aborted-released-outside-bounds");
    });

    it("aborts when pointercancel event fires before release", () => {
      const seq = [
        { type: "pointerdown" as const, x: 60, y: 60 },
        { type: "pointercancel" as const },
      ];
      const res = evaluatePointerSequence(seq, btnBounds);
      expect(res.didCommit).toBe(false);
      expect(res.reason).toBe("cancelled-by-pointercancel");
    });
  });
});
