/**
 * /foundations/: the lesson groups are named at the top, each linking to its heading.
 *
 * Before: 45 lessons in six groups on one page, 9,212px long on a 390px phone, with nothing but
 * scrolling to reach a group; "Rates, curves and sums" began at y=3,053. A list of the groups now
 * sits under the introduction, each with its count.
 *
 * Rendered from the real content index. Properties, not a census: groups and lessons are added,
 * and each check below holds at any count, with its population guarded against being empty.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import FoundationsIndex from "./page";

async function read() {
  const html = renderToStaticMarkup(await FoundationsIndex());
  await installDom();
  try {
    const page = new DOMParser().parseFromString(html, "text/html");
    const nav = [...page.querySelectorAll(".lesson-group-nav a")].map((a) => ({
      href: a.getAttribute("href") ?? "",
      name: a.firstChild?.textContent?.trim() ?? "",
      count: Number(a.querySelector(".lesson-group-count")?.firstChild?.textContent ?? "NaN"),
      spoken: a.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    const groups = [...page.querySelectorAll("section.lesson-group")].map((section) => ({
      id: section.querySelector("h2")?.id ?? "",
      title: section.querySelector("h2")?.textContent ?? "",
      labelledBy: section.getAttribute("aria-labelledby"),
      cards: section.querySelectorAll(".lesson-card").length,
    }));
    return { nav, groups };
  } finally {
    await uninstallDom();
  }
}

const { nav, groups } = await read();

describe("/foundations/ names its lesson groups at the top", () => {
  test("one link per group, in the page's order, each landing on that group's heading", () => {
    expect(groups.length).toBeGreaterThan(1);
    expect(nav.map((link) => link.href)).toEqual(groups.map((group) => `#${group.id}`));
    for (const group of groups) {
      expect(group.id).toMatch(/^lessons-[a-z0-9-]+$/);
      expect(group.labelledBy).toBe(group.id);
    }
    // Ids are unique, or two links would land on the first match.
    expect(new Set(groups.map((group) => group.id)).size).toBe(groups.length);
  });

  test("each link names its group and counts the lessons under it", () => {
    for (const [i, link] of nav.entries()) {
      const group = groups[i];
      expect(group).toBeDefined();
      expect(link.name).toBe(group?.title ?? "");
      expect(group?.cards ?? 0).toBeGreaterThan(0);
      expect(link.count).toBe(group?.cards ?? -1);
      // A screen reader hears "10 lessons", not a bare number after the name.
      expect(link.spoken).toEndWith(`${link.count} lessons`);
    }
  });
});
