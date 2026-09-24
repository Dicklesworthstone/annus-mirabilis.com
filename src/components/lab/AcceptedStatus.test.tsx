import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { AcceptedStatus } from "./AcceptedStatus.tsx";

/**
 * The status line a laboratory announces its accepted result through: present from the first
 * render, prefixed by what the result is, and spaced so a dragged slider cannot turn it into a
 * stream of announcements (at most one change a second, the newest text winning).
 */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("AcceptedStatus", () => {
  test("renders a polite status region in the static HTML, prefixed by what the result is", () => {
    const worked = renderToStaticMarkup(
      createElement(AcceptedStatus, { worked: true, summary: "x = 1." }),
    );
    expect(worked).toContain('role="status"');
    expect(worked).toContain('aria-live="polite"');
    expect(worked).toContain("Worked example: x = 1.");
    const accepted = renderToStaticMarkup(
      createElement(AcceptedStatus, { worked: false, summary: "x = 2." }),
    );
    expect(accepted).toContain("Accepted: x = 2.");
  });

  describe("spacing", () => {
    let container: HTMLElement;
    let root: Root;
    beforeEach(async () => {
      await installDom();
      container = createContainer();
      root = createRoot(container);
    });
    afterEach(async () => {
      await act(async () => root.unmount());
      removeContainer(container);
      await uninstallDom();
    });

    test("a first change shows at once; changes inside the next second collapse to the newest", async () => {
      const text = () => container.querySelector('[role="status"]')?.textContent;
      await act(async () =>
        root.render(createElement(AcceptedStatus, { worked: true, summary: "a" })),
      );
      expect(text()).toBe("Worked example: a");
      // Effects flush when an act scope ends, so each render and each wait is its own act.
      const show = (summary: string) =>
        act(async () => root.render(createElement(AcceptedStatus, { worked: false, summary })));
      const pass = (ms: number) => act(async () => wait(ms));
      await show("b");
      await pass(30);
      expect(text()).toBe("Accepted: b");
      // Two more commits within the second after "b": neither shows yet.
      await show("c");
      await pass(20);
      await show("d");
      await pass(200);
      expect(text()).toBe("Accepted: b");
      // After the second has passed, the newest shows, and "c" never did.
      await pass(1000);
      expect(text()).toBe("Accepted: d");
    });
  });
});
