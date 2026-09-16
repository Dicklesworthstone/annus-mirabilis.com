import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { auditAccessibleScaleFacts } from "../../a11y/descriptions/templates.ts";
import {
  AccessibleGraphView,
  Axes2D,
  createLinearProjector,
  generateLinearTicks,
  Histogram,
  LinePlot,
  type RepresentationScale,
  ScaleBar,
  ScatterPlot,
  TimeLegend,
} from "../../visuals/kit/index.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("Single-Source Visual and Accessible Description Parity (am-inst-2d-view-kit-u75r)", () => {
  // Single canonical data model representing an accepted simulation snapshot
  interface DiffusionSnapshot {
    readonly snapshotVersion: string;
    readonly runId: string;
    readonly instrumentId: string;
    readonly viewId: string;
    readonly time: number;
    readonly diffusionCoefficient: number;
    readonly rmsDisplacement: number;
    readonly samples: readonly { readonly id: string; readonly x: number; readonly prob: number }[];
    readonly theoreticalCurve: readonly { readonly x: number; readonly y: number }[];
    readonly bins: {
      readonly edges: readonly number[];
      readonly counts: readonly number[];
      readonly binProbabilities: readonly number[];
    };
    readonly scale: RepresentationScale;
  }

  function createDiffusionSnapshot(t: number, version: string): DiffusionSnapshot {
    const D = 5.22e-13; // m^2/s
    const rms = Math.sqrt(2 * D * t) * 1e6; // in micrometres (μm)

    // Generate discrete histogram bins
    const edges = [-2, -1, 0, 1, 2];
    const counts = [10, 40, 40, 10];
    const binProbabilities = [0.1, 0.4, 0.4, 0.1];

    // Generate sample scatter points
    const samples = [
      { id: "s1", x: -1.5, prob: 0.1 },
      { id: "s2", x: -0.5, prob: 0.4 },
      { id: "s3", x: 0.5, prob: 0.4 },
      { id: "s4", x: 1.5, prob: 0.1 },
    ];

    // Generate theoretical Gaussian curve
    const theoreticalCurve = [
      { x: -2, y: 0.05 },
      { x: -1, y: 0.24 },
      { x: 0, y: 0.4 },
      { x: 1, y: 0.24 },
      { x: 2, y: 0.05 },
    ];

    const scale: RepresentationScale = {
      spatialMagnification: {
        appliesTo: "scene",
        factor: 10000,
        note: "optical microscope 10,000x",
      },
      simulatedElapsedTime: {
        quantityId: "t",
        value: t,
        unit: "s",
      },
      playbackMultiplier: 1, // true rate
      glyphSize: {
        drawnPx: 4,
        represents: "none",
      },
      quantityNormalization: {
        kind: "per-bin-width",
        note: "per micrometre",
      },
    };

    return {
      snapshotVersion: version,
      runId: `run-${version}`,
      instrumentId: "bm-01",
      viewId: "diffusion-histogram",
      time: t,
      diffusionCoefficient: D,
      rmsDisplacement: rms,
      samples,
      theoreticalCurve,
      bins: { edges, counts, binProbabilities },
      scale,
    };
  }

  function SingleSourceViewComponent({ snapshot }: { readonly snapshot: DiffusionSnapshot }) {
    const xProj = createLinearProjector({ domain: [-3, 3], range: [40, 560] });
    const yProj = createLinearProjector({ domain: [0, 0.5], range: [260, 40] });

    const xTicks = generateLinearTicks(xProj, 5);
    const yTicks = generateLinearTicks(yProj, 5);

    // Map table data directly from the same snapshot.samples
    const inspectableTable = {
      caption: "Tracer displacement samples vs probability",
      headers: ["Sample ID", "Position x (μm)", "Probability density (1/μm)"],
      rows: snapshot.samples.map((s) => ({
        key: s.id,
        cells: [s.id, s.x.toFixed(2), s.prob.toFixed(2)],
      })),
    };

    return createElement(
      AccessibleGraphView,
      {
        title: "Brownian Diffusion Ensemble",
        description: "Observed tracer displacements compared with theoretical Gaussian curve.",
        template:
          "Tracer root-mean-square displacement is {lambda_x} at elapsed time {t}. Diffusion coefficient D = {D}. {scaleSummary}",
        templateData: {
          quantities: {
            lambda_x: snapshot.rmsDisplacement,
            t: snapshot.time,
            D: snapshot.diffusionCoefficient,
          },
          units: {
            lambda_x: "μm",
            t: "s",
            D: "m^2/s",
          },
        },
        snapshotVersion: snapshot.snapshotVersion,
        runId: snapshot.runId,
        instrumentId: snapshot.instrumentId,
        viewId: snapshot.viewId,
        scale: snapshot.scale,
        inspectableTable,
      },
      createElement(
        "svg",
        {
          viewBox: "0 0 600 300",
          width: 600,
          height: 300,
          className: "single-source-svg",
        },
        createElement(Axes2D, {
          xStart: 40,
          xEnd: 560,
          yStart: 40,
          yEnd: 260,
          xTicks,
          yTicks,
          xLabel: "Displacement",
          yLabel: "Probability density",
          xQuantityId: "x",
          yQuantityId: "probabilityDensity",
          xUnit: "μm",
          yUnit: "1/μm",
        }),
        createElement(Histogram, {
          bins: snapshot.bins,
          xProjector: xProj,
          yProjector: yProj,
          mode: "probability",
          quantityId: "displacementDistribution",
        }),
        createElement(LinePlot, {
          data: snapshot.theoreticalCurve,
          xProjector: xProj,
          yProjector: yProj,
          seriesClass: "theoretical",
          quantityId: "gaussianTheory",
        }),
        createElement(ScatterPlot, {
          data: snapshot.samples.map((s) => ({ x: s.x, y: s.prob, label: s.id })),
          xProjector: xProj,
          yProjector: yProj,
          seriesClass: "empirical",
          quantityId: "observedTracerPositions",
        }),
        createElement(ScaleBar, {
          scale: snapshot.scale,
          physicalLength: 1e-6,
          unit: "μm",
          basePixelsPerUnit: 20,
          x: 50,
          y: 50,
        }),
      ),
      createElement(TimeLegend, { scale: snapshot.scale }),
    );
  }

  test("generates visual SVG plot and accessible description from a single data source", async () => {
    const container = createContainer();
    const root = createRoot(container);
    const snapshot1 = createDiffusionSnapshot(1.0, "snap-v1");

    try {
      await act(() => {
        root.render(createElement(SingleSourceViewComponent, { snapshot: snapshot1 }));
      });

      // 1. Identity attributes verification
      const figure = container.querySelector("figure.accessible-graph-view");
      expect(figure).not.toBeNull();
      expect(figure?.getAttribute("data-snapshot-version")).toBe("snap-v1");
      expect(figure?.getAttribute("data-instrument-id")).toBe("bm-01");
      expect(figure?.getAttribute("data-view-id")).toBe("diffusion-histogram");
      expect(figure?.getAttribute("data-run-id")).toBe("run-snap-v1");

      // 2. Visual elements verification
      const svg = container.querySelector("svg.single-source-svg");
      expect(svg).not.toBeNull();

      const linePath = container.querySelector(".line-plot path");
      expect(linePath).not.toBeNull();
      expect(linePath?.getAttribute("d")).toBeTruthy();

      const scatterCircles = container.querySelectorAll(".scatter-plot circle");
      expect(scatterCircles.length).toBe(snapshot1.samples.length);

      const histBars = container.querySelectorAll(".histogram-bar");
      expect(histBars.length).toBe(snapshot1.bins.counts.length);

      // 3. Accessible Layer 1 verification
      const layer1 = container.querySelector(".graph-layer-1");
      expect(layer1?.textContent).toContain("Brownian Diffusion Ensemble");
      expect(layer1?.textContent).toContain("Observed tracer displacements");

      // 4. Accessible Layer 2 relation summary verification
      const layer2 = container.querySelector(".graph-layer-2-region");
      expect(layer2?.getAttribute("role")).toBe("status");
      expect(layer2?.getAttribute("aria-live")).toBe("polite");
      expect(layer2?.textContent).toContain("Tracer root-mean-square displacement is");
      expect(layer2?.textContent).toContain("1.021763 μm"); // sqrt(2 * 5.22e-13 * 1.0) * 1e6 ≈ 1.021763 μm
      expect(layer2?.textContent).toContain("5.220000 × 10^-13 m^2/s");
      expect(layer2?.textContent).toContain("Scene magnified ×10,000");

      // 5. Accessible Layer 3 data table verification
      const table = container.querySelector(".inspectable-table");
      expect(table).not.toBeNull();
      expect(table?.textContent).toContain("Tracer displacement samples vs probability");

      // Check row-by-row data matching between visual points and table
      const rows = container.querySelectorAll(".inspectable-table tbody tr");
      expect(rows.length).toBe(snapshot1.samples.length);
      for (let i = 0; i < snapshot1.samples.length; i++) {
        const sample = snapshot1.samples[i];
        if (!sample) continue;
        const row = rows[i];
        expect(row?.textContent).toContain(sample.id);
        expect(row?.textContent).toContain(sample.x.toFixed(2));
        expect(row?.textContent).toContain(sample.prob.toFixed(2));
      }

      // 6. RepresentationScale facts audit
      auditAccessibleScaleFacts(
        container.textContent ?? "",
        snapshot1.scale,
        "diffusion-histogram",
      );
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("updating the single source updates both visual elements and accessible descriptions in lockstep", async () => {
    const container = createContainer();
    const root = createRoot(container);

    const snapshot1 = createDiffusionSnapshot(1.0, "snap-v1");
    const snapshot2 = createDiffusionSnapshot(4.0, "snap-v2"); // 4x time -> 2x rms displacement

    try {
      // Mount snapshot 1
      await act(() => {
        root.render(createElement(SingleSourceViewComponent, { snapshot: snapshot1 }));
      });

      const layer2Before = container.querySelector(".graph-layer-2-region")?.textContent ?? "";
      expect(layer2Before).toContain("1.021763 μm");
      expect(layer2Before).toContain("at elapsed time 1 s");

      // Update with snapshot 2
      await act(() => {
        root.render(createElement(SingleSourceViewComponent, { snapshot: snapshot2 }));
      });

      // Assert snapshot version updated
      const figure = container.querySelector("figure.accessible-graph-view");
      expect(figure?.getAttribute("data-snapshot-version")).toBe("snap-v2");

      // Assert Layer 2 text updated with new values
      const layer2After = container.querySelector(".graph-layer-2-region")?.textContent ?? "";
      expect(layer2After).toContain("2.043526 μm"); // sqrt(2 * 5.22e-13 * 4.0) * 1e6 ≈ 2.043526 μm
      expect(layer2After).toContain("at elapsed time 4 s");

      // Assert ScaleBar and TimeLegend updated
      const timeLegend = container.querySelector(".time-legend");
      expect(timeLegend?.textContent).toContain("4.00 s");

      // Verify all 5 scale facts present on snapshot 2
      auditAccessibleScaleFacts(
        container.textContent ?? "",
        snapshot2.scale,
        "diffusion-histogram",
      );
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
