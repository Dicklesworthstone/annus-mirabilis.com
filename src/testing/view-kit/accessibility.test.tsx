import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { AccessibleGraphView } from "../../visuals/kit/AccessibleGraphView.tsx";
import type { RepresentationScale } from "../../visuals/kit/types.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("AccessibleGraphView: 3 layers and scale facts (am-inst-2d-view-kit-u75r)", () => {
  const scale: RepresentationScale = {
    spatialMagnification: { appliesTo: "scene", factor: 1e8, note: "optical microscope" },
    simulatedElapsedTime: { quantityId: "t", value: 2.0, unit: "s" },
    playbackMultiplier: 1,
    glyphSize: { drawnPx: 4, represents: "none" },
    quantityNormalization: { kind: "per-bin-width", note: "per μm" },
  };

  test("renders 3 accessible layers: title/desc, live relation summary, and inspectable table", async () => {
    const container = createContainer();
    const root = createRoot(container);

    const inspectableTable = {
      caption: "Measured displacement vs time",
      headers: ["Step", "Position (μm)"],
      rows: [
        { key: 1, cells: [1, 0.45] },
        { key: 2, cells: [2, 0.92] },
      ],
    };

    try {
      await act(() => {
        root.render(
          createElement(
            AccessibleGraphView,
            {
              title: "Mean Square Displacement",
              description:
                "Comparison of experimental tracer displacements with Stokes-Einstein diffusion curve.",
              summary:
                "The variance grows strictly linearly with time, confirming molecular kinetic theory.",
              inspectableTable,
              scale,
            },
            createElement("div", { className: "mock-chart" }, "Mock SVG Chart"),
          ),
        );
      });

      // Layer 1
      const layer1 = container.querySelector(".graph-layer-1");
      expect(layer1?.textContent).toContain("Mean Square Displacement");
      expect(layer1?.textContent).toContain("Stokes-Einstein diffusion curve");

      // Layer 2
      const layer2 = container.querySelector(".graph-layer-2");
      expect(layer2?.getAttribute("aria-live")).toBeNull();
      expect(layer2?.textContent).toContain("grows strictly linearly with time");

      // Layer 3
      const table = container.querySelector(".inspectable-data-table");
      expect(table).not.toBeNull();
      expect(table?.textContent).toContain("Measured displacement vs time");

      // Scale facts table
      const scaleTable = container.querySelector(".scale-facts-table");
      expect(scaleTable).not.toBeNull();
      expect(scaleTable?.textContent).toContain("Spatial magnification");
      expect(scaleTable?.textContent).toContain("true rate");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("planted negative: AccessibleGraphView has no per-frame live region", async () => {
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(
            AccessibleGraphView,
            {
              title: "Live Walk",
              description: "Real-time particle walk.",
              summary: "Step 0.",
              animated: true,
              snapshotVersion: 0,
            },
            createElement("div", {}, "Chart"),
          ),
        );
      });

      expect(container.querySelector(".live-region")).toBeNull();
      expect(
        container.querySelector(".graph-layer-2-region")?.getAttribute("aria-live"),
      ).toBeNull();
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
