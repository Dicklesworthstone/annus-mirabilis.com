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
});
