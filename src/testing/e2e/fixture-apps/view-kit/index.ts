/**
 * View Kit Interactive Fixture Application (am-inst-2d-view-kit-u75r requirement 8).
 *
 * Exercises all 2D view kit SVG and Canvas primitives with accepted snapshot
 * identity attributes, 5-parameter RepresentationScale, 3-layer accessibility,
 * and tracer census under browser conditions.
 */

import { createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  AccessibleGraphView,
  Axes2D,
  createLinearProjector,
  generateLinearTicks,
  Histogram,
  IntervalShade,
  LinePlot,
  type RepresentationScale,
  ScaleBar,
  ScatterPlot,
  TimeLegend,
  TrajectoryLayer,
} from "../../../../visuals/kit/index.ts";

export function createFixtureScale(
  overrides: Partial<RepresentationScale> = {},
): RepresentationScale {
  return {
    spatialMagnification: {
      appliesTo: "scene",
      factor: 1e8,
      note: "drawn one hundred million times larger than life",
    },
    simulatedElapsedTime: {
      quantityId: "elapsedTime",
      value: 1.5,
      unit: "s",
    },
    playbackMultiplier: 1, // true rate
    glyphSize: {
      drawnPx: 4,
      represents: "none",
    },
    quantityNormalization: {
      kind: "per-bin-width",
      note: "density normalized per micrometre",
    },
    ...overrides,
  };
}

export function ViewKitFixtureApp() {
  const xProj = createLinearProjector({ domain: [-10, 10], range: [50, 550] });
  const yProj = createLinearProjector({ domain: [0, 1], range: [250, 50] });

  const xTicks = generateLinearTicks(xProj, 5);
  const yTicks = generateLinearTicks(yProj, 5);

  const curveData = Array.from({ length: 41 }, (_, i) => {
    const x = -10 + i * 0.5;
    const y = Math.exp(-0.5 * (x / 3) ** 2) / (3 * Math.sqrt(2 * Math.PI));
    return { x, y };
  });

  const scatterData = [
    { x: -5, y: 0.05, dy: 0.01, label: "Sample -5" },
    { x: -2, y: 0.11, dy: 0.015, label: "Sample -2" },
    { x: 0, y: 0.13, dy: 0.01, label: "Sample 0" },
    { x: 2, y: 0.11, dy: 0.012, label: "Sample 2" },
    { x: 5, y: 0.05, dy: 0.008, label: "Sample 5" },
  ];

  const binData = {
    edges: [-10, -6, -2, 2, 6, 10],
    counts: [5, 25, 40, 24, 6],
    binProbabilities: [0.05, 0.25, 0.4, 0.24, 0.06],
    overflowCounts: { underflow: 0, overflow: 0 },
    totalCount: 100,
  };

  const tracers = Array.from({ length: 100 }, (_, i) => ({
    id: `tr-${i}`,
    positions: new Float32Array([
      0,
      0,
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12,
    ]),
  }));

  const scale = createFixtureScale();

  return createElement(
    "div",
    {
      id: "view-kit-fixture-root",
      "data-testid": "view-kit-root",
      "data-instance-id": "VK:1",
      "data-run-id": "run-vk-001",
      "data-snapshot-version": "1",
    },
    createElement(
      AccessibleGraphView,
      {
        title: "Brownian Displacement Distribution",
        description: "Ensemble displacement distribution compared with Gaussian diffusion theory.",
        summary:
          "The empirical step ensemble matches the predicted Gaussian spread with variance proportional to elapsed time.",
        scale,
        inspectableTable: {
          caption: "Empirical sample measurements",
          headers: ["Sample ID", "Displacement (μm)", "Uncertainty (μm)"],
          rows: scatterData.map((d, i) => ({
            key: `row-${i}`,
            cells: [d.label, d.x.toFixed(2), (d.dy ?? 0).toFixed(3)],
          })),
        },
      },
      createElement(
        "svg",
        {
          viewBox: "0 0 600 300",
          width: 600,
          height: 300,
          className: "fixture-plot-svg",
        },
        createElement(Axes2D, {
          xStart: 50,
          xEnd: 550,
          yStart: 50,
          yEnd: 250,
          xTicks,
          yTicks,
          xLabel: "Signed displacement",
          yLabel: "Probability density",
          xQuantityId: "displacement",
          yQuantityId: "probabilityDensity",
          xUnit: "μm",
          yUnit: "1/μm",
        }),
        createElement(IntervalShade, {
          interval: [-2, 2],
          xProjector: xProj,
          yProjector: yProj,
          probability: 0.5,
          quantityId: "probability",
        }),
        createElement(Histogram, {
          bins: binData,
          xProjector: xProj,
          yProjector: yProj,
          mode: "density",
          quantityId: "displacementDistribution",
        }),
        createElement(LinePlot, {
          data: curveData,
          xProjector: xProj,
          yProjector: yProj,
          seriesClass: "theoretical",
          quantityId: "gaussianDensity",
        }),
        createElement(ScatterPlot, {
          data: scatterData,
          xProjector: xProj,
          yProjector: yProj,
          seriesClass: "empirical",
          quantityId: "observedDisplacement",
        }),
        createElement(ScaleBar, {
          scale,
          physicalLength: 1e-6,
          unit: "μm",
          basePixelsPerUnit: 25,
          x: 60,
          y: 60,
        }),
      ),
      createElement(TimeLegend, { scale }),
      createElement(TrajectoryLayer, {
        instanceId: "VK:1",
        runId: "run-vk-001",
        snapshotVersion: 1,
        tracers,
        xProjector: xProj,
        yProjector: yProj,
        width: 600,
        height: 200,
        mode: "svg",
      }),
    ),
  );
}

// Auto-mount in browser environments
if (typeof document !== "undefined") {
  const container =
    document.getElementById("app") || document.body.appendChild(document.createElement("div"));
  container.id = "app";
  const root = createRoot(container);
  root.render(createElement(ViewKitFixtureApp));
}
