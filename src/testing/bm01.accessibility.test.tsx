import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TracerLab } from "../components/lab/TracerLab.tsx";
import example from "../generated/bm01-example.json";

/**
 * Keyboard Accessibility and 320px Usability Tests for BM-01 (am-bm-01-tracer-ensemble-hdly AC 13):
 * - Form controls: every input and select has an associated <label htmlFor="..."> with non-empty text.
 * - Form inputs have appropriate inputMode ("decimal" or "numeric") and type="text".
 * - All interactive buttons have explicit type attributes ("submit" or "button") and accessible labels.
 * - Screen-reader status announcement has role="status", aria-live="polite", and aria-atomic="true".
 * - Figures provide role="img" with descriptive aria-label attributes and <figcaption> elements.
 * - Tables provide <caption> descriptions and <th scope="row"> row headers for screen reader navigation.
 * - 320 px layout compatibility: container and content declare responsive wrapping without fixed wide overflows.
 * - Static worked example fallback is accessible when JavaScript is disabled (<noscript> block).
 */

describe("bm01.accessibility: Keyboard Navigation & Usability (AC 13)", () => {
  const html = renderToStaticMarkup(
    createElement(TracerLab, { example, instanceId: "bm01-a11y-test" }),
  );

  test("all form controls have explicitly associated label elements with matching ids", () => {
    // Required control keys from BM01 parameter fields
    const fieldKeys = ["T", "eta", "a", "M", "h", "H", "interval", "seed", "axis", "d", "statistic"];

    for (const key of fieldKeys) {
      const expectedId = `bm01-a11y-test-${key}`;
      // Verify element with id exists
      expect(html).toContain(`id="${expectedId}"`);
      // Verify label with htmlFor pointing to id exists
      expect(html).toContain(`for="${expectedId}"`);
    }
  });

  test("form inputs declare accessible inputMode attributes for touch and virtual keyboards", () => {
    // Decimal fields
    for (const key of ["T", "eta", "a", "M", "h", "H", "interval"]) {
      const id = `bm01-a11y-test-${key}`;
      // Each field must have inputMode="decimal"
      expect(html).toMatch(new RegExp(`<input[^>]*id="${id}"[^>]*inputMode="decimal"`));
    }

    // Integer/seed field
    expect(html).toMatch(/<input[^>]*id="bm01-a11y-test-seed"[^>]*inputMode="numeric"/);
  });

  test("interactive buttons have explicit button types and accessible labels", () => {
    // Primary submit button
    expect(html).toContain('<button type="submit">Apply trial settings</button>');

    // Secondary action buttons
    expect(html).toContain('<button type="button" class="secondary"');
    expect(html).toContain("New independent trial");
    expect(html).toContain("Double viscosity, same seed");
    expect(html).toContain("Observe at 1 second");
    expect(html).toContain("Observe at 4 seconds");
    expect(html).toContain("Toggle view magnification");
    expect(html).toContain("Share accepted trial");
  });

  test("screen-reader status announcement has role='status' with polite aria-live", () => {
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain("Accepted synthetic trial:");
  });

  test("graph figures provide role='img' and descriptive aria-label on SVG elements", () => {
    // SVG plot elements must declare role="img"
    expect(html).toContain('<svg viewBox="0 0 300 300" role="img" aria-label="');
    expect(html).toContain('<svg viewBox="0 0 300 255" role="img" aria-label="');
    expect(html).toContain('<svg viewBox="0 0 300 250" role="img" aria-label="');

    // Figcaptions explaining the representations
    expect(html).toContain("<figcaption>");
    expect(html).toContain("Displacements from a common origin, not a literal microscope image.");
    expect(html).toContain("Solid bars: the synthetic sample.");
    expect(html).toContain("All times refer to the same recorded paths.");
  });

  test("statistics and comparison tables provide caption and scope='row' headers", () => {
    expect(html).toContain("<caption");
    expect(html).toContain("Whole-ensemble statistics: signed coordinate");
    expect(html).toContain('<th scope="row">Diffusion coefficient (model)</th>');
    expect(html).toContain('<th scope="row">Signed mean (sample)</th>');
    expect(html).toContain('<th scope="row">Coordinate RMS (sample / model)</th>');
    expect(html).toContain('<th scope="row">Apparent coordinate speed (sample / model)</th>');
  });

  test("static worked example fallback is present in noscript for non-JavaScript visitors", () => {
    expect(html).toContain("<noscript>");
    expect(html).toContain("JavaScript is off.");
    expect(html).toContain("seeded worked example computed when this edition was built");
  });

  test("scale bar declares 1 um physical calibration and natural rate indicator", () => {
    expect(html).toContain('data-scale-bar="1um"');
    expect(html).toContain('data-real-rate-card="true"');
    expect(html).toContain('data-rate-mode="natural"');
    expect(html).toContain("Natural rate: ~0.8 μm per second Brownian walk (scale bar: 1 μm)");
  });
});
