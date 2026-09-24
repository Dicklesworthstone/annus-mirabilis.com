import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import FluorescencePage from "../../app/lab/lq-07/page.tsx";
import { FluorescenceLab } from "../../components/lab/lq07/FluorescenceLab.tsx";
import { FluorescencePlot } from "../../components/lab/lq07/FluorescencePlot.tsx";
import { LQ07_DEFAULTS } from "../../experiments/lq07/definition.ts";
import { evaluateLq07 } from "../../experiments/lq07/session.ts";
import { containsHeading } from "../headingText.ts";

/**
 * Heading assertions here compare case-insensitively AND are scoped to heading elements
 * (am-edit-voice-lint-trmf). They asserted the exact Title Case of a heading in order to
 * check that the SECTION IS PRESENT, so they broke when the de-slop pass moved these pages
 * to the site's sentence case while every section they protect was still rendering.
 *
 * containsHeading is the shared helper, not a local lowercase: text outside an h1-h6 cannot
 * satisfy it. That matters because the first repair of this kind WAS a local lowercase, and
 * it let an aria-label two elements away stand in for a heading that had been deleted.
 */

describe("LQ-07 UI components and route", () => {
  test("FluorescencePlot renders allowed and disallowed energy ledgers statically with proper SVGs", () => {
    const pAllowed = { ...LQ07_DEFAULTS, nu1: 850, nu2: 850 };
    const pDisallowed = { ...LQ07_DEFAULTS, nu1: 850, nu2: 900 };

    const htmlAllowed = renderToStaticMarkup(
      <FluorescencePlot
        parameters={pAllowed}
        evaluation={evaluateLq07(pAllowed)}
        clipId="test-clip-allowed"
      />,
    );
    const htmlDisallowed = renderToStaticMarkup(
      <FluorescencePlot
        parameters={pDisallowed}
        evaluation={evaluateLq07(pDisallowed)}
        clipId="test-clip-disallowed"
      />,
    );

    expect(htmlAllowed).toContain('data-testid="lq07-plot-container"');
    expect(htmlAllowed).toContain('data-allowed="true"');
    expect(htmlAllowed).toContain("Allowed by the budget");
    expect(htmlAllowed).toContain("<svg");
    expect(htmlAllowed).toContain("</svg>");
    expect(htmlAllowed).toContain("Spectral bands");

    expect(htmlDisallowed).toContain('data-allowed="false"');
    expect(htmlDisallowed).toContain("Disallowed (deficit)");
    expect(htmlDisallowed).toContain("Energy deficit");
  });

  test("FluorescencePlot renders false-color legend with UV, Visible, and IR bands", () => {
    const html = renderToStaticMarkup(
      <FluorescencePlot
        parameters={LQ07_DEFAULTS}
        evaluation={evaluateLq07(LQ07_DEFAULTS)}
        clipId="test-clip-legend"
      />,
    );

    expect(html).toContain("Ultraviolet (UV)");
    expect(html).toContain("Visible spectrum");
    expect(html).toContain("Infrared (IR)");
  });

  test("FluorescenceLab renders laboratory root with data attributes and noscript fallback", () => {
    const html = renderToStaticMarkup(<FluorescenceLab />);
    expect(html).toContain('data-instrument-id="lq-07"');
    // The label is derived (am-inst-execution-labels-5ywv); until 2ecd3001 it was hard-coded "host".
    // With no example there is no source digest, so neither calculation label is earned here; the
    // page's example earns "Static worked example" (next test).
    expect(html).not.toContain('data-execution-label="host"');
    expect(html).not.toContain('data-execution-label="static"');
    expect(html).toContain("<noscript>");
    expect(html).toContain("JavaScript disabled");
    // The drawing comes first, then both predictions, then the family's "Try" presets (dispatch
    // 156, option c). The absorbed and emitted bars stay in view; what the prompts ask about waits.
    const drawing = html.indexOf("Fluorescence energy budget: incident");
    const panel = html.indexOf('data-predict-gate="awaiting"');
    const presets = html.indexOf("<legend>Try</legend>");
    expect(drawing).toBeGreaterThan(-1);
    expect(drawing < panel && panel < presets).toBe(true);
    expect(html).toContain("absorbed hν₁");
    expect(html).toContain("emitted hν₂");
    // Server markup asks, so each part that answers waits: the budget badge, the ν₂,max line, the
    // heat or deficit bar, the verdict, the rates, the status line and the ledger.
    expect(html).toMatch(/<span data-predict-response="awaiting"[^>]*>Allowed by the budget/);
    expect(html).toMatch(
      /<g data-predict-response="awaiting"><line[^>]*><\/line><text[^>]*>ν₂,max/,
    );
    expect(html).toMatch(
      /<g data-predict-response="awaiting"><rect[^>]*><\/rect><text[^>]*>\+[\d.]+ eV/,
    );
    expect(html).toMatch(/<div data-predict-response="awaiting"[^>]*><strong>Verdict:<\/strong>/);
    expect(html).toMatch(
      /<div data-predict-response="awaiting"[^>]*><div[^>]*><span[^>]*>Rates at this absorbed power/,
    );
    expect(html).toMatch(/<p[^>]*data-predict-response="awaiting"[^>]*>/);
    expect(html).toMatch(
      /<section data-predict-response="awaiting"[^>]*><h3[^>]*>Calculated energy ledger and transition quantities/,
    );
    expect(html).not.toContain('data-predict-response="shown"');
    // The drawing's name states the frequencies, and not the verdict that waits.
    expect(html).toContain(
      'aria-label="Fluorescence energy budget: incident 850 THz (3.515 eV), emitted 850 THz (3.515 eV)"',
    );
    const shown = renderToStaticMarkup(
      <FluorescencePlot
        parameters={LQ07_DEFAULTS}
        evaluation={evaluateLq07(LQ07_DEFAULTS)}
        response={{ "data-predict-response": "shown" }}
      />,
    );
    expect(shown).toContain("emitted 850 THz (3.515 eV), status allowed");
    expect(containsHeading(html, "Calculated energy ledger and transition quantities")).toBe(true);
    expect(html).toContain("Budget verdict");
    expect(html).toContain("Maximum allowed frequency");
  });

  test("the page's build-time example earns the static label", () => {
    const html = renderToStaticMarkup(<FluorescencePage />);
    expect(html).toContain('data-execution-label="static"');
    expect(html).toContain("Static worked example");
    expect(html).not.toContain('data-execution-label="host"');
  });
  test("FluorescencePage route renders without errors and includes article sections", () => {
    const html = renderToStaticMarkup(<FluorescencePage />);
    // Was `toContain("Single-Quantum Energy Budget")`, a FRAGMENT of a heading, which is why
    // the pin-scan for this de-slop pass missed it: that scan searched for complete heading
    // strings. The fragment was also carried by the §7 h2 asserted eleven lines above, so a
    // fragment check here could not fail while that section rendered - planted and
    // confirmed. It now names the h1 it was about, which does discriminate.
    expect(containsHeading(html, "Stokes's rule and the single-quantum energy budget")).toBe(true);
    expect(containsHeading(html, "The Single-Quantum Energy Budget in Einstein 1905 §7")).toBe(
      true,
    );
    // E_other is typeset, and the implication is a word, not a literally printed "&Longrightarrow;".
    expect(html).toContain("hν₁ = hν₂ + E<sub>other</sub>");
    expect(html).not.toContain("Longrightarrow");
    expect(containsHeading(html, "The Two Historical Deviation Cases")).toBe(true);
    expect(html).toContain("Light quanta · Paper 1, §7 energy conservation");
  });
});
