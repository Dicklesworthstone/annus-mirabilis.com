import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  Axes2D,
  createLinearProjector,
  createLogProjector,
  generateLinearTicks,
  generateLogTicks,
  ReferenceLinePlot,
} from "../../visuals/kit/index.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("Axes2D and ReferenceLinePlot (am-inst-2d-view-kit-u75r)", () => {
  test("Axes2D enforces density-kind declaration on vertical log/spectral axes", async () => {
    const container = createContainer();
    const root = createRoot(container);
    const xProj = createLinearProjector({ domain: [0, 10], range: [50, 450] });
    const yProj = createLinearProjector({ domain: [0, 100], range: [250, 50] });
    const xTicks = generateLinearTicks(xProj, 5);
    const yTicks = generateLinearTicks(yProj, 5);

    try {
      // Per-frequency density axis
      await act(() => {
        root.render(
          createElement(
            "svg",
            { width: 500, height: 300 },
            createElement(Axes2D, {
              xStart: 50,
              xEnd: 450,
              yStart: 50,
              yEnd: 250,
              xTicks,
              yTicks,
              xLabel: "Frequency ν",
              yLabel: "Energy density ρ_ν",
              xQuantityId: "frequency",
              yQuantityId: "spectralEnergyDensity",
              xUnit: "Hz",
              yUnit: "J/(m³·Hz)",
              yDensityKind: "per-frequency",
            }),
          ),
        );
      });

      const yAxisText = container.querySelector(
        ".axis-vertical text[data-quantity-id='spectralEnergyDensity']",
      );
      expect(yAxisText).not.toBeNull();
      expect(yAxisText?.textContent).toContain("Energy density ρ_ν");
      expect(yAxisText?.textContent).toContain("(per-frequency)");
      expect(yAxisText?.textContent).toContain("[J/(m³·Hz)]");
      expect(yAxisText?.textContent).not.toContain("(per-ln-interval)");

      // Per-log-interval density axis
      await act(() => {
        root.render(
          createElement(
            "svg",
            { width: 500, height: 300 },
            createElement(Axes2D, {
              xStart: 50,
              xEnd: 450,
              yStart: 50,
              yEnd: 250,
              xTicks,
              yTicks,
              xLabel: "Log Frequency ln(ν)",
              yLabel: "Log Spectral Density",
              xQuantityId: "frequency",
              yQuantityId: "spectralEnergyDensity",
              yDensityKind: "per-ln-interval",
            }),
          ),
        );
      });

      const yAxisLogText = container.querySelector(
        ".axis-vertical text[data-quantity-id='spectralEnergyDensity']",
      );
      expect(yAxisLogText?.textContent).toContain("(per-ln-interval)");
      expect(yAxisLogText?.textContent).not.toContain("(per-frequency)");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("ReferenceLinePlot renders slope label and obeys quantity-id attributes", async () => {
    const container = createContainer();
    const root = createRoot(container);
    const xProj = createLogProjector({ domain: [1, 100], range: [50, 450] });
    const yProj = createLogProjector({ domain: [1, 10], range: [250, 50] });

    try {
      await act(() => {
        root.render(
          createElement(
            "svg",
            { width: 500, height: 300 },
            createElement(ReferenceLinePlot, {
              referenceLine: {
                label: "slope 1/2 (diffusion law)",
                slope: 0.5,
                intercept: 1.0,
                xRange: [1, 100],
                quantityId: "diffusion-exponent",
              },
              xProjector: xProj,
              yProjector: yProj,
              strokeColor: "#3b82f6",
            }),
          ),
        );
      });

      const refLine = container.querySelector(".reference-line");
      expect(refLine).not.toBeNull();
      expect(refLine?.getAttribute("data-quantity-id")).toBe("diffusion-exponent");

      const label = refLine?.querySelector("text");
      expect(label?.textContent).toBe("slope 1/2 (diffusion law)");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("generateLogTicks produces decade tick marks with power-of-ten labels", () => {
    const logProj = createLogProjector({ domain: [1e-3, 1e3], range: [0, 600] });
    const ticks = generateLogTicks(logProj);

    expect(ticks.length).toBe(7); // 10^-3, 10^-2, 10^-1, 10^0, 10^1, 10^2, 10^3
    expect(ticks[0]?.label).toBe("10^-3");
    expect(ticks[3]?.label).toBe("10^0");
    expect(ticks[6]?.label).toBe("10^3");
  });
});
