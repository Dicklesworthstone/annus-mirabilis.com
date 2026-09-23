import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import MovingMirrorPage from "../app/lab/sr-11/page.tsx";
import { MovingMirrorLab } from "../components/lab/sr11/MovingMirrorLab.tsx";
import {
  MIRROR_FRAME,
  MovingMirrorPlot,
  mirrorRayGeometry,
} from "../components/lab/sr11/MovingMirrorPlot.tsx";
import { createSr11Session, type PreparedSr11Example } from "../experiments/sr11/session.ts";
import rawExample from "../generated/sr11-example.json";
import { movingMirror } from "../physics/reference/waves.ts";

const example = rawExample as unknown as PreparedSr11Example;

describe("SR-11 Moving Mirror Lab View & Route (am-sr-11-moving-mirror-wnz1)", () => {
  test("server component page renders without JavaScript and includes worked case", () => {
    const html = renderToStaticMarkup(<MovingMirrorPage />);
    expect(html).toContain("Moving mirror reflection");
    expect(html).toContain("Special relativity · Electrodynamics §8");
    expect(html).toContain("Energy per second");
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

  // The drawing once placed the reflected ray at centerY - L·sin φ′′′, which retraces the incident
  // ray at every oblique angle. A mirror at rest must send light back as a mirror image of the
  // incidence about the normal: same distance from the mirror, opposite side of the normal.
  test("the reflected ray is drawn as a mirror image of the incident ray, not a retrace", () => {
    for (const deg of [10, 30, 60]) {
      const r = movingMirror(0, (deg * Math.PI) / 180);
      if (r.status !== "value") throw new Error(`expected a reflection at ${deg} degrees`);
      const g = mirrorRayGeometry(deg, (r.phiReflectedRad * 180) / Math.PI);
      expect(g.incidentStart.y).toBeLessThan(MIRROR_FRAME.centerY);
      expect(g.reflectedEnd.y).toBeGreaterThan(MIRROR_FRAME.centerY);
      expect(g.reflectedEnd.x).toBeCloseTo(g.incidentStart.x, 9);
      expect(g.reflectedEnd.y - MIRROR_FRAME.centerY).toBeCloseTo(
        MIRROR_FRAME.centerY - g.incidentStart.y,
        9,
      );
    }
  });

  // An approaching mirror does work on the light, so the kernel's work rate is negative and the
  // reflected light carries more than arrived. The ledger once dropped negative work, so its
  // "in" row showed the incident light alone and the two rows disagreed.
  test("an approaching mirror's work is counted with the energy coming in", () => {
    const r = movingMirror(-0.6, 0);
    if (r.status !== "value") throw new Error("expected a reflection head-on");
    expect(r.workRate).toBeLessThan(0);
    const html = renderToStaticMarkup(
      <MovingMirrorPlot
        beta={-0.6}
        incidentAngleDeg={0}
        phiReflectedDeg={(r.phiReflectedRad * 180) / Math.PI}
        frequencyRatio={r.frequencyRatio}
        radiationPressure={r.radiationPressure}
        radiationForce={r.radiationForce}
        incidentPower={r.incidentPower}
        reflectedPower={r.reflectedPower}
        workRate={r.workRate}
        energyBalanceResidual={r.energyBalanceResidual}
        frame="lab"
        isApplicable
      />,
    );
    const inflow = (r.incidentPower - r.workRate).toFixed(3);
    const outflow = r.reflectedPower.toFixed(3);
    expect(inflow).toBe(outflow);
    expect(html.split(`${inflow} W`).length - 1).toBe(2);
    expect(html).toContain("work the approaching mirror does on the light");
  });
});
