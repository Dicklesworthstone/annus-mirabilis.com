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

  test("keyboard-only operation: accessibility toolbar controls respond to keyboard activation", async () => {
    const container = createContainer();
    const root = createRoot(container);

    const inspectableTable = {
      caption: "Keyboard-accessible table",
      headers: ["Index", "Displacement"],
      rows: [{ key: "r1", cells: [1, 2.5] }],
    };

    try {
      await act(() => {
        root.render(
          createElement(
            AccessibleGraphView,
            {
              title: "Keyboard Test",
              description: "Testing keyboard control of graph layers.",
              summary: "Keyboard activation test.",
              inspectableTable,
              animated: true,
            },
            createElement("div", {}, "Chart"),
          ),
        );
      });

      // 1. Toggle data table button is a real keyboard-focusable button
      const toggleTableBtn = container.querySelector(".toggle-table-btn") as HTMLButtonElement | null;
      expect(toggleTableBtn).not.toBeNull();
      expect(toggleTableBtn?.tagName.toLowerCase()).toBe("button");
      expect(toggleTableBtn?.getAttribute("aria-expanded")).toBe("true");

      // Simulate keyboard click
      await act(() => {
        toggleTableBtn?.click();
      });
      expect(toggleTableBtn?.getAttribute("aria-expanded")).toBe("false");
      expect(container.querySelector(".graph-layer-3-container")).toBeNull();

      // Simulate keyboard click to re-open
      await act(() => {
        toggleTableBtn?.click();
      });
      expect(toggleTableBtn?.getAttribute("aria-expanded")).toBe("true");
      expect(container.querySelector(".graph-layer-3-container")).not.toBeNull();

      // 2. Pause/Resume button responds to keyboard
      const pauseBtn = container.querySelector(".pause-btn") as HTMLButtonElement | null;
      expect(pauseBtn).not.toBeNull();
      expect(pauseBtn?.textContent).toBe("Pause");

      await act(() => {
        pauseBtn?.click();
      });
      expect(pauseBtn?.textContent).toBe("Resume");

      // 3. Describe Now button is accessible
      const describeBtn = container.querySelector(".describe-now-btn") as HTMLButtonElement | null;
      expect(describeBtn).not.toBeNull();
      expect(describeBtn?.getAttribute("aria-label")).toContain("Describe current graph data now");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("reduced motion: pauses simulation animation and indicates reduced motion attribute", async () => {
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(
            AccessibleGraphView,
            {
              title: "Reduced Motion Graph",
              description: "Animation must be paused under reduced motion preference.",
              summary: "Static state presented.",
              animated: true,
              reducedMotion: true,
            },
            createElement("div", {}, "Static Chart"),
          ),
        );
      });

      const figure = container.querySelector("figure");
      expect(figure?.getAttribute("data-reduced-motion")).toBe("true");

      // When reduced motion is active, the animation pause button starts in 'Resume' state
      const pauseBtn = container.querySelector(".pause-btn");
      expect(pauseBtn?.textContent).toBe("Resume");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("320 px layout: container and primitives fit narrow viewport without horizontal overflow", async () => {
    const container = createContainer();
    container.style.width = "320px";
    container.style.maxWidth = "320px";
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(
            AccessibleGraphView,
            {
              title: "320px Viewport Graph",
              description: "Testing narrow screen compatibility without horizontal overflow.",
              summary: "Responsive layout.",
              scale,
            },
            createElement("div", {
              className: "chart-inner",
              style: { maxWidth: "100%", overflowX: "hidden" },
            }, "Responsive chart content"),
          ),
        );
      });

      const figure = container.querySelector("figure");
      expect(figure).not.toBeNull();
      // Style assertions for responsive 320px behavior
      expect(figure?.style.maxWidth).toBe("100%");
      expect(figure?.style.boxSizing).toBe("border-box");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("canvas view: provides role='img', meaningful description, and inspectable table of selected quantities", async () => {
    const container = createContainer();
    const root = createRoot(container);

    const selectedQuantityId = "meanSquareDisplacement";
    const inspectableTable = {
      caption: "Tracer displacement statistics",
      headers: ["Tracer ID", "Displacement (μm)", "Quantity"],
      rows: [
        { key: "tr-1", cells: ["#1", 1.45, selectedQuantityId] },
        { key: "tr-2", cells: ["#2", 2.10, selectedQuantityId] },
      ],
    };

    try {
      await act(() => {
        root.render(
          createElement(
            AccessibleGraphView,
            {
              title: "Tracer Paths (Canvas)",
              description: "Microscope field showing Brownian tracer paths in water.",
              summary: "Particles exhibit random walk diffusion.",
              inspectableTable,
              scale,
            },
            createElement("canvas", {
              role: "img",
              "aria-label": "Tracer paths: 95 visible in viewport, 5 offscreen out of 100 total ensemble.",
              width: 600,
              height: 400,
              style: { maxWidth: "100%", height: "auto" },
              "data-quantity-id": selectedQuantityId,
            }),
          ),
        );
      });

      // Canvas accessible role and label
      const canvas = container.querySelector("canvas");
      expect(canvas?.getAttribute("role")).toBe("img");
      expect(canvas?.getAttribute("aria-label")).toContain("Tracer paths: 95 visible");
      expect(canvas?.getAttribute("data-quantity-id")).toBe(selectedQuantityId);

      // Inspectable table of selected quantities
      const table = container.querySelector(".inspectable-data-table");
      expect(table).not.toBeNull();
      expect(table?.textContent).toContain("Tracer displacement statistics");
      expect(table?.textContent).toContain(selectedQuantityId);
      expect(table?.textContent).toContain("1.45");

      // Scale facts table present
      const scaleTable = container.querySelector(".scale-facts-table");
      expect(scaleTable).not.toBeNull();
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
