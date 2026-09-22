/**
 * The plate beside the German text follows the printed page the reader has reached, and says
 * nothing it cannot know: without JavaScript it is the opening page and does not stick.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { FollowingPlate } from "./FollowingPlate.tsx";
import { type PagedBlock, pageAtLine } from "./pageAtLine.ts";

const block = (top: number, page: number | string): PagedBlock => ({
  getBoundingClientRect: () => ({ top }),
  dataset: { printedPage: String(page) },
});

describe("pageAtLine", () => {
  // Tops as they are while the reader is part-way down the paper: two blocks above the line.
  const blocks = [block(-900, 549), block(-200, 549), block(120, 550), block(700, 551)];

  test("the page of the last block whose top is at or above the reading line", () => {
    expect(pageAtLine(blocks, 300, 549)).toBe(550);
    // A naive "first block below the line" answer would say 551 here, the page not yet reached.
    expect(pageAtLine(blocks, 699, 549)).toBe(550);
    expect(pageAtLine(blocks, 700, 549)).toBe(551);
  });

  test("above the first block the reader is on the opening page", () => {
    expect(pageAtLine([block(400, 553), block(900, 554)], 300, 552)).toBe(552);
  });

  test("past the last block the last block's page holds, and a missing page is not guessed", () => {
    expect(pageAtLine(blocks, 5000, 549)).toBe(551);
    expect(pageAtLine([block(0, "")], 300, 549)).toBe(549);
  });
});

describe("FollowingPlate", () => {
  const props = {
    dir: "/figures/plates/pages/ap-17-549",
    pages: [549, 550, 551],
    opening: 549,
    volume: "17",
    scanHref: "/papers/pdfs/ap-17-549.pdf",
  } as const;

  test("without JavaScript it shows the opening page, and is not marked as following", () => {
    const html = renderToStaticMarkup(<FollowingPlate {...props} />);
    expect(html).toContain('src="/figures/plates/pages/ap-17-549/549.webp"');
    expect(html).toContain("ap-17-549/549-1280.webp 1280w");
    expect(html).toContain("Page 549 as printed, Annalen der Physik, volume 17.");
    expect(html).not.toContain("data-following");
  });

  describe("in a browser", () => {
    beforeEach(installDom);
    afterEach(uninstallDom);

    test("it follows the block at the reading line and turns on scroll", async () => {
      const root = document.createElement("div");
      root.setAttribute("data-reader-root", "");
      const tops = new Map<string, number>([
        ["a", 0],
        ["b", 2000],
      ]);
      for (const [id, page] of [
        ["a", 549],
        ["b", 551],
      ] as const) {
        const p = document.createElement("p");
        p.dataset.printedPage = String(page);
        p.getBoundingClientRect = () => ({ top: tops.get(id) ?? 0 }) as DOMRect;
        root.append(p);
      }
      const mount = document.createElement("div");
      root.append(mount);
      document.body.append(root);
      const reactRoot = createRoot(mount);
      await act(async () => reactRoot.render(<FollowingPlate {...props} />));

      const figure = mount.querySelector("figure") as HTMLElement;
      expect(figure.hasAttribute("data-following")).toBe(true);
      expect(figure.getAttribute("data-plate-page")).toBe("549");

      // The reader scrolls: block b is now above the reading line.
      tops.set("a", -2000);
      tops.set("b", 10);
      await act(async () => {
        window.dispatchEvent(new window.Event("scroll"));
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(figure.getAttribute("data-plate-page")).toBe("551");
      expect(figure.querySelector("img")?.getAttribute("src")).toBe(
        "/figures/plates/pages/ap-17-549/551.webp",
      );
      act(() => reactRoot.unmount());
    });
  });
});
