import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { createContainer, installDom, removeContainer, uninstallDom } from "../testing/reactDom.ts";
import { SearchPageField } from "./SearchPageField.tsx";

/**
 * The /search/ page's field. Two properties: a reader without JavaScript never meets it, because
 * it could do nothing for them; and pressing it opens the one palette, once.
 */
describe("SearchPageField", () => {
  beforeEach(async () => {
    await installDom();
  });
  afterEach(async () => {
    for (const dialog of document.querySelectorAll("dialog")) dialog.remove();
    await uninstallDom();
  });

  test("the server HTML hides it, so a reader without JavaScript never meets a dead control", () => {
    const html = renderToString(createElement(SearchPageField));
    const host = document.createElement("div");
    host.innerHTML = html;
    const wrap = host.querySelector(".search-page-field-wrap");
    expect(wrap).not.toBeNull();
    expect(wrap?.hasAttribute("hidden")).toBe(true);
  });

  test("once hydrated it is shown, named for what it opens, and opens one palette per press", async () => {
    const container = createContainer();
    container.innerHTML = renderToString(createElement(SearchPageField));
    let root: ReturnType<typeof hydrateRoot> | undefined;
    // The palette fetches its index as it opens. There is no server here, so the fetch answers
    // 404 at once rather than dialling port 80 and printing a connection error into a green run.
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    try {
      await act(async () => {
        root = hydrateRoot(container, createElement(SearchPageField));
      });
      const wrap = container.querySelector(".search-page-field-wrap");
      expect(wrap?.hasAttribute("hidden")).toBe(false);

      const button = container.querySelector<HTMLButtonElement>("button.search-page-field");
      expect(button).not.toBeNull();
      // The shortcut hint is aria-hidden, so the name is the visible words alone.
      const named = [...(button?.childNodes ?? [])]
        .filter((n) => !(n instanceof Element && n.getAttribute("aria-hidden") === "true"))
        .map((n) => n.textContent)
        .join("")
        .trim();
      expect(named).toBe("Search the edition");
      expect(button?.getAttribute("aria-haspopup")).toBe("dialog");

      await act(async () => {
        button?.click();
        button?.click();
        // The palette module is imported on the first press; let it settle.
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(document.querySelectorAll("dialog[data-search-dialog]").length).toBe(1);
    } finally {
      globalThis.fetch = realFetch;
      await act(async () => root?.unmount());
      removeContainer(container);
    }
  });
});
