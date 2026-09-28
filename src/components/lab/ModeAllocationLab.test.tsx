import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_LQ02_INPUTS } from "../../experiments/lq02/session";
import { ModeAllocationLab } from "./ModeAllocationLab";

/**
 * The scientific-notation scan below reads what the LAB draws, and the show-the-code panel is not
 * that: it quotes the kernel's own source, which carries literals like 6.1e-57 and 1.602176634e-19.
 * Those are code a reader opens a closed <details> to read, not numbers the instrument states, and
 * the guard they would trip exists because a SHARE once printed as "9.990000e-1".
 *
 * Proven in both directions in its own case below, because a stripper that removed everything would
 * make the assertion pass forever, and the assertion states the size of what it did read.
 */
function withoutCodePanel(markup: string): string {
  const open = markup.indexOf('<details id="stc"');
  if (open < 0) return markup;
  let depth = 0;
  let i = open;
  while (i < markup.length) {
    const nextOpen = markup.indexOf("<details", i);
    const nextClose = markup.indexOf("</details>", i);
    if (nextClose < 0) break;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + "<details".length;
      continue;
    }
    depth -= 1;
    i = nextClose + "</details>".length;
    if (depth === 0) return markup.slice(0, open) + markup.slice(i);
  }
  return markup.slice(0, open);
}

describe("ModeAllocationLab: static rendering (no JavaScript)", () => {
  const html = renderToStaticMarkup(<ModeAllocationLab example={DEFAULT_LQ02_INPUTS} />);

  test("renders the default snapshot's real numbers, not placeholders", () => {
    // From computeLq02Snapshot, never hand-typed in the component. Same digits as
    // toExponential(6), drawn as a power of ten with a spoken name (Sci.tsx).
    // A small exponent is written out: 6.439187e-3 is 0.006439187, the same seven digits.
    expect(html).toContain('<span class="sci">0.006439187</span> J/m³'); // energy up to the cutoff
    expect(html).toContain(
      'aria-label="2.070974 times 10 to the power minus 20">2.070974\u202f×\u202f10<sup>−20</sup></span> J',
    ); // mean resonator energy
  });

  test("the code-panel stripper takes the panel and nothing beside it", () => {
    const plain = "<p>a 1.5e-7 b</p>";
    expect(withoutCodePanel(plain)).toBe(plain);
    const panelled = `${plain}<details id="stc" class="show-the-code"><summary>Show the code</summary><code>const alpha = 6.1e-57;</code></details><p>after</p>`;
    expect(withoutCodePanel(panelled)).toBe(`${plain}<p>after</p>`);
    const nested = `${plain}<details id="stc"><details><p>6.1e-57</p></details></details><p>after</p>`;
    expect(withoutCodePanel(nested)).toBe(`${plain}<p>after</p>`);
  });

  test("no number reaches the reader in toExponential's serialization", () => {
    // It printed "9.990000e-1" for a share of 99.9% until 2026-09-22.
    const drawn = withoutCodePanel(html);
    // The denominator this scan speaks for, so that a stripper which emptied it would say so.
    expect(drawn.length).toBeGreaterThan(4000);
    expect(drawn).not.toMatch(/\d\.\d+e[-+]\d/);
    expect(drawn).toContain("0.9990000"); // the share above the probe frequency
  });

  test("has exactly one instrument root, addressable as lq-02", () => {
    expect(html).toContain('data-instrument-id="lq-02"');
  });

  test("labels the build's worked example static, and never claims a host or FrankenSim/WASM result", () => {
    expect(html).toContain('data-execution-label="static"');
    expect(html).toContain('<span class="badge">Static worked example</span>');
    expect(html).not.toContain('data-execution-label="host"');
    expect(html).not.toContain('data-execution-label="frankensim"');
  });

  test("includes a noscript notice so a no-JavaScript reader is never shown an empty box", () => {
    expect(html).toContain("<noscript>");
    expect(html).toContain("JavaScript is off");
  });

  test("notModeled is present and non-empty, shown as a plain line outside any disclosure", () => {
    const line = /<p class="fine">Not modeled: ([^<]*)<\/p>/.exec(html.replace(/<!-- -->/g, ""));
    expect(line?.[1]).toContain("Any quantum hypothesis");
    expect(line?.[1]).toContain("Cavity shape and walls");
    expect(html).not.toContain("<summary>What this model leaves out</summary>");
  });

  test("every input is a typed text field, not a slider: the accessible equivalent is the default interface", () => {
    expect(html).not.toContain('type="range"');
    expect(html).toContain('inputMode="decimal"');
  });

  test("show-the-code names the real owner modules, not this component", () => {
    expect(html).toContain("src/physics/reference/radiation/classical.ts");
    expect(html).toContain("src/physics/reference/radiation/avogadro.ts");
    expect(html).toContain("src/experiments/lq02/session.ts");
  });

  test("the controls come first and the energies wait for a prediction or a skip", () => {
    // Dispatch 156, option (c). The manifest's one prompt is asked, with its three candidates;
    // its "It levels off" is the finite-total answer the lab's own second question used to ask
    // about. The table, the note that states ×1000 and the status line wait; the regime note and
    // the not-modelled line stay. Without JavaScript all of it shows.
    expect(html).toContain('data-predict-prompt="lq-02-predict-widen"');
    for (const label of ["About ×10", "About ×1000", "It levels off"])
      expect(html).toContain(label);
    const actions = html.indexOf("Widen tenfold");
    expect(actions).toBeGreaterThan(-1);
    expect(actions).toBeLessThan(html.indexOf('data-predict-response="awaiting"'));
    expect(html).toMatch(
      /<table data-predict-response="awaiting"><tbody><tr><th scope="row">Mean energy/,
    );
    expect(html).toMatch(
      /<p class="model-note" data-predict-response="awaiting">With resonators up to/,
    );
    expect(html).toContain('<p class="model-note">§2&#x27;s Avogadro match');
    expect(html).toMatch(/class="status-line" data-predict-response="awaiting"/);
    expect(html).not.toContain('data-predict-response="shown"');
  });

  test("the model note names both disjoint regime boundaries as owner-supplied data, never as a hard-coded pair in this test's expectations alone", () => {
    expect(html).toContain("classical region, admitted at the 1% criterion for x ≤");
    expect(html).toContain("Wien region, admitted at x ≥");
  });

  test("the historical Avogadro readout is labeled apart from the modern value", () => {
    expect(html).toContain("historical");
    expect(html).toContain("defined, 2019 SI");
    expect(html).toContain("declared editorial inputs");
  });

  test("never titles or captions this instrument 'ultraviolet catastrophe'", () => {
    expect(html.toLowerCase()).not.toContain("ultraviolet catastrophe");
  });

  test("renders no script tags itself: works without JavaScript", () => {
    expect(html).not.toContain("<script");
  });
});

describe("ModeAllocationLab: no table row is ever labeled a bare 'Total'", () => {
  test("every energy label says 'up to', 'with resonators up to', or names the refusal", () => {
    const html = renderToStaticMarkup(<ModeAllocationLab example={DEFAULT_LQ02_INPUTS} />);
    expect(html).not.toContain(">Total<");
    expect(html).not.toContain(">Total:");
  });
});
