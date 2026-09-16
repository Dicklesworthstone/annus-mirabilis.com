import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { TimeLegend } from "../../visuals/kit/TimeLegend.tsx";
import type { RepresentationScale } from "../../visuals/kit/types.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("TimeLegend (am-inst-2d-view-kit-u75r)", () => {
  test("renders elapsed time and 'true rate' badge when playbackMultiplier is 1", async () => {
    const container = createContainer();
    const root = createRoot(container);

    const scale: RepresentationScale = {
      spatialMagnification: { appliesTo: "scene", factor: 1 },
      simulatedElapsedTime: { quantityId: "time", value: 3.5, unit: "s" },
      playbackMultiplier: 1,
      glyphSize: { drawnPx: 4, represents: "none" },
      quantityNormalization: { kind: "none" },
    };

    try {
      await act(() => {
        root.render(createElement(TimeLegend, { scale }));
      });

      const element = container.querySelector(".time-legend");
      expect(element?.textContent).toContain("t = 3.50 s");
      expect(element?.textContent).toContain("true rate (1 s/s)");
      expect(element?.querySelector(".is-true-rate")).not.toBeNull();
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("renders accelerated multiplier when playbackMultiplier > 1", async () => {
    const container = createContainer();
    const root = createRoot(container);

    const scale: RepresentationScale = {
      spatialMagnification: { appliesTo: "scene", factor: 1 },
      simulatedElapsedTime: { quantityId: "time", value: 10.0, unit: "μs" },
      playbackMultiplier: 25,
      glyphSize: { drawnPx: 4, represents: "none" },
      quantityNormalization: { kind: "none" },
    };

    try {
      await act(() => {
        root.render(createElement(TimeLegend, { scale }));
      });

      const element = container.querySelector(".time-legend");
      expect(element?.textContent).toContain("t = 10.00 μs");
      expect(element?.textContent).toContain("25 times faster");
      expect(element?.querySelector(".is-scaled-rate")).not.toBeNull();
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
