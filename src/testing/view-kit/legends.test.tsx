import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  FalseColorLegend,
  isOutsideVisibleSpectrum,
  QuantityLegend,
} from "../../visuals/kit/index.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("QuantityLegend & FalseColorLegend (am-inst-2d-view-kit-u75r)", () => {
  test("QuantityLegend renders non-color symbols, units, and data-quantity-id", async () => {
    const container = createContainer();
    const root = createRoot(container);

    const entries = [
      {
        quantityId: "diff-coeff-d",
        label: "Diffusion Coefficient D",
        unit: "m²/s",
        symbolShape: "circle" as const,
        role: "premise" as const,
        roleColor: "#1d4ed8",
      },
      {
        quantityId: "mean-sq-disp",
        label: "Mean Square Displacement λ²",
        unit: "μm²",
        symbolShape: "diamond" as const,
        role: "conclusion" as const,
        isHighlighted: true,
      },
    ];

    try {
      await act(() => {
        root.render(
          createElement(QuantityLegend, {
            entries,
            title: "Observed Quantities",
            orientation: "horizontal",
          }),
        );
      });

      const legend = container.querySelector(".quantity-legend");
      expect(legend).not.toBeNull();
      expect(legend?.getAttribute("aria-label")).toBe("Observed Quantities");

      const items = container.querySelectorAll(".legend-item");
      expect(items.length).toBe(2);

      const item0 = items[0];
      expect(item0?.getAttribute("data-quantity-id")).toBe("diff-coeff-d");
      expect(item0?.getAttribute("data-role")).toBe("premise");
      expect(item0?.textContent).toContain("Diffusion Coefficient D");
      expect(item0?.textContent).toContain("[m²/s]");
      expect(item0?.querySelector(".symbol-circle")).not.toBeNull();

      const item1 = items[1];
      expect(item1?.getAttribute("data-quantity-id")).toBe("mean-sq-disp");
      expect(item1?.getAttribute("data-role")).toBe("conclusion");
      expect(item1?.className).toContain("is-highlighted");
      expect(item1?.querySelector(".symbol-diamond")).not.toBeNull();
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("isOutsideVisibleSpectrum calculates out-of-visible band accurately", () => {
    // Within standard visible range 380 - 750 nm
    expect(isOutsideVisibleSpectrum(400, 700)).toBe(false);
    expect(isOutsideVisibleSpectrum(380, 750)).toBe(false);

    // UV (ultraviolet < 380 nm)
    expect(isOutsideVisibleSpectrum(200, 500)).toBe(true);
    expect(isOutsideVisibleSpectrum(379, 700)).toBe(true);

    // IR (infrared > 750 nm)
    expect(isOutsideVisibleSpectrum(500, 900)).toBe(true);
    expect(isOutsideVisibleSpectrum(400, 751)).toBe(true);

    // Broad spectrum spanning both
    expect(isOutsideVisibleSpectrum(100, 1500)).toBe(true);
  });

  test("FalseColorLegend renders prominent notice only when spectral range extends beyond 380–750 nm", async () => {
    const container = createContainer();
    const root = createRoot(container);

    try {
      // In visible band
      await act(() => {
        root.render(
          createElement(FalseColorLegend, {
            minWavelengthNm: 400,
            maxWavelengthNm: 700,
          }),
        );
      });

      let legend = container.querySelector(".false-color-legend");
      expect(legend?.getAttribute("data-has-invisible-light")).toBe("false");
      expect(legend?.textContent).toContain("Visible Spectrum");
      expect(legend?.textContent).not.toContain("False-Color Mapping");

      // Outside visible band (UV/IR)
      await act(() => {
        root.render(
          createElement(FalseColorLegend, {
            minWavelengthNm: 200,
            maxWavelengthNm: 900,
          }),
        );
      });

      legend = container.querySelector(".false-color-legend");
      expect(legend?.getAttribute("data-has-invisible-light")).toBe("true");
      expect(legend?.textContent).toContain("False-Color Mapping");
      expect(legend?.textContent).toContain("Frequencies outside the visible band");
      expect(legend?.textContent).toContain("200–900 nm");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
