import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { DETAIL_STORAGE_KEY } from "../../reader/navigation/state.ts";
import { createContainer, installDom, uninstallDom } from "../../testing/reactDom";
import { LabDetailControl } from "./LabDetailControl.tsx";

/**
 * The Detail control on a laboratory page (am-5bff).
 *
 * The defect it closes is an inversion: with fd4ddf81's no-script rules a reader WITHOUT
 * JavaScript sees all three readings on a laboratory, and a reader with it saw one and had no
 * control, because the Detail control lived only in the paper shell. So the two cases that matter
 * here are that the control draws NOTHING when it can change nothing, and that a choice reaches
 * both places a paper page's choice reaches: the document attribute the stylesheet reads, and the
 * reader's own storage key, which is what makes the two faces agree.
 *
 * WHAT IT DOES NOT CLAIM. Not that the reading visibly changes: that is labShell.css, and it is
 * answered by labReadingsReachable.test.tsx and by a browser. Not the placement on the page.
 */
beforeEach(async () => {
  await installDom();
});
afterEach(async () => {
  await uninstallDom();
});

async function render() {
  const container = createContainer();
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(LabDetailControl));
  });
  return { container, root };
}

describe("a laboratory's Detail control", () => {
  test("draws nothing on a page with no readings", async () => {
    const { container, root } = await render();
    expect(container.querySelector("fieldset")).toBeNull();
    await act(async () => root.unmount());
  });

  test("offers the three readings and marks the one in force", async () => {
    document.documentElement.dataset.detail = "2";
    document.body.insertAdjacentHTML("afterbegin", '<p data-detail="1">A reading.</p>');
    const { container, root } = await render();
    const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.map((r) => r.value)).toEqual(["0", "1", "2"]);
    expect(radios.filter((r) => r.checked).map((r) => r.value)).toEqual(["2"]);
    // Every radio is labelled: a control named only by its position is not operable by name.
    for (const radio of radios)
      expect(
        (container.querySelector(`label[for="${radio.id}"]`)?.textContent ?? "").trim().length,
        `${radio.value} has no label`,
      ).toBeGreaterThan(3);
    await act(async () => root.unmount());
  });

  test("a choice reaches the document attribute and the reader's own key", async () => {
    document.documentElement.dataset.detail = "1";
    localStorage.removeItem(DETAIL_STORAGE_KEY);
    document.body.insertAdjacentHTML("afterbegin", '<p data-detail="1">A reading.</p>');
    const { container, root } = await render();
    const overview = container.querySelector<HTMLInputElement>('input[value="0"]');
    expect(overview).not.toBeNull();
    await act(async () => overview?.click());
    expect(document.documentElement.dataset.detail).toBe("0");
    // The same key ReaderController writes, so a paper opens at the reading chosen on an instrument.
    expect(localStorage.getItem(DETAIL_STORAGE_KEY)).toBe("0");
    await act(async () => root.unmount());
  });

  test("an unrecognised stored detail falls back to the full explanation", async () => {
    document.documentElement.dataset.detail = "9";
    document.body.insertAdjacentHTML("afterbegin", '<p data-detail="1">A reading.</p>');
    const { container, root } = await render();
    const checked = [...container.querySelectorAll<HTMLInputElement>("input")].filter(
      (r) => r.checked,
    );
    expect(checked.map((r) => r.value)).toEqual(["1"]);
    await act(async () => root.unmount());
  });
});
