import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import LightComplexPage from "../app/lab/sr-10/page.tsx";
import { LightComplexLab } from "../components/lab/sr10/LightComplexLab.tsx";
import { createSr10Session, type PreparedSr10Example } from "../experiments/sr10/session.ts";
import rawExample from "../generated/sr10-example.json";

const example = rawExample as unknown as PreparedSr10Example;

/**
 * The "no forbidden imports" scan below reads what the LAB draws. The show-the-code panel is not
 * that: it quotes the kernel's own source under its module path, so "physics/reference" appears
 * there by design and as the whole point of the disclosure. The guard exists to catch a VIEW that
 * reaches into the physics layer, which is a different thing, and it keeps that subject by reading
 * past the panel rather than by looking for a shorter string. Proven in both directions in its own
 * case below.
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

describe("SR-10 Light Complex Lab View & Route (am-sr-10-light-complex-kek0)", () => {
  test("server component page renders without JavaScript and includes worked case", () => {
    const html = renderToStaticMarkup(<LightComplexPage />);
    expect(html).toContain("A packet of light does not transform");
    expect(html).toContain("Special relativity · Electrodynamics §8");
    expect(html).toContain("Worked case (readable without JavaScript)");
    expect(html).toContain("Treating the light complex like that rod");
    expect(html).toContain('data-instrument-id="sr-10"');
  });

  test("LightComplexLab consumes the snapshot: presets, countermodel comparison, no forbidden imports", () => {
    const html = renderToStaticMarkup(<LightComplexLab example={example} />);
    expect(html).toContain("Receding along axis");
    expect(html).toContain("Approaching along axis");
    expect(html).toContain("Transverse in k");
    expect(html).toContain("Transverse in K");
    expect(html).toContain("Countermodel Comparison");
    expect(html).toContain("wrong model");
    expect(html).toContain("Not modeled:");
    expect(html).toContain("<noscript>");
    const drawn = withoutCodePanel(html);
    // The denominator this scan speaks for, so an emptied stripper would say so here.
    expect(drawn.length).toBeGreaterThan(4000);
    expect(drawn).not.toContain("physics/reference");
  });

  test("session initializes and computes energy and volume from accepted snapshot", () => {
    const session = createSr10Session("test-sr10", example);
    const snap = session.getSnapshot().accepted;
    expect(snap).toBeDefined();
    expect(snap?.experimentId).toBe("sr-10");

    const energyMoving = snap?.outputs.find((o) => o.quantityId === "lightComplexEnergyMoving");
    expect(energyMoving?.status).toBe("value");
    if (energyMoving?.status === "value" && typeof energyMoving.value === "number") {
      expect(energyMoving.value).toBeCloseTo(0.5, 6);
    }

    const volumeMoving = snap?.outputs.find((o) => o.quantityId === "lightComplexVolumeMoving");
    expect(volumeMoving?.status).toBe("value");
    if (volumeMoving?.status === "value" && typeof volumeMoving.value === "number") {
      expect(volumeMoving.value).toBeCloseTo(2.0, 6);
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
