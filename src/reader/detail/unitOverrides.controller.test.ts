/**
 * Per-passage Detail overrides on a reading page (am-read-detail-axis-sfc): the reader opens one
 * passage's steps against the page's level, the page's Detail control never clears that, and
 * "Apply this to the rest of the page" makes it the page's level. ReaderController drives the
 * state machine in applyElsewhere.ts; this mounts the controller on a page with two passages.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { ReaderController } from "../ReaderController.tsx";

const REGISTRY = Object.freeze({
  paperId: "mass-energy",
  anchors: Object.freeze(["arg-a", "arg-b"]),
  foundations: Object.freeze([]),
});

let reactRoot: Root | null = null;

beforeEach(async () => {
  await installDom();
  window.history.replaceState(null, "", "/papers/mass-energy/");
  try {
    localStorage.clear();
  } catch {
    /* storage may be blocked */
  }
});
afterEach(async () => {
  await act(async () => reactRoot?.unmount());
  reactRoot = null;
  await uninstallDom();
});

const passage = (id: string) => `
  <article id="${id}" data-unit="${id}" class="reader-passage">
    <h3>${id}</h3>
    <details class="local-steps reading-version" data-reading="2"><summary>Show every step here: ${id}</summary><p>Steps of ${id}.</p></details>
  </article>`;

async function mount() {
  const root = document.createElement("div");
  root.setAttribute("data-reader-root", "");
  root.innerHTML = `
    <dialog data-clarification-dialog></dialog>
    <p data-reader-announcement></p>
    ${passage("arg-a")}${passage("arg-b")}`;
  document.body.append(root);
  const container = document.createElement("div");
  root.prepend(container);
  reactRoot = createRoot(container);
  await act(async () => {
    reactRoot?.render(
      createElement(ReaderController, { registry: REGISTRY, titles: {}, questions: {} }),
    );
  });
  const steps = (id: string) =>
    root.querySelector<HTMLDetailsElement>(
      `#${id} details[data-reading="2"]`,
    ) as HTMLDetailsElement;
  return { root, steps };
}

/** The reader's own toggle: set it, and deliver the toggle event a browser fires. */
async function toggle(details: HTMLDetailsElement, open: boolean) {
  await act(async () => {
    details.open = open;
    details.dispatchEvent(new Event("toggle"));
  });
}

async function setPageDetail(root: HTMLElement, value: string) {
  const select = root.querySelector<HTMLSelectElement>("[data-detail-control]");
  expect(select).not.toBeNull();
  await act(async () => {
    if (select) {
      select.disabled = false;
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

const apply = (root: HTMLElement) => root.querySelector<HTMLButtonElement>("[data-apply-detail]");

describe("a passage opened on its own", () => {
  test("offers Apply this to the rest of the page, beside it, and only once one exists", async () => {
    const { root, steps } = await mount();
    expect(apply(root)).toBeNull();
    await toggle(steps("arg-a"), true);
    const button = apply(root);
    expect(button?.textContent).toBe("Apply this to the rest of the page");
    expect(steps("arg-a").nextElementSibling?.contains(button ?? null)).toBe(true);
  });

  test("the page's Detail control does not clear it", async () => {
    const { root, steps } = await mount();
    await toggle(steps("arg-a"), true);
    await setPageDetail(root, "2");
    expect(steps("arg-a").open && steps("arg-b").open).toBe(true);
    await setPageDetail(root, "1");
    expect(steps("arg-a").open).toBe(true);
    expect(steps("arg-b").open).toBe(false);
    expect(apply(root)).not.toBeNull();
  });

  test("Apply makes its level the page's, clears the overrides and removes itself", async () => {
    const { root, steps } = await mount();
    await toggle(steps("arg-a"), true);
    await act(async () => apply(root)?.click());
    expect(document.documentElement.dataset.detail).toBe("2");
    expect(steps("arg-a").open && steps("arg-b").open).toBe(true);
    expect(apply(root)).toBeNull();
    // Cleared, not merely hidden: going back to the full explanation closes every passage.
    await setPageDetail(root, "1");
    expect(steps("arg-a").open || steps("arg-b").open).toBe(false);
  });

  test("set back to the page's level, it is no longer an override", async () => {
    const { root, steps } = await mount();
    await toggle(steps("arg-a"), true);
    await toggle(steps("arg-a"), false);
    expect(apply(root)).toBeNull();
  });
});
