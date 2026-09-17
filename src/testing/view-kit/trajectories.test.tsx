import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { createLinearProjector } from "../../visuals/kit/coordinates.ts";
import { TrajectoryLayer } from "../../visuals/kit/TrajectoryLayer.tsx";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("TrajectoryLayer (am-inst-2d-view-kit-u75r)", () => {
  const xProj = createLinearProjector({ domain: [-10, 10], range: [0, 400] });
  const yProj = createLinearProjector({ domain: [-10, 10], range: [400, 0] });

  test("draws from typed Float32Array buffers and counts viewport exits without altering ensemble", async () => {
    const container = createContainer();
    const root = createRoot(container);

    // 4 tracers: 2 inside viewport (final position in [-10, 10]), 2 exited outside
    const tracers = [
      { id: "tr1", positions: new Float32Array([0, 0, 2, 2, 4, 4]) }, // inside
      { id: "tr2", positions: new Float32Array([0, 0, -3, -3, -5, -5]) }, // inside
      { id: "tr3", positions: new Float32Array([0, 0, 8, 8, 15, 15]) }, // outside
      { id: "tr4", positions: new Float32Array([0, 0, -8, -8, -12, -12]) }, // outside
    ];

    try {
      await act(() => {
        root.render(
          createElement(TrajectoryLayer, {
            instanceId: "BM01:1",
            runId: "run-001",
            snapshotVersion: 1,
            tracers,
            xProjector: xProj,
            yProjector: yProj,
            totalEnsembleCount: 4,
            mode: "svg",
          }),
        );
      });

      const layer = container.querySelector(".trajectory-layer");
      expect(layer?.getAttribute("data-drawn-count")).toBe("2");
      expect(layer?.getAttribute("data-offscreen-count")).toBe("2");
      expect(layer?.getAttribute("data-ensemble-count")).toBe("4");

      const censusText = container.querySelector(".trajectory-census")?.textContent;
      expect(censusText).toContain("2 in viewport");
      expect(censusText).toContain("2 offscreen");
      expect(censusText).toContain("4 total particles");

      // Polyline rendering convention notice
      const note = container.querySelector(".rendering-convention-note");
      expect(note?.textContent).toContain("rendering convention");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("supports rendering up to 10,000 tracers efficiently", async () => {
    const container = createContainer();
    const root = createRoot(container);

    const count = 10_000;
    const tracers = Array.from({ length: count }, (_, i) => ({
      id: i,
      positions: new Float32Array([0, 0, 1, 1]),
    }));

    try {
      const startTime = performance.now();
      await act(() => {
        root.render(
          createElement(TrajectoryLayer, {
            instanceId: "BM01:1",
            runId: "run-001",
            snapshotVersion: 1,
            tracers,
            xProjector: xProj,
            yProjector: yProj,
            totalEnsembleCount: count,
            mode: "svg",
          }),
        );
      });
      const layer = container.querySelector(".trajectory-layer");
      const duration = performance.now() - startTime;
      expect(layer?.getAttribute("data-ensemble-count")).toBe("10000");
      expect(duration).toBeLessThan(5000); // Renders cleanly within 5 seconds under parallel test load
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
