/**
 * am-sr-05-moving-clocks-2zka. Renders the real MovingClocksLab component against the real
 * generated worked example (src/generated/sr05-example.json), proving the route's actual
 * reader-facing surface, not just the underlying arithmetic sr-05.test.ts already covers.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MovingClocksLab } from "../components/lab/sr05/MovingClocksLab.tsx";
import type { PreparedSr05Example } from "../experiments/sr05/session.ts";
import example from "../generated/sr05-example.json";
import { installDom, uninstallDom } from "./reactDom.ts";

beforeEach(installDom);
afterEach(uninstallDom);

describe("MovingClocksLab: the real component, the real generated example", () => {
  test("renders the out-and-back-0.6c worked example with the reunion comparison shown", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<MovingClocksLab example={example as PreparedSr05Example} />);
    });

    expect(container.querySelector('[data-testid="moving-clocks-lab"]')).not.toBeNull();
    expect(container.querySelector('[data-field="properTime"]')?.textContent).toContain("8");
    expect(container.querySelector('[data-field="coordinateTime"]')?.textContent).toContain("10");
    expect(container.querySelector('[data-field="reunionExactLag"]')?.textContent).toContain("2");
    expect(container.querySelector('[data-field="reunionPrintedLag"]')?.textContent).toContain(
      "approximation",
    );
    expect(container.querySelector('[data-field="lightProperTick"]')?.textContent).toContain("2");
    expect(container.querySelector('[data-field="lightCoordinateTick"]')?.textContent).toContain(
      "2.5",
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test("clicking a preset button applies it and updates the readings without importing physics into the component", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<MovingClocksLab example={example as PreparedSr05Example} />);
    });

    const lowSpeedButton = container.querySelector<HTMLButtonElement>(
      '[data-preset-id="sr-05-low-speed-1e-4"]',
    );
    expect(lowSpeedButton).not.toBeNull();
    await act(async () => {
      lowSpeedButton?.click();
    });

    const lossField = container.querySelector('[data-field="dilationLossExact"]');
    expect(lossField?.textContent).toContain("5.00");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test("no view renders without an example (no crash on the empty state)", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<MovingClocksLab />);
    });
    expect(container.querySelector('[data-testid="moving-clocks-lab"]')).not.toBeNull();
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
