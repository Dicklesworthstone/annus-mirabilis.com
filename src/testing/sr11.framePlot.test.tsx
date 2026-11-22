import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MIRROR_FRAME,
  MovingMirrorPlot,
  type MovingMirrorPlotProps,
  mirrorRayGeometry,
} from "../components/lab/sr11/MovingMirrorPlot.tsx";
import { SR11_DEFAULTS, type Sr11Parameters } from "../experiments/sr11/definition.ts";
import { snapshotOutputs } from "../experiments/sr11/session.ts";

/** Exercise the real owner-to-plot contract, including its non-value results. */
function plotInput(
  input: Partial<Sr11Parameters> & Pick<Sr11Parameters, "beta" | "incidentAngleDeg">,
): MovingMirrorPlotProps {
  const parameters = { ...SR11_DEFAULTS, ...input };
  const outputs = snapshotOutputs(parameters);
  const frequency = outputs.find((output) => output.quantityId === "frequencyRatio");
  const value = (id: string) => {
    const output = outputs.find((candidate) => candidate.quantityId === id);
    return output?.status === "value" && typeof output.value === "number"
      ? output.value
      : Number.NaN;
  };
  return {
    beta: parameters.beta,
    incidentAngleDeg: value("incidentAngleInFrameDeg"),
    phiReflectedDeg: value("phiReflectedDeg"),
    frequencyRatio: value("frequencyRatio"),
    incidentFrequencyRatio: value("incidentFrequencyRatio"),
    radiationPressure: value("radiationPressure"),
    radiationForce: value("radiationForce"),
    incidentPower: value("incidentPower"),
    reflectedPower: value("reflectedPower"),
    workRate: value("workRate"),
    energyBalanceResidual: value("energyBalanceResidual"),
    frame: parameters.frame,
    isApplicable: frequency?.status === "value",
    notApplicableReason: frequency && "reason" in frequency ? frequency.reason : undefined,
  };
}

test("the mirror-rest plot reverses the normal ray component and preserves its tangential component", () => {
  for (const incidentAngleDeg of [0, (Math.acos(4 / 5) * 180) / Math.PI]) {
    const props = plotInput({ beta: 3 / 5, incidentAngleDeg, frame: "mirror" });
    expect(props.isApplicable).toBe(true);
    const geometry = mirrorRayGeometry(props.incidentAngleDeg, props.phiReflectedDeg);
    const incident = {
      x: geometry.incidentEnd.x - geometry.incidentStart.x,
      y: geometry.incidentEnd.y - geometry.incidentStart.y,
    };
    const reflected = {
      x: geometry.reflectedEnd.x - geometry.reflectedStart.x,
      y: geometry.reflectedEnd.y - geometry.reflectedStart.y,
    };
    expect(incident.x).toBeGreaterThan(0);
    expect(reflected.x).toBeLessThan(0);
    expect(reflected.x).toBeCloseTo(-incident.x, 10);
    expect(reflected.y).toBeCloseTo(incident.y, 10);

    const html = renderToStaticMarkup(<MovingMirrorPlot {...props} />);
    expect(html).toContain("mirror rest frame (k)");
    expect(html).toContain("mirror speed 0.00c");
    expect(html).toContain("mirror at rest");
    expect(html).not.toContain('marker-end="url(#arrow-velocity)"');
    expect(html).toContain("reflected light, at the same frequency");
    expect(html).not.toContain("reflected light, at a lower frequency");
    expect(html).not.toContain("reflected light, at a higher frequency");
  }
});

test("one oblique trial uses different admitted directions in K and k without changing its lab inputs", () => {
  // beta=3/5, cos(phi)=4/5 has exact transformed cosines 5/13 and -5/13 in k,
  // versus a reflected cosine 7/25 in K. The two k frequency ratios to K are both 13/20.
  const input = { beta: 3 / 5, incidentAngleDeg: (Math.acos(4 / 5) * 180) / Math.PI };
  const moving = plotInput({ ...input, frame: "mirror" });
  const laboratory = plotInput({ ...input, frame: "lab" });
  expect(moving.beta).toBe(input.beta);
  expect(laboratory.beta).toBe(input.beta);
  expect(moving.incidentFrequencyRatio).toBeCloseTo(13 / 20, 12);
  expect(moving.frequencyRatio).toBeCloseTo(13 / 20, 12);
  expect(laboratory.incidentFrequencyRatio).toBe(1);
  expect(laboratory.frequencyRatio).toBeCloseTo(5 / 8, 12);
  expect(moving.incidentAngleDeg).not.toBeCloseTo(input.incidentAngleDeg, 6);
  expect(laboratory.incidentAngleDeg).toBe(input.incidentAngleDeg);

  const kRays = mirrorRayGeometry(moving.incidentAngleDeg, moving.phiReflectedDeg);
  const KRays = mirrorRayGeometry(laboratory.incidentAngleDeg, laboratory.phiReflectedDeg);
  expect((kRays.incidentEnd.x - kRays.incidentStart.x) / MIRROR_FRAME.rayLength).toBeCloseTo(
    5 / 13,
    12,
  );
  expect((kRays.reflectedEnd.x - kRays.reflectedStart.x) / MIRROR_FRAME.rayLength).toBeCloseTo(
    -5 / 13,
    12,
  );
  expect((KRays.reflectedEnd.x - KRays.reflectedStart.x) / MIRROR_FRAME.rayLength).toBeCloseTo(
    7 / 25,
    12,
  );

  const html = renderToStaticMarkup(<MovingMirrorPlot {...laboratory} />);
  expect(html).toContain("laboratory frame (K)");
  expect(html).toContain("mirror speed 0.60c");
  expect(html).toContain('marker-end="url(#arrow-velocity)"');
  expect(html).toContain("reflected light, at a lower frequency");
});

test("noninterception and a numerically unresolved boundary retain their owner's reason without invented rays", () => {
  for (const frame of ["lab", "mirror"] as const) {
    for (const incidentAngleDeg of [60, (Math.acos(3 / 5) * 180) / Math.PI]) {
      const props = plotInput({ beta: 3 / 5, incidentAngleDeg, frame });
      expect(props.isApplicable).toBe(false);
      expect(props.notApplicableReason).toBeTruthy();
      const escapedReason = renderToStaticMarkup(<span>{props.notApplicableReason}</span>)
        .replace(/^<span>/, "")
        .replace(/<\/span>$/, "");
      const html = renderToStaticMarkup(<MovingMirrorPlot {...props} />);
      expect(html).toContain(escapedReason);
      expect(html).toContain(frame === "mirror" ? "mirror rest frame (k)" : "laboratory frame (K)");
      expect(html).not.toContain("<polyline");
      expect(html).not.toContain('stroke-dasharray="4 4"');
      expect(html).not.toContain("Nothing is exchanged");
      expect(html).not.toContain("Along the normal the light moves");
      expect(html).not.toContain("NaN");
      expect(html).not.toContain("Infinity");
      expect(html).not.toContain("degrees from +x");
    }
  }
});
