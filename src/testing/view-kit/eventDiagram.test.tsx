import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  createLinearProjector,
  EventDiagram,
  type SpacetimeEvent,
  type Worldline,
} from "../../visuals/kit/index.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("EventDiagram: Minkowski 1908 spacetime diagram (am-inst-2d-view-kit-u75r)", () => {
  const xProj = createLinearProjector({ domain: [-10, 10], range: [0, 400] });
  const ctProj = createLinearProjector({ domain: [-10, 10], range: [400, 0] }); // ct increases upwards

  test("EventDiagram renders lightcones at 45 degrees, worldlines, and Minkowski 1908 label", async () => {
    const container = createContainer();
    const root = createRoot(container);

    const worldlines: readonly Worldline[] = [
      {
        id: "particle-1",
        label: "Stationary emitter",
        points: [
          [0, -5],
          [0, 5],
        ],
        color: "#2563eb",
      },
      {
        id: "photon-1",
        label: "Right-traveling light pulse (c = 1)",
        points: [
          [0, 0],
          [5, 5],
        ],
        isLightlike: true,
        color: "#f59e0b",
      },
    ];

    const events: readonly SpacetimeEvent[] = [
      {
        id: "ev-emission",
        x: 0,
        ct: 0,
        label: "Emission E0",
        color: "#10b981",
      },
      {
        id: "ev-reception",
        x: 5,
        ct: 5,
        label: "Reception E1",
        color: "#ef4444",
      },
    ];

    try {
      await act(() => {
        root.render(
          createElement(EventDiagram, {
            xProjector: xProj,
            ctProjector: ctProj,
            worldlines,
            events,
            showLightcones: true,
            lightconeOrigin: [0, 0],
            width: 400,
            height: 400,
          }),
        );
      });

      const svg = container.querySelector("svg.event-diagram");
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("data-minkowski-convention")).toBe("1908");
      expect(svg?.getAttribute("data-historical-attribution")).toBe("H. Minkowski (1908)");

      // Check lightcone elements
      const lightcones = container.querySelector(".lightcones");
      expect(lightcones).not.toBeNull();
      const polygons = container.querySelectorAll(".lightcones polygon");
      expect(polygons.length).toBe(2); // future and past lightcones

      // Check worldlines
      const wlElements = container.querySelectorAll(".worldline");
      expect(wlElements.length).toBe(2);

      const lightlikePolyline = container.querySelector(
        ".worldline polyline[stroke-dasharray='4 4']",
      );
      expect(lightlikePolyline).not.toBeNull();

      // Check events
      const eventElements = container.querySelectorAll(".spacetime-event");
      expect(eventElements.length).toBe(2);
      expect(container.textContent).toContain("Emission E0");
      expect(container.textContent).toContain("Reception E1");

      // Check Minkowski 1908 attribution element
      const minkowskiLabel = container.querySelector('[data-testid="minkowski-label"]');
      expect(minkowskiLabel).not.toBeNull();
      expect(minkowskiLabel?.textContent).toBe("H. Minkowski (1908)");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("EventDiagram supports custom attribution label and disabling lightcones", async () => {
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(EventDiagram, {
            xProjector: xProj,
            ctProjector: ctProj,
            showLightcones: false,
            attributionLabel: "Spacetime geometry (Minkowski, 1908)",
          }),
        );
      });

      const lightcones = container.querySelector(".lightcones");
      expect(lightcones).toBeNull();

      const minkowskiLabel = container.querySelector('[data-testid="minkowski-label"]');
      expect(minkowskiLabel?.textContent).toBe("Spacetime geometry (Minkowski, 1908)");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
