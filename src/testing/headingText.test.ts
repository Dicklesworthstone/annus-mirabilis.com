import { describe, expect, test } from "bun:test";
import { containsHeading, headingTexts } from "./headingText.ts";

/**
 * The first case below is the defect this helper exists for, written from the measurement that
 * found it rather than from imagination: on 2026-09-22 the heading was deleted from
 * src/components/lab/lq09/IonizationLab.tsx and src/testing/lq09.browser.test.tsx stayed green,
 * because these two aria-labels carry the same words in the case the assertion had folded to.
 */
const ARIA_ONLY = `<div><h4 style="margin:0">ZZPLANTZZ</h4><section class="table-scroll" aria-label="Accepted laboratory telemetry snapshot table"><table aria-label="Accepted laboratory telemetry snapshot"><tbody><tr><td>1</td></tr></tbody></table></section></div>`;

describe("containsHeading (am-edit-voice-lint-trmf)", () => {
  test("words that appear only in an aria-label do not satisfy a heading assertion", () => {
    expect(ARIA_ONLY.toLowerCase()).toContain("accepted laboratory telemetry snapshot");
    expect(containsHeading(ARIA_ONLY, "Accepted Laboratory Telemetry Snapshot")).toBe(false);
  });

  test("a heading that changed from Title Case to sentence case still satisfies it", () => {
    const html = `<h3>Accepted laboratory telemetry snapshot</h3>`;
    expect(containsHeading(html, "Accepted Laboratory Telemetry Snapshot")).toBe(true);
  });

  test("a reworded heading does not satisfy it, which is deliberate", () => {
    const html = `<h3>Telemetry for the accepted snapshot</h3>`;
    expect(containsHeading(html, "Accepted Laboratory Telemetry Snapshot")).toBe(false);
  });

  test("entities and nested markup inside a heading are flattened to text", () => {
    const html = `<h2 class="x">Spacetime event coordinates &amp; <em>invariant</em>   interval</h2>`;
    expect(headingTexts(html)).toEqual(["Spacetime event coordinates & invariant interval"]);
    expect(containsHeading(html, "coordinates & invariant interval")).toBe(true);
  });

  test("every heading level is read, and non-heading text is not", () => {
    const html = `<h1>One</h1><p>Two</p><h6>Three</h6><div aria-label="Four"></div>`;
    expect(headingTexts(html)).toEqual(["One", "Three"]);
  });

  test("an empty needle is refused rather than matching everything", () => {
    expect(() => containsHeading(`<h1>One</h1>`, "   ")).toThrow();
  });
});
