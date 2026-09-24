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

const example = rawExample as unknown as PreparedSr11Example;

/**
 * The kernel's outputs at one setting, read through the laboratory's own session. A .tsx module may
 * not import src/physics/reference (the import-boundary gate), and a view test should see exactly
 * the numbers the view is given.
 */
function acceptedAt(beta: number, incidentAngleDeg: number): (id: string) => number {
  const session = createSr11Session(`test-sr11-${beta}-${incidentAngleDeg}`, example);
  session.apply({ ...session.acceptedParameters(), beta, incidentAngleDeg });
  const snap = session.getSnapshot().accepted;
  if (!snap) throw new Error("expected an accepted snapshot");
  return (id) => {
    const out = snap.outputs.find((o) => o.quantityId === id);
    if (out?.status !== "value" || typeof out.value !== "number") {
      throw new Error(`expected a number for ${id} at beta ${beta}, ${incidentAngleDeg} degrees`);
    }
    return out.value;
  };
}

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
      // Watts at c = 299 792 458 m/s: 0.4c for 1 J/m³ on 1 m² at 0.6c (it was 0.4 with c = 1).
      expect(pIncOut.value / 299792458).toBeCloseTo(0.4, 12);
    }
  });

  // The drawing once placed the reflected ray at centerY - L·sin φ′′′, which retraces the incident
  // ray at every oblique angle. A mirror at rest must send light back as a mirror image of the
  // incidence about the normal: same distance from the mirror, opposite side of the normal.
  test("the reflected ray is drawn as a mirror image of the incident ray, not a retrace", () => {
    for (const deg of [10, 30, 60]) {
      const out = acceptedAt(0, deg);
      const g = mirrorRayGeometry(deg, out("phiReflectedDeg"));
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
    const out = acceptedAt(-0.6, 0);
    expect(out("workRate")).toBeLessThan(0);
    const html = renderToStaticMarkup(
      <MovingMirrorPlot
        beta={-0.6}
        incidentAngleDeg={0}
        phiReflectedDeg={out("phiReflectedDeg")}
        frequencyRatio={out("frequencyRatio")}
        radiationPressure={out("radiationPressure")}
        radiationForce={out("radiationForce")}
        incidentPower={out("incidentPower")}
        reflectedPower={out("reflectedPower")}
        workRate={out("workRate")}
        energyBalanceResidual={out("energyBalanceResidual")}
        frame="lab"
        isApplicable
      />,
    );
    // The ledger prints its powers in watts as powers of ten; inflow and outflow must read the same.
    const values = [...html.matchAll(/class="sr11-ledger-value">(.*?)<\/span> W<\/span>/gu)].map(
      (m) => m[1]?.replace(/<[^>]+>/gu, ""),
    );
    expect(values.length).toBe(2);
    expect(values[0]).toBe(values[1]);
    expect(out("incidentPower") - out("workRate")).toBeCloseTo(out("reflectedPower"), -3);
    expect(html).toContain("work the approaching mirror does on the light");
  });
});
