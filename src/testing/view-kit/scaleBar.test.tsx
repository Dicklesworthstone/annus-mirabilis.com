import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { ScaleBar } from "../../visuals/kit/ScaleBar.tsx";
import type { RepresentationScale } from "../../visuals/kit/types.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("ScaleBar (am-inst-2d-view-kit-u75r)", () => {
  const baseScale: RepresentationScale = {
    spatialMagnification: { appliesTo: "scene", factor: 1 },
    simulatedElapsedTime: { quantityId: "t", value: 1.0, unit: "s" },
    playbackMultiplier: 1,
    glyphSize: { drawnPx: 4, represents: "none" },
    quantityNormalization: { kind: "none" },
  };

  test("draws scale bar derived from physical length, base pixels per unit, and magnification", async () => {
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(
            "svg",
            {},
            createElement(ScaleBar, {
              scale: baseScale,
              physicalLength: 1,
              unit: "μm",
              basePixelsPerUnit: 50,
              x: 10,
              y: 20,
            }),
          ),
        );
      });

      const line = container.querySelector(".scale-bar line");
      expect(line?.getAttribute("x1")).toBe("10");
      expect(line?.getAttribute("x2")).toBe("60"); // 10 + 1 * 50 * 1 = 60

      const text = container.querySelector(".scale-bar text");
      expect(text?.textContent).toBe("1 μm");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("magnification factor scales the drawn pixel length without altering physical label", async () => {
    const container = createContainer();
    const root = createRoot(container);

    const magnifiedScale: RepresentationScale = {
      ...baseScale,
      spatialMagnification: { appliesTo: "scene", factor: 2 },
    };

    try {
      await act(() => {
        root.render(
          createElement(
            "svg",
            {},
            createElement(ScaleBar, {
              scale: magnifiedScale,
              physicalLength: 1,
              unit: "μm",
              basePixelsPerUnit: 50,
              x: 10,
              y: 20,
            }),
          ),
        );
      });

      const line = container.querySelector(".scale-bar line");
      expect(line?.getAttribute("x1")).toBe("10");
      expect(line?.getAttribute("x2")).toBe("110"); // 10 + 1 * 50 * 2 = 110

      const text = container.querySelector(".scale-bar text");
      expect(text?.textContent).toBe("1 μm");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("ScaleBar fails if rendered without RepresentationScale", () => {
    expect(() =>
      // @ts-expect-error test missing scale
      ScaleBar({ physicalLength: 1, unit: "μm", basePixelsPerUnit: 50 }),
    ).toThrow();
  });
});
