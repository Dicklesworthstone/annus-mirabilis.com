import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import LightComplexPage from "../app/lab/sr-10/page.tsx";
import { LightComplexLab } from "../components/lab/sr10/LightComplexLab.tsx";
import { createSr10Session, type PreparedSr10Example } from "../experiments/sr10/session.ts";
import rawExample from "../generated/sr10-example.json";

const example = rawExample as unknown as PreparedSr10Example;

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
    expect(html).not.toContain("physics/reference");
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
});
