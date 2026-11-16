import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { srMirrorChains, srMirrorSourceLinks } from "../equations/derivations/srMirror.ts";
import { movingMirror } from "../physics/reference/waves.ts";
import { SRMirrorDerivation } from "./SRMirrorDerivation.tsx";

describe("the source-linked SR §8 moving-mirror derivation", () => {
  test("all reflection, energy and pressure steps are present without hydration", () => {
    const html = renderToStaticMarkup(<SRMirrorDerivation />);
    expect(html).toContain('id="sr-mirror-derivation"');
    expect(html).toContain('data-argument-id="arg-sr-moving-mirror"');
    expect(html).toContain('data-review="draft"');
    expect(html).toContain('data-historical-status="pedagogical-reconstruction"');
    expect(html).toContain('data-model-status="perfect-reflector-prescribed-subluminal-motion"');
    expect(html).toContain('data-is-move="true"');
    expect(html).toContain("<math");
    expect(html).not.toContain("katex-error");
    for (const chain of srMirrorChains) {
      expect(html).toContain('data-derivation-chain="' + chain.id + '"');
      for (const step of chain.steps) {
        expect(html).toContain('data-step-id="' + step.id + '"');
        expect(html).toContain('id="' + step.sourceAnchor + '"');
        expect(html).toContain("/foundations/" + step.tool!.replace("foundation:", "") + "/");
      }
    }
    for (const source of srMirrorSourceLinks) {
      expect(html).toContain(
        'href="/papers/special-relativity/view/german/#' + source.anchor + '"',
      );
      const printed = readFileSync(
        join(process.cwd(), "content/source-blocks/special-relativity", source.anchor + ".yaml"),
        "utf8",
      );
      expect(printed).toContain('id: "' + source.anchor + '"');
    }
    expect(html).toContain('href="/lab/sr-11/"');
    expect(html).toContain('href="/papers/special-relativity/s7/#sr-doppler-derivation"');
    expect(html).toContain("propagation direction in K");
    expect(html).toContain("per unit mirror area and per unit K time");
    expect(html).toContain("A fixed detector samples a different crossing rate");
  });

  test("the zero-speed pressure needs an explicit premise and source corrections stay visible", () => {
    const html = renderToStaticMarkup(
      <SRMirrorDerivation activeDetail="2" perspective="modern" />,
    );
    expect(html).toContain('data-detail="1" hidden=""');
    expect(html).not.toMatch(/data-detail="2" hidden=""/);
    expect(html).toContain("Show every step here");
    expect(html).toContain("Nonzero speed: extract the pressure from the work");
    expect(html).toContain("At rest: zero work does not mean zero pressure");
    expect(html).toContain("at zero is invalid");
    expect(html).toContain("physical continuity");
    expect(html).toContain("grazing");
    expect(html).toContain("printed frequency expression");
    expect(html).toContain("corrected canonical equation");
    expect(html).toContain("printed source remains");
    expect(html).toContain("No photon energy law");
  });

  test("the two reader examples agree with the existing moving-mirror account", () => {
    const cases = [
      { beta: 0.6, ratio: 0.25, incident: 0.4, reflected: 0.1, work: 0.3, pressure: 0.5 },
      { beta: -0.6, ratio: 4, incident: 1.6, reflected: 6.4, work: -4.8, pressure: 8 },
    ];
    for (const example of cases) {
      const value = movingMirror(example.beta, 0, { u: 1, c: 1, Am: 1 });
      expect(value.status).toBe("value");
      if (value.status !== "value") throw new Error("A normal-incidence example must intercept.");
      expect(value.frequencyRatio).toBeCloseTo(example.ratio, 12);
      expect(value.incidentPower).toBeCloseTo(example.incident, 12);
      expect(value.reflectedPower).toBeCloseTo(example.reflected, 12);
      expect(value.workRate).toBeCloseTo(example.work, 12);
      expect(value.radiationPressure).toBeCloseTo(example.pressure, 12);
    }
  });
});
