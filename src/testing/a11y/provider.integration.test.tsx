import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { AnnouncementManager } from "../../a11y/descriptions/announcementManager.ts";
import {
  GraphDescriptionContainer,
  type GraphDescriptionState,
  useGraphDescription,
} from "../../a11y/descriptions/provider.tsx";
import type { RepresentationScale } from "../../visuals/kit/types.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("GraphDescriptionContainer Integration: Three-layer accessible provider (am-a11y-graph-descriptions-vxe1)", () => {
  const scale: RepresentationScale = {
    spatialMagnification: { appliesTo: "scene", factor: 1000, note: "optical microscope" },
    simulatedElapsedTime: { quantityId: "t", value: 1.0, unit: "s" },
    playbackMultiplier: 1,
    glyphSize: { drawnPx: 4, represents: "none" },
    quantityNormalization: { kind: "per-bin-width", note: "per μm" },
  };

  const sampleTableData = {
    caption: "Measured Brownian displacement points",
    columns: [
      { id: "x", header: "Position", unit: "μm" },
      { id: "p", header: "Probability", unit: "1/μm" },
    ],
    rows: [
      { id: "r1", label: "Bin 1", values: ["-0.5", "0.24"] },
      { id: "r2", label: "Bin 2", values: ["0.0", "0.52"] },
      { id: "r3", label: "Bin 3", values: ["0.5", "0.24"] },
    ],
  };

  test("synchronizes data-snapshot-version, identity attributes, and renders 3 layers", async () => {
    const container = createContainer();
    const root = createRoot(container);
    const announcements: string[] = [];

    const customManager = new AnnouncementManager({
      onAnnounce: (msg) => announcements.push(msg),
    });

    try {
      await act(() => {
        root.render(
          createElement(
            GraphDescriptionContainer,
            {
              layer1Statement:
                "Brownian tracer position histogram comparing data to Gaussian diffusion.",
              layer2Template:
                "Tracer root-mean-square displacement is {lambda_x} at time {t}. {scaleSummary}",
              templateData: {
                quantities: { lambda_x: 0.794783, t: 1.0 },
                units: { lambda_x: "μm", t: "s" },
              },
              snapshotVersion: "snap-v4",
              runId: "run-bm01-001",
              instrumentId: "bm-01",
              viewId: "histogram",
              tableData: sampleTableData,
              scale,
              announcementManager: customManager,
            },
            createElement("div", { className: "canvas-mock" }, "Canvas mock visual"),
          ),
        );
      });

      const figure = container.querySelector("figure.accessible-graph-container");
      expect(figure).not.toBeNull();
      expect(figure?.getAttribute("data-snapshot-version")).toBe("snap-v4");
      expect(figure?.getAttribute("data-instrument-id")).toBe("bm-01");
      expect(figure?.getAttribute("data-view-id")).toBe("histogram");
      expect(figure?.getAttribute("data-run-id")).toBe("run-bm01-001");

      // Layer 1
      const layer1 = container.querySelector(".graph-layer-1");
      expect(layer1?.textContent).toContain("Brownian tracer position histogram");

      // Layer 2
      const layer2 = container.querySelector(".graph-layer-2-region");
      expect(layer2?.getAttribute("role")).toBe("status");
      expect(layer2?.getAttribute("aria-live")).toBe("polite");
      expect(layer2?.textContent).toContain("0.794783 μm");
      expect(layer2?.textContent).toContain("Scene magnified ×1,000");

      // Child visual
      const visualContainer = container.querySelector(".graph-visual-canvas-container");
      expect(visualContainer?.textContent).toContain("Canvas mock visual");

      // Action buttons
      const describeNowBtn = container.querySelector(
        "button.describe-now-btn",
      ) as HTMLButtonElement;
      expect(describeNowBtn).not.toBeNull();

      // Trigger "Describe now"
      await act(() => {
        describeNowBtn.click();
      });

      expect(announcements.length).toBeGreaterThan(0);
      expect(announcements[announcements.length - 1]).toContain("0.794783 μm");
    } finally {
      customManager.dispose();
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("toggles data table visibility and supports animation pause/resume", async () => {
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(
            GraphDescriptionContainer,
            {
              layer1Statement: "Animated particle walk in 2D.",
              layer2Template: "Particles diffuse with coefficient {D}.",
              templateData: {
                quantities: { D: 5.22e-13 },
                units: { D: "m^2/s" },
              },
              snapshotVersion: 10,
              animated: true,
              tableData: sampleTableData,
            },
            createElement("svg", {}, "SVG content"),
          ),
        );
      });

      const pauseBtn = container.querySelector("button.pause-btn") as HTMLButtonElement;
      expect(pauseBtn).not.toBeNull();
      expect(pauseBtn.textContent).toBe("Pause");

      // Pause the animation
      await act(() => {
        pauseBtn.click();
      });
      expect(pauseBtn.textContent).toBe("Resume");

      // Toggle data table
      const toggleTableBtn = container.querySelector(
        "button.toggle-table-btn",
      ) as HTMLButtonElement;
      expect(toggleTableBtn).not.toBeNull();
      expect(toggleTableBtn.getAttribute("aria-expanded")).toBe("false");
      expect(container.querySelector(".inspectable-table")).toBeNull();

      // Click to show table
      await act(() => {
        toggleTableBtn.click();
      });
      expect(toggleTableBtn.getAttribute("aria-expanded")).toBe("true");
      expect(container.querySelector(".inspectable-table")).not.toBeNull();

      // Click to hide table
      await act(() => {
        toggleTableBtn.click();
      });
      expect(toggleTableBtn.getAttribute("aria-expanded")).toBe("false");
      expect(container.querySelector(".inspectable-table")).toBeNull();
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("useGraphDescription hook exposes state and controls to child components", async () => {
    const container = createContainer();
    const root = createRoot(container);

    let observedState: GraphDescriptionState | null = null;

    function TestChild() {
      const state = useGraphDescription();
      observedState = state;
      return createElement("div", { id: "test-child" }, `Version: ${state.snapshotVersion}`);
    }

    try {
      await act(() => {
        root.render(
          createElement(
            GraphDescriptionContainer,
            {
              layer1Statement: "Child hook consumer test.",
              layer2Template: "Status: {status}",
              templateData: {},
              snapshotVersion: "v123",
            },
            createElement(TestChild),
          ),
        );
      });

      const state = observedState as GraphDescriptionState | null;
      expect(state).not.toBeNull();
      if (state) {
        expect(state.snapshotVersion).toBe("v123");
        expect(state.layer1Statement).toBe("Child hook consumer test.");
        expect(typeof state.describeNow).toBe("function");
      }
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("useGraphDescription throws an error when used outside GraphDescriptionContainer", async () => {
    const container = createContainer();
    const root = createRoot(container);

    function OrphanComponent() {
      useGraphDescription();
      return null;
    }

    let error: Error | null = null;
    try {
      await act(async () => {
        try {
          root.render(createElement(OrphanComponent));
        } catch (err: unknown) {
          error = err as Error;
        }
      });
    } catch (err: unknown) {
      error = err as Error;
    } finally {
      removeContainer(container);
    }

    expect(error?.message).toContain(
      "useGraphDescription must be used within a GraphDescriptionContainer",
    );
  });
});
