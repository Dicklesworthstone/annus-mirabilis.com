/**
 * When the notebook mounts (mountTiming.ts). On a reading page nothing of the notebook loads until
 * the reader interacts, or five seconds pass; the home page, /papers/, /notebook/ and any page
 * with an "Open your notebook" control mount at once. What it does once mounted is pinned in
 * mountReaderNotebook.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { MOUNT_FALLBACK_MS, mountsAtOnce } from "./mountTiming.ts";
import { NotebookLauncher } from "./NotebookLauncher.tsx";

const PASSAGE =
  '<article id="arg-lq-independent-configurations" data-unit="arg-lq-independent-configurations" class="reader-passage"><h3>A passage</h3><p class="passage-question">Why count arrangements?</p></article>';

let root: Root | null = null;

async function launch(path: string, main: string) {
  history.replaceState(null, "", path);
  document.body.innerHTML = `<header id="chrome"></header><main id="main"><div data-reader-root data-view="reading">${main}</div></main>`;
  const chrome = document.getElementById("chrome") as HTMLElement;
  root = createRoot(chrome);
  await act(async () => {
    root?.render(createElement(NotebookLauncher));
  });
}

/** The notebook's status line is the first thing a mount adds (browser.ts). */
const mounted = () => document.querySelector(".notebook-announcement") !== null;

async function within(ms: number, check: () => boolean): Promise<boolean> {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 20));
  return check();
}

beforeEach(installDom);
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  await uninstallDom();
});

describe("which pages mount at once", () => {
  test("the recap pages, the notebook page and a page with an Open-your-notebook control", () => {
    for (const path of ["/", "/papers/", "/papers"])
      expect(mountsAtOnce(document, path)).toBe(true);
    expect(mountsAtOnce(document, "/papers/light-quanta/s5/")).toBe(false);
    document.body.innerHTML = "<main><div data-notebook-inline></div></main>";
    expect(mountsAtOnce(document, "/notebook/")).toBe(true);
    document.body.innerHTML = '<main><a href="/notebook/" data-open-notebook>Open</a></main>';
    expect(mountsAtOnce(document, "/lab/bm-01/")).toBe(true);
  });
});

describe("on a reading page", () => {
  test("nothing mounts before the reader interacts, and the first interaction mounts it", async () => {
    await launch("/papers/light-quanta/s5/", PASSAGE);
    expect(await within(400, mounted)).toBe(false);
    expect(document.querySelector(".notebook-save-toggle")).toBeNull();
    document
      .querySelector("article")
      ?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(await within(4000, mounted)).toBe(true);
    expect(document.querySelectorAll(".notebook-save-toggle").length).toBe(1);
  }, 20_000);

  test("a reader who never interacts gets the notebook after five seconds", async () => {
    await launch("/papers/light-quanta/s5/", PASSAGE);
    expect(await within(MOUNT_FALLBACK_MS - 1000, mounted)).toBe(false);
    expect(await within(4000, mounted)).toBe(true);
  }, 20_000);
});

describe("pages that mount at once", () => {
  test("/papers/ mounts without an interaction", async () => {
    await launch("/papers/", "<p>The papers.</p>");
    expect(await within(4000, mounted)).toBe(true);
  }, 20_000);

  test("a disabled Open-your-notebook control is enabled without an interaction", async () => {
    await launch("/notebook/", '<button type="button" data-open-notebook disabled>Open</button>');
    expect(await within(4000, mounted)).toBe(true);
    expect(document.querySelector<HTMLButtonElement>("[data-open-notebook]")?.disabled).toBe(false);
  }, 20_000);
});
