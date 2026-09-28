import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import DopplerAberrationPage from "../app/lab/sr-09/page.tsx";
import { DopplerAberrationLab } from "../components/lab/sr09/DopplerAberrationLab.tsx";
import { createSr09Session, type PreparedSr09Example } from "../experiments/sr09/session.ts";
import rawExample from "../generated/sr09-example.json";

const example = rawExample as unknown as PreparedSr09Example;

/**
 * The "no forbidden imports" scan below reads what the LAB draws. The show-the-code panel is not
 * that: it quotes the kernel's own source under its module path, so "physics/reference" appears
 * there by design. The guard exists to catch a VIEW reaching into the physics layer, and it keeps
 * that subject by reading past the panel rather than by looking for a shorter string. Proven in
 * both directions in its own case below.
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

describe("SR-09 Doppler and Aberration Lab View & Route (am-sr-09-doppler-aberration-rabd)", () => {
  test("server component page renders without JavaScript and includes the transverse case", () => {
    const html = renderToStaticMarkup(<DopplerAberrationPage />);
    expect(html).toContain("Frequency and direction transform together");
    expect(html).toContain("Special relativity · Electrodynamics §7");
    expect(html).toContain("Worked case (readable without JavaScript)");
    expect(html).toContain("For a ray at right angles");
    expect(html).toContain('data-instrument-id="sr-09"');
  });

  test("DopplerAberrationLab consumes the snapshot: named rays, classical comparison, no slider", () => {
    const html = renderToStaticMarkup(<DopplerAberrationLab example={example} />);
    expect(html).toContain("Transverse 0.6c");
    expect(html).toContain("Medium, moving observer");
    expect(html).toContain("Medium, moving source");
    expect(html).toContain("the purely relativistic shift");
    expect(html).toContain("Not modeled:");
    expect(html).toContain("<noscript>");
    expect(html).not.toContain('type="range"');
    const drawn = withoutCodePanel(html);
    // The denominator this scan speaks for, so an emptied stripper would say so here.
    expect(drawn.length).toBeGreaterThan(4000);
    expect(drawn).not.toContain("physics/reference");
  });

  test("session initializes and computes Doppler factor from the accepted snapshot", () => {
    const session = createSr09Session("test-sr09", example);
    const snap = session.getSnapshot().accepted;
    expect(snap).toBeDefined();
    expect(snap?.experimentId).toBe("sr-09");
    const doppler = snap?.outputs.find((o) => o.quantityId === "dopplerFactor");
    expect(doppler?.status).toBe("value");
    if (doppler?.status === "value" && typeof doppler.value === "number") {
      expect(doppler.value).toBeCloseTo(0.5, 6);
    }
  });

  test("the code-panel stripper takes the panel and nothing beside it", () => {
    const plain = "<p>a lab drawing physics</p>";
    expect(withoutCodePanel(plain)).toBe(plain);
    const panelled = `${plain}<details id="stc" class="show-the-code"><code>src/physics/reference/waves.ts</code></details><p>after</p>`;
    expect(withoutCodePanel(panelled)).toBe(`${plain}<p>after</p>`);
    const nested = `${plain}<details id="stc"><details><code>physics/reference</code></details></details><p>after</p>`;
    expect(withoutCodePanel(nested)).toBe(`${plain}<p>after</p>`);
  });
});
