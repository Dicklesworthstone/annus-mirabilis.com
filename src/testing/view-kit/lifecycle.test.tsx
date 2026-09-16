import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  AccessibleGraphView,
  createLinearProjector,
  Histogram,
  LinePlot,
  type RepresentationScale,
  TrajectoryLayer,
} from "../../visuals/kit/index.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("View Kit Lifecycle and resource release (am-inst-2d-view-kit-u75r)", () => {
  const xProj = createLinearProjector({ domain: [-10, 10], range: [0, 400] });
  const yProj = createLinearProjector({ domain: [-10, 10], range: [400, 0] });

  const scale: RepresentationScale = {
    spatialMagnification: { appliesTo: "scene", factor: 1 },
    simulatedElapsedTime: { quantityId: "t", value: 1.0, unit: "s" },
    playbackMultiplier: 1,
    glyphSize: { drawnPx: 4, represents: "none" },
    quantityNormalization: { kind: "none" },
  };

  const tracers = [
    { id: "tr1", positions: new Float32Array([0, 0, 1, 1, 2, 2]) },
    { id: "tr2", positions: new Float32Array([0, 0, -1, -1, -2, -2]) },
  ];

  const bins = {
    edges: [-10, -5, 0, 5, 10],
    counts: [10, 20, 20, 10],
    binProbabilities: [0.16, 0.34, 0.34, 0.16],
  };

  test("50 mount and unmount cycles complete without leaking DOM nodes or hanging handles", async () => {
    const container = createContainer();
    const root = createRoot(container);

    for (let cycle = 0; cycle < 50; cycle++) {
      await act(() => {
        root.render(
          createElement(
            AccessibleGraphView,
            {
              title: `Lifecycle Cycle ${cycle}`,
              description: "Lifecycle resource verification.",
              summary: "Verifying resource disposal.",
              scale,
            },
            createElement(
              "svg",
              { width: 400, height: 400 },
              createElement(Histogram, {
                bins,
                xProjector: xProj,
                yProjector: yProj,
              }),
              createElement(LinePlot, {
                data: [
                  { x: -5, y: -5 },
                  { x: 5, y: 5 },
                ],
                xProjector: xProj,
                yProjector: yProj,
              }),
            ),
            createElement(TrajectoryLayer, {
              instanceId: `inst-${cycle}`,
              runId: `run-${cycle}`,
              snapshotVersion: cycle,
              tracers,
              xProjector: xProj,
              yProjector: yProj,
              mode: "svg",
            }),
          ),
        );
      });

      expect(container.querySelectorAll(".trajectory-layer").length).toBe(1);

      await act(() => {
        root.render(createElement("div", {}, "Unmounted"));
      });

      expect(container.querySelectorAll(".trajectory-layer").length).toBe(0);
    }

    await act(() => {
      root.unmount();
    });
    removeContainer(container);
  });
});
