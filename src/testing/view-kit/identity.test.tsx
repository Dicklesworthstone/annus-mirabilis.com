import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { createLinearProjector } from "../../visuals/kit/coordinates.ts";
import { viewIdentityAttributes } from "../../visuals/kit/identity.ts";
import { TrajectoryLayer } from "../../visuals/kit/TrajectoryLayer.tsx";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("visual kit identity attributes (am-inst-2d-view-kit-u75r)", () => {
  test("viewIdentityAttributes formats data attributes correctly", () => {
    const attrs = viewIdentityAttributes({
      instanceId: "BM01:1",
      runId: "run-001",
      snapshotVersion: 3,
    });

    expect(attrs).toEqual({
      "data-instance-id": "BM01:1",
      "data-run-id": "run-001",
      "data-snapshot-version": "3",
    });
    expect(Object.keys(attrs)).not.toContain("data-accepted-snapshot-version");
  });

  test("primitives render data-instance-id, data-run-id, and data-snapshot-version on DOM elements", async () => {
    const container = createContainer();
    const root = createRoot(container);
    const xProj = createLinearProjector({ domain: [0, 10], range: [0, 100] });
    const yProj = createLinearProjector({ domain: [0, 10], range: [0, 100] });

    try {
      await act(() => {
        root.render(
          createElement(TrajectoryLayer, {
            instanceId: "BM01:1",
            runId: "run-001",
            snapshotVersion: "2",
            tracers: [],
            xProjector: xProj,
            yProjector: yProj,
          }),
        );
      });

      const element = container.querySelector(".trajectory-layer");
      expect(element?.getAttribute("data-instance-id")).toBe("BM01:1");
      expect(element?.getAttribute("data-run-id")).toBe("run-001");
      expect(element?.getAttribute("data-snapshot-version")).toBe("2");
      expect(element?.getAttribute("data-accepted-snapshot-version")).toBeNull();
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("optionalIdentityAttributes parses provided fields and ignores missing ones", () => {
    const { optionalIdentityAttributes } = require("../../visuals/kit/identity.ts");
    expect(optionalIdentityAttributes(undefined)).toEqual({});
    expect(optionalIdentityAttributes({})).toEqual({});
    expect(
      optionalIdentityAttributes({
        instanceId: "inst-1",
        runId: "run-1",
        snapshotVersion: 4,
      }),
    ).toEqual({
      "data-instance-id": "inst-1",
      "data-run-id": "run-1",
      "data-snapshot-version": "4",
    });
    expect(
      optionalIdentityAttributes({
        instanceId: "inst-2",
      }),
    ).toEqual({
      "data-instance-id": "inst-2",
    });
  });

  test("all primitives expose identity attributes when provided with identity props", async () => {
    const {
      AccessibleGraphView,
      Axes2D,
      Histogram,
      LinePlot,
      ScatterPlot,
      IntervalShade,
      AnalyticLimitMarker,
      EventDiagram,
      EnergyLedgerPlot,
    } = require("../../visuals/kit/index.ts");

    const container = createContainer();
    const root = createRoot(container);
    const xProj = createLinearProjector({ domain: [0, 10], range: [0, 100] });
    const yProj = createLinearProjector({ domain: [0, 10], range: [100, 0] });

    const identity = {
      instanceId: "TEST-INST:1",
      runId: "run-test-42",
      snapshotVersion: "5",
    };

    try {
      await act(() => {
        root.render(
          createElement(
            AccessibleGraphView,
            {
              title: "Accessible Identity Test",
              ...identity,
            },
            createElement(
              "svg",
              { width: 300, height: 300 },
              createElement(Axes2D, {
                xStart: 0,
                xEnd: 100,
                yStart: 0,
                yEnd: 100,
                xTicks: [],
                yTicks: [],
                ...identity,
              }),
              createElement(Histogram, {
                bins: { edges: [0, 5, 10], counts: [1, 2], binProbabilities: [0.33, 0.67] },
                xProjector: xProj,
                yProjector: yProj,
                ...identity,
              }),
              createElement(LinePlot, {
                data: [
                  { x: 1, y: 1 },
                  { x: 2, y: 2 },
                ],
                xProjector: xProj,
                yProjector: yProj,
                ...identity,
              }),
              createElement(ScatterPlot, {
                data: [{ x: 1, y: 1 }],
                xProjector: xProj,
                yProjector: yProj,
                ...identity,
              }),
              createElement(IntervalShade, {
                interval: [1, 4] as const,
                xProjector: xProj,
                yProjector: yProj,
                ...identity,
              }),
              createElement(AnalyticLimitMarker, {
                point: 3,
                xProjector: xProj,
                yProjector: yProj,
                ...identity,
              }),
            ),
            createElement(EventDiagram, {
              xProjector: xProj,
              ctProjector: yProj,
              ...identity,
            }),
            createElement(EnergyLedgerPlot, {
              channels: [{ id: "c1", label: "Channel 1", value: 5 }],
              yProjector: yProj,
              ...identity,
            }),
          ),
        );
      });

      const checkAttrs = (selector: string) => {
        const el = container.querySelector(selector);
        expect(el).not.toBeNull();
        expect(el?.getAttribute("data-instance-id")).toBe("TEST-INST:1");
        expect(el?.getAttribute("data-run-id")).toBe("run-test-42");
        expect(el?.getAttribute("data-snapshot-version")).toBe("5");
      };

      checkAttrs("figure.accessible-graph-view");
      checkAttrs(".axes-2d");
      checkAttrs(".histogram");
      checkAttrs(".line-plot");
      checkAttrs(".scatter-plot");
      checkAttrs(".interval-shade");
      checkAttrs(".analytic-limit-marker");
      checkAttrs("svg.event-diagram");
      checkAttrs(".energy-ledger-plot");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
