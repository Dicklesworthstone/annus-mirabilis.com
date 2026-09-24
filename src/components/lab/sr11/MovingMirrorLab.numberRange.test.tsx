import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_PREPARED_EXAMPLE } from "../../../experiments/sr11/session.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../../testing/reactDom.ts";
import { MovingMirrorLab } from "./MovingMirrorLab.tsx";

/**
 * An energy density of 10^300 is accepted, and the outputs it carries past the largest double are
 * refused one by one in words. Before 3fa0354f the store refused the whole publication, the
 * session threw, and on live the lab sat on "A new calculation is in progress" with
 * data-pending="true" and an uncaught page error.
 */
describe("SR-11 past the number range", () => {
  beforeEach(async () => {
    await installDom();
  });
  afterEach(async () => {
    await uninstallDom();
  });

  test("u = 1e300 is accepted, the overflowing outputs say so, and nothing reads NaN, Infinity or e+", async () => {
    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(createElement(MovingMirrorLab, { example: DEFAULT_PREPARED_EXAMPLE }));
      });
      const lab = container.querySelector("[data-instrument-id]");
      const before = Number(lab?.getAttribute("data-accepted-input-revision"));
      const input = [...container.querySelectorAll<HTMLInputElement>("input[type=text]")].find(
        (i) => i.labels?.[0]?.textContent?.includes("Incident energy density"),
      );
      expect(input).toBeDefined();
      if (!input) return;
      // Under this happy-dom harness a dispatched event does not reach React, so the field's own
      // blur handler, which commits its value, is called.
      const key = Object.keys(input).find((k) => k.startsWith("__reactProps$")) ?? "";
      const onBlur = (input as unknown as Record<string, { onBlur?: (e: unknown) => void }>)[key]
        ?.onBlur;
      expect(onBlur).toBeDefined();
      await act(async () => {
        input.value = "1e300";
        onBlur?.({ target: input, currentTarget: input });
      });

      expect(lab?.getAttribute("data-pending")).toBe("false");
      expect(Number(lab?.getAttribute("data-accepted-input-revision"))).toBeGreaterThan(before);
      const text = container.textContent ?? "";
      expect(text).toContain("runs past the largest number it can represent");
      expect(text).not.toMatch(/NaN|Infinity|\d(?:\.\d+)?e[+-]\d/);
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
