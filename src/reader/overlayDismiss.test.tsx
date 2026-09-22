/**
 * The owner's rule for every overlay on the paper pages: "any modal should be able to be closed by
 * clicking/tapping anywhere outside of it, and should always have an X button in the upper right
 * corner". The narrow-tier companion sheet and the term popover had no X of the shared kind and
 * no way to close by tapping elsewhere.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { TermAnnotation } from "./faces/TermAnnotation.tsx";
import { BottomSheet } from "./layout/BottomSheet.tsx";

beforeEach(installDom);
afterEach(uninstallDom);

async function mount(node: React.ReactNode): Promise<{ container: HTMLElement; root: Root }> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  return { container, root };
}
/** A primary-pointer tap: down, up, click, on the element given. */
async function tap(target: Element) {
  const at = { bubbles: true, clientX: 1, clientY: 1, button: 0, isPrimary: true, pointerId: 1 };
  await act(async () => {
    target.dispatchEvent(new window.PointerEvent("pointerdown", at));
    target.dispatchEvent(new window.PointerEvent("pointerup", at));
    target.dispatchEvent(new window.MouseEvent("click", at));
  });
}

describe("the companion sheet on a phone", () => {
  test("has the shared X, and it closes the sheet", async () => {
    const { container, root } = await mount(
      <BottomSheet title="Notes and laboratory">
        <p>Inside the sheet.</p>
      </BottomSheet>,
    );
    const sheet = container.querySelector("details") as HTMLDetailsElement;
    sheet.open = true;
    const x = sheet.querySelector<HTMLButtonElement>("button.modal-close");
    expect(x?.getAttribute("aria-label")).toBe("Close notes and laboratory");
    await act(async () => x?.click());
    expect(sheet.open).toBe(false);
    act(() => root.unmount());
  });

  test("a tap outside closes it, and a tap inside does not", async () => {
    const outside = document.createElement("p");
    document.body.append(outside);
    const { container, root } = await mount(
      <BottomSheet title="Notes and laboratory">
        <p data-inside>Inside the sheet.</p>
      </BottomSheet>,
    );
    const sheet = container.querySelector("details") as HTMLDetailsElement;
    sheet.open = true;
    await tap(sheet.querySelector("[data-inside]") as Element);
    expect(sheet.open).toBe(true);
    await tap(outside);
    expect(sheet.open).toBe(false);
    act(() => root.unmount());
  });
});

describe("the term popover", () => {
  test("opens from its term, has the shared X, and the X closes it", async () => {
    const { container, root } = await mount(
      <TermAnnotation
        termId="lichtaether"
        text="Lichtäther"
        definition="The luminiferous ether."
      />,
    );
    await act(async () => container.querySelector<HTMLButtonElement>(".term-annotation")?.click());
    const x = container.querySelector<HTMLButtonElement>("button.modal-close[data-term-close]");
    expect(x?.getAttribute("aria-label")).toBe("Close term definition");
    await act(async () => x?.click());
    expect(container.querySelector("[data-term-popover]")).toBeNull();
    act(() => root.unmount());
  });

  test("a tap elsewhere on the page closes it", async () => {
    const outside = document.createElement("p");
    document.body.append(outside);
    const { container, root } = await mount(
      <TermAnnotation
        termId="lichtaether"
        text="Lichtäther"
        definition="The luminiferous ether."
      />,
    );
    await act(async () => container.querySelector<HTMLButtonElement>(".term-annotation")?.click());
    expect(container.querySelector("[data-term-popover]")).not.toBeNull();
    await tap(outside);
    expect(container.querySelector("[data-term-popover]")).toBeNull();
    act(() => root.unmount());
  });
});
