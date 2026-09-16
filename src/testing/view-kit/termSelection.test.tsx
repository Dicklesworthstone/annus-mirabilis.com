import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  Axes2D,
  createLinearProjector,
  generateLinearTicks,
  Histogram,
  LinePlot,
  ScatterPlot,
} from "../../visuals/kit/index.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("Term Selection by attribute (am-inst-2d-view-kit-u75r)", () => {
  const xProj = createLinearProjector({ domain: [0, 10], range: [0, 100] });
  const yProj = createLinearProjector({ domain: [0, 10], range: [100, 0] });
  const xTicks = generateLinearTicks(xProj, 3);
  const yTicks = generateLinearTicks(yProj, 3);

  test("all primitives attach exact canonical data-quantity-id attribute", async () => {
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(
            "svg",
            { "data-selected-quantity-id": "diffusivity" },
            createElement(Axes2D, {
              xStart: 0,
              xEnd: 100,
              yStart: 0,
              yEnd: 100,
              xTicks,
              yTicks,
              xQuantityId: "displacement",
              yQuantityId: "diffusivity",
            }),
            createElement(LinePlot, {
              data: [
                { x: 0, y: 0 },
                { x: 5, y: 5 },
              ],
              xProjector: xProj,
              yProjector: yProj,
              quantityId: "diffusivity",
            }),
            createElement(ScatterPlot, {
              data: [{ x: 2, y: 2 }],
              xProjector: xProj,
              yProjector: yProj,
              quantityId: "observedDisplacement",
            }),
            createElement(Histogram, {
              bins: {
                edges: [0, 5, 10],
                counts: [10, 20],
                binProbabilities: [0.33, 0.67],
              },
              xProjector: xProj,
              yProjector: yProj,
              quantityId: "displacementDistribution",
            }),
          ),
        );
      });

      const diffAxes = container.querySelectorAll('[data-quantity-id="diffusivity"]');
      expect(diffAxes.length).toBeGreaterThanOrEqual(1);

      const dispAxes = container.querySelectorAll('[data-quantity-id="displacement"]');
      expect(dispAxes.length).toBeGreaterThanOrEqual(1);

      const scatterObs = container.querySelectorAll('[data-quantity-id="observedDisplacement"]');
      expect(scatterObs.length).toBeGreaterThanOrEqual(1);

      const histDist = container.querySelectorAll('[data-quantity-id="displacementDistribution"]');
      expect(histDist.length).toBeGreaterThanOrEqual(1);
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
