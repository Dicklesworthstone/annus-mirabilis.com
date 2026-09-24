import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { createContainer, installDom, removeContainer, uninstallDom } from "../../testing/reactDom";
import { MenuToggle } from "./MenuToggle.tsx";

/**
 * The phone menu (MenuToggle.tsx). The collapse itself is CSS, keyed on the flag this button sets
 * on <html>, so these check the flag, the button's state and the keyboard; the CSS assertions
 * below read the stylesheet for the two properties that make the design safe without JavaScript.
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
    root.render(createElement(MenuToggle));
  });
  const button = container.querySelector("button") as HTMLButtonElement;
  return { container, root, button };
}

describe("MenuToggle", () => {
  test("a closed button named Menu that controls the site navigation", async () => {
    const { container, root, button } = await render();
    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBe("site-nav");
    expect(button.textContent?.trim()).toBe("Menu");
    expect(document.documentElement.hasAttribute("data-menu-open")).toBe(false);
    await act(async () => root.unmount());
    removeContainer(container);
  });

  test("a press opens it, a second press closes it", async () => {
    const { container, root, button } = await render();
    await act(async () => button.click());
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(document.documentElement.hasAttribute("data-menu-open")).toBe(true);
    await act(async () => button.click());
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.documentElement.hasAttribute("data-menu-open")).toBe(false);
    await act(async () => root.unmount());
    removeContainer(container);
  });

  test("Escape from a link in the menu closes it and gives focus back to the button", async () => {
    const { container, root, button } = await render();
    await act(async () => button.click());
    const nav = document.createElement("nav");
    nav.id = "site-nav";
    const link = document.createElement("a");
    link.href = "/papers/";
    nav.append(link);
    document.body.append(nav);
    link.focus();
    await act(async () => {
      link.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.documentElement.hasAttribute("data-menu-open")).toBe(false);
    expect(document.activeElement).toBe(button);
    nav.remove();
    await act(async () => root.unmount());
    removeContainer(container);
  });

  test("Escape pressed in the page, past the open menu, leaves focus where it is", async () => {
    // Tab carries on past the open menu into the page. An Escape there is the page's, and used to
    // pull focus and the scroll back to the header.
    const { container, root, button } = await render();
    await act(async () => button.click());
    const elsewhere = document.createElement("a");
    elsewhere.href = "/sources/";
    document.body.append(elsewhere);
    elsewhere.focus();
    await act(async () => {
      elsewhere.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.activeElement).toBe(elsewhere);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    elsewhere.remove();
    await act(async () => root.unmount());
    removeContainer(container);
  });

  test("unmounting while open leaves no flag on <html>", async () => {
    const { container, root, button } = await render();
    await act(async () => button.click());
    await act(async () => root.unmount());
    expect(document.documentElement.hasAttribute("data-menu-open")).toBe(false);
    removeContainer(container);
  });

  test("the stylesheet collapses the nav only on a phone, and only once JavaScript has run", () => {
    const css = readFileSync(new URL("./menuToggle.css", import.meta.url), "utf8");
    // Without JavaScript the pre-paint script never sets data-theme, so a reader keeps every link.
    expect(css).toContain(":root[data-theme]:not([data-menu-open]) .site-header > nav");
    const phone = css.slice(css.indexOf("@media (max-width: 579px)"));
    expect(
      phone.indexOf(":root[data-theme]:not([data-menu-open]) .site-header > nav"),
    ).toBeGreaterThan(0);
    // Outside that query the button never shows.
    expect(css.slice(0, css.indexOf("@media")).replace(/\s+/g, " ")).toContain(
      "button.menu-toggle { display: none; }",
    );
  });
});
