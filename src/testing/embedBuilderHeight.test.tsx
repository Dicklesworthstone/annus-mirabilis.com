import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { EmbedBuilder } from "../components/embed/EmbedBuilder.tsx";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

/**
 * The embed builder's height field says why it is invalid, to a screen reader as well as on
 * screen. Measured on live /embed/ on 2026-09-24: typing 100 set aria-invalid and showed an alert,
 * but the field had no accessible description, so tabbing back to it announced "invalid" with no
 * reason. The field is now described by the alert while the height is out of range, and by
 * nothing once it is valid again.
 */
/**
 * Under this happy-dom harness a dispatched input event does not reach React's onChange, so this
 * calls the field's own onChange prop, the form ParameterControl.test.tsx uses. EmbedBuilder reads
 * event.currentTarget.value.
 */
function type(input: HTMLInputElement, value: string) {
  const key = Object.keys(input).find((k) => k.startsWith("__reactProps$"));
  const props = key
    ? (input as unknown as Record<string, { onChange?: (event: unknown) => void }>)[key]
    : undefined;
  expect(props?.onChange).toBeDefined();
  input.value = value;
  props?.onChange?.({ currentTarget: input, target: input });
}

describe("the embed builder's height field", () => {
  beforeEach(async () => {
    await installDom();
  });
  afterEach(async () => {
    await uninstallDom();
  });

  test("an out-of-range height is described by the alert that explains it, and a valid one is not", async () => {
    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(createElement(EmbedBuilder));
      });
      const label = [...container.querySelectorAll("label")].find(
        (l) => l.textContent === "Frame height in pixels",
      );
      const input = container.querySelector<HTMLInputElement>(
        `#${CSS.escape(label?.getAttribute("for") ?? "")}`,
      );
      expect(input).not.toBeNull();
      if (!input) return;

      await act(async () => {
        type(input, "100");
      });
      expect(input.getAttribute("aria-invalid")).toBe("true");
      const describedBy = input.getAttribute("aria-describedby");
      expect(describedBy).not.toBeNull();
      const description = container.querySelector(`#${CSS.escape(describedBy ?? "")}`);
      expect(description?.getAttribute("role")).toBe("alert");
      expect(description?.textContent).toContain("from 400 to 2000 pixels");

      await act(async () => {
        type(input, "900");
      });
      expect(input.getAttribute("aria-invalid")).toBe("false");
      expect(input.hasAttribute("aria-describedby")).toBe(false);
      expect(container.querySelector("[role=alert]")).toBeNull();
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
