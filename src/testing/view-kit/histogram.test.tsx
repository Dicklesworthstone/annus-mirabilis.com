import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  createLinearProjector,
  Histogram,
  type HistogramBinData,
} from "../../visuals/kit/index.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("Histogram explicit owner-bin contract (am-inst-2d-view-kit-u75r)", () => {
  const xProj = createLinearProjector({ domain: [-10, 10], range: [50, 450] });
  const yProj = createLinearProjector({ domain: [0, 0.5], range: [250, 50] });

  test("owner bins with overflow counts total the entire ensemble size", async () => {
    const container = createContainer();
    const root = createRoot(container);

    const bins: HistogramBinData = {
      edges: [-10, -6, -2, 2, 6, 10],
      counts: [10, 25, 45, 23, 7], // sum = 110
      binProbabilities: [10 / 120, 25 / 120, 45 / 120, 23 / 120, 7 / 120],
      overflowCounts: {
        underflow: 4,
        overflow: 6,
      },
      totalCount: 120, // 110 inside + 4 underflow + 6 overflow = 120 total ensemble
    };

    const sumCounts =
      bins.counts.reduce((a, b) => a + b, 0) +
      (bins.overflowCounts?.underflow ?? 0) +
      (bins.overflowCounts?.overflow ?? 0);
    expect(sumCounts).toBe(bins.totalCount ?? 0);

    try {
      await act(() => {
        root.render(
          createElement(
            "svg",
            { width: 500, height: 300 },
            createElement(Histogram, {
              bins,
              xProjector: xProj,
              yProjector: yProj,
              mode: "probability",
              quantityId: "bm-histogram",
            }),
          ),
        );
      });

      const bars = container.querySelectorAll(".histogram-bar");
      expect(bars.length).toBe(5);

      const overflow = container.querySelector(".overflow-indicators");
      expect(overflow?.textContent).toContain("← 4");
      expect(overflow?.textContent).toContain("6 →");

      const annotation = container.querySelector(".histogram-annotation");
      expect(annotation?.textContent).toContain("Bin width Δx = 4.00");
      expect(annotation?.textContent).toContain("Mode: Bin probability");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("toggles cleanly between probability and density modes", async () => {
    const container = createContainer();
    const root = createRoot(container);

    const bins: HistogramBinData = {
      edges: [0, 2, 4, 6],
      counts: [20, 50, 30],
      binProbabilities: [0.2, 0.5, 0.3],
    };

    try {
      // Density mode
      await act(() => {
        root.render(
          createElement(
            "svg",
            { width: 500, height: 300 },
            createElement(Histogram, {
              bins,
              xProjector: xProj,
              yProjector: yProj,
              mode: "density",
            }),
          ),
        );
      });

      let hist = container.querySelector(".histogram");
      expect(hist?.getAttribute("data-histogram-mode")).toBe("density");
      let annotation = container.querySelector(".histogram-annotation");
      expect(annotation?.textContent).toContain("Mode: Probability density");

      // Probability mode
      await act(() => {
        root.render(
          createElement(
            "svg",
            { width: 500, height: 300 },
            createElement(Histogram, {
              bins,
              xProjector: xProj,
              yProjector: yProj,
              mode: "probability",
            }),
          ),
        );
      });

      hist = container.querySelector(".histogram");
      expect(hist?.getAttribute("data-histogram-mode")).toBe("probability");
      annotation = container.querySelector(".histogram-annotation");
      expect(annotation?.textContent).toContain("Mode: Bin probability");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("comparison series is distinguishable without color", async () => {
    const container = createContainer();
    const root = createRoot(container);

    const bins: HistogramBinData = {
      edges: [0, 2, 4],
      counts: [50, 50],
      binProbabilities: [0.5, 0.5],
    };
    const comparisonData = [0.48, 0.52];

    try {
      await act(() => {
        root.render(
          createElement(
            "svg",
            { width: 500, height: 300 },
            createElement(Histogram, {
              bins,
              xProjector: xProj,
              yProjector: yProj,
              comparisonData,
              comparisonLabel: "FTCS Discrete Model",
            }),
          ),
        );
      });

      const compSeries = container.querySelector(".comparison-series");
      expect(compSeries).not.toBeNull();
      expect(compSeries?.getAttribute("data-comparison-label")).toBe("FTCS Discrete Model");

      // Distinct non-color stroke pattern
      const path = compSeries?.querySelector("path");
      expect(path?.getAttribute("stroke-dasharray")).toBe("4 3");

      // Distinct markers
      const circles = compSeries?.querySelectorAll("circle");
      expect(circles?.length).toBe(2);
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("Histogram returns null when bins contract is invalid", async () => {
    const container = createContainer();
    const root = createRoot(container);

    const invalidBins = {
      edges: [0], // < 2 edges
      counts: [10],
      binProbabilities: [1.0],
    };

    try {
      await act(() => {
        root.render(
          createElement(Histogram, {
            bins: invalidBins as unknown as HistogramBinData,
            xProjector: xProj,
            yProjector: yProj,
          }),
        );
      });

      expect(container.querySelector(".histogram")).toBeNull();
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("proves no API accepts raw positions for binning: Histogram contract strictly requires owner-computed bins", async () => {
    const container = createContainer();
    const root = createRoot(container);

    // If raw sample positions are passed directly without pre-calculated bins:
    const rawPositions = [0.2, -1.4, 0.8, 3.2, -0.5];

    try {
      await act(() => {
        root.render(
          createElement(Histogram, {
            bins: rawPositions as unknown as HistogramBinData,
            xProjector: xProj,
            yProjector: yProj,
          }),
        );
      });

      // Passing raw numbers without owner-supplied edges/counts returns null;
      // the view never invents or computes its own bins.
      expect(container.querySelector(".histogram")).toBeNull();
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
