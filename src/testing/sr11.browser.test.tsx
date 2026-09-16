import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import MovingMirrorPage from "../app/lab/sr-11/page.tsx";
import { MovingMirrorLab } from "../components/lab/sr11/MovingMirrorLab.tsx";
import { createSr11Session, type PreparedSr11Example } from "../experiments/sr11/session.ts";
import rawExample from "../generated/sr11-example.json";

const example = rawExample as unknown as PreparedSr11Example;

describe("SR-11 Moving Mirror Lab View & Route (am-sr-11-moving-mirror-wnz1)", () => {
  test("server component page renders without JavaScript and includes worked case", () => {
    const html = renderToStaticMarkup(<MovingMirrorPage />);
    expect(html).toContain("Moving mirror reflection");
    expect(html).toContain("Special relativity · Electrodynamics §8");
    expect(html).toContain("Energy Conservation Ledger");
    expect(html).toContain("0.4 - 0.1 - 0.3 = 0");
    expect(html).toContain("The energy lost by the electromagnetic radiation");
  });

  test("MovingMirrorLab component renders vector diagram and controls", () => {
    const html = renderToStaticMarkup(<MovingMirrorLab example={example} />);
    expect(html).toContain('data-instrument-id="sr-11"');
    expect(html).toContain("Mirror velocity β = v/c");
    expect(html).toContain("Incident angle φ");
    expect(html).toContain("Receding 0.6c (normal)");
    expect(html).toContain("Approaching -0.6c (head-on)");
    expect(html).toContain("Oblique 30° (0.6c)");
    expect(html).toContain("Interception limit (53.13°)");
    expect(html).toContain("Mirror frame (0.6c)");
    expect(html).toContain("Stationary (β = 0)");
  });

  test("session initializes and computes transformed mirror reflection", () => {
    const session = createSr11Session("test-sr11", example);
    const snap = session.getSnapshot().accepted;
    expect(snap).toBeDefined();
    expect(snap?.experimentId).toBe("sr-11");

    const freqOut = snap?.outputs.find((o) => o.quantityId === "frequencyRatio");
    expect(freqOut?.status).toBe("value");
    if (freqOut?.status === "value" && typeof freqOut.value === "number") {
      expect(freqOut.value).toBeCloseTo(0.25, 6);
    }

    const pIncOut = snap?.outputs.find((o) => o.quantityId === "incidentPower");
    expect(pIncOut?.status).toBe("value");
    if (pIncOut?.status === "value" && typeof pIncOut.value === "number") {
      expect(pIncOut.value).toBeCloseTo(0.4, 6);
    }
  });
});
