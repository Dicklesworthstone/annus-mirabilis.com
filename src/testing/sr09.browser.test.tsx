import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import DopplerAberrationPage from "../app/lab/sr-09/page.tsx";
import { DopplerAberrationLab } from "../components/lab/sr09/DopplerAberrationLab.tsx";
import { createSr09Session, type PreparedSr09Example } from "../experiments/sr09/session.ts";
import rawExample from "../generated/sr09-example.json";

const example = rawExample as unknown as PreparedSr09Example;

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
    expect(html).not.toContain("physics/reference");
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
});
