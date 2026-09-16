import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  AnalyticLimitMarker,
  createLinearProjector,
  Histogram,
  IntervalShade,
  LinePlot,
  ReferenceLinePlot,
  ScatterPlot,
} from "../../visuals/kit/index.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("plot primitives (am-inst-2d-view-kit-u75r)", () => {
  const xProj = createLinearProjector({ domain: [0, 10], range: [0, 500] });
  const yProj = createLinearProjector({ domain: [0, 10], range: [500, 0] });

  test("LinePlot renders theoretical (solid), historical (dashed 6 4), and empirical (dashed 2 2) series", async () => {
    const container = createContainer();
    const root = createRoot(container);
    const data = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 10 },
    ];

    try {
      await act(() => {
        root.render(
          createElement("svg", {}, [
            createElement(LinePlot, {
              key: "theo",
              data,
              xProjector: xProj,
              yProjector: yProj,
              seriesClass: "theoretical",
              quantityId: "theo-line",
            }),
            createElement(LinePlot, {
              key: "hist",
              data,
              xProjector: xProj,
              yProjector: yProj,
              seriesClass: "historical",
              quantityId: "hist-line",
            }),
            createElement(LinePlot, {
              key: "emp",
              data,
              xProjector: xProj,
              yProjector: yProj,
              seriesClass: "empirical",
              quantityId: "emp-line",
            }),
          ]),
        );
      });

      const theo = container.querySelector('[data-series-class="theoretical"] path');
      const hist = container.querySelector('[data-series-class="historical"] path');
      const emp = container.querySelector('[data-series-class="empirical"] path');

      expect(theo?.getAttribute("stroke-dasharray")).toBeNull();
      expect(hist?.getAttribute("stroke-dasharray")).toBe("6 4");
      expect(emp?.getAttribute("stroke-dasharray")).toBe("2 2");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("ScatterPlot renders uncertainty error bars and distinctive markers", async () => {
    const container = createContainer();
    const root = createRoot(container);
    const data = [
      { x: 2, y: 3, dy: 0.5, label: "Point A" },
      { x: 6, y: 7, dy: 1.0, label: "Point B" },
    ];

    try {
      await act(() => {
        root.render(
          createElement(
            "svg",
            {},
            createElement(ScatterPlot, {
              data,
              xProjector: xProj,
              yProjector: yProj,
              seriesClass: "empirical",
              quantityId: "scatter-obs",
            }),
          ),
        );
      });

      const errorBars = container.querySelectorAll(".error-bar");
      expect(errorBars.length).toBe(2);

      const points = container.querySelectorAll(".scatter-point");
      expect(points.length).toBe(2);
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("Histogram renders explicit bins and supports probability vs density modes and comparison series", async () => {
    const container = createContainer();
    const root = createRoot(container);
    const bins = {
      edges: [0, 2, 4, 6, 8, 10],
      counts: [10, 20, 40, 20, 10],
      binProbabilities: [0.1, 0.2, 0.4, 0.2, 0.1],
      overflowCounts: { underflow: 2, overflow: 3 },
      totalCount: 105,
    };
    const comparisonData = [0.08, 0.22, 0.4, 0.22, 0.08];

    try {
      await act(() => {
        root.render(
          createElement(
            "svg",
            {},
            createElement(Histogram, {
              bins,
              xProjector: xProj,
              yProjector: yProj,
              mode: "probability",
              comparisonData,
              quantityId: "hist-q",
            }),
          ),
        );
      });

      const bars = container.querySelectorAll(".histogram-bar");
      expect(bars.length).toBe(5);

      const compSeries = container.querySelector(".comparison-series");
      expect(compSeries).not.toBeNull();

      const overflow = container.querySelector(".overflow-indicators");
      expect(overflow?.textContent).toContain("← 2");
      expect(overflow?.textContent).toContain("3 →");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("IntervalShade renders shaded region and probability label", async () => {
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(
            "svg",
            {},
            createElement(IntervalShade, {
              interval: [2, 6],
              xProjector: xProj,
              yProjector: yProj,
              probability: 0.682,
              quantityId: "interval-p",
            }),
          ),
        );
      });

      const rect = container.querySelector(".interval-shade rect");
      expect(rect).not.toBeNull();

      const text = container.querySelector(".interval-shade text");
      expect(text?.textContent).toContain("68.2%");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("AnalyticLimitMarker renders point marker and arrow without infinite bar", async () => {
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(
            "svg",
            {},
            createElement(AnalyticLimitMarker, {
              point: 5,
              xProjector: xProj,
              yProjector: yProj,
              probability: 1.0,
              quantityId: "delta-dist",
            }),
          ),
        );
      });

      const marker = container.querySelector(".analytic-limit-marker");
      expect(marker?.getAttribute("data-result-status")).toBe("analytic-limit");
      expect(marker?.textContent).toContain("Point distribution at x = 5");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("ReferenceLinePlot renders slope label", async () => {
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(
            "svg",
            {},
            createElement(ReferenceLinePlot, {
              referenceLine: {
                label: "slope 1/2",
                slope: 0.5,
                intercept: 1,
                xRange: [1, 9],
                quantityId: "diff-law",
              },
              xProjector: xProj,
              yProjector: yProj,
            }),
          ),
        );
      });

      const text = container.querySelector(".reference-line text");
      expect(text?.textContent).toBe("slope 1/2");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
