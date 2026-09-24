/**
 * The home page's four invitations (am-design-home-page-0s7s): under each first page, the paper's
 * question with "Show me with an example" and "Take me to the paper".
 *
 * Every link is resolved against what the site builds. The route must be one the paper route
 * generates (dynamicParams is false, so any other slug is a 404), and an anchor must be an id the
 * paper's page renders exactly once, rendered here as the page renders it. A seeded missing route
 * and a seeded missing anchor go through the same resolver and must fail it, so a green run means
 * the resolver can see a broken link, not only that it passed four good ones.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { exampleHref, INVITATIONS } from "../components/home/FirstPages.tsx";
import { paperStaticParams } from "../reader/paperRoutes.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import Home from "./page";

const html = renderToStaticMarkup(<Home />);
const routes = new Set([...(await paperStaticParams())].map((p) => p.paper));

/**
 * A paper page as it is exported, rendered from the route module that serves its URL: the paper's
 * own folder when it has one (a static segment wins over [paper], as Next resolves it; Brownian
 * motion's is src/app/papers/brownian-motion/), otherwise src/app/papers/[paper]/.
 */
const rendered = new Map<string, string>();
async function paperPage(slug: string): Promise<string> {
  const cached = rendered.get(slug);
  if (cached !== undefined) return cached;
  const route = existsSync(join("src/app/papers", slug, "page.tsx"))
    ? await import(`./papers/${slug}/page.tsx`)
    : await import("./papers/[paper]/page.tsx");
  await installDom();
  try {
    const element = await route.default({ params: Promise.resolve({ paper: slug }) });
    const page = await exportMarkup(element);
    rendered.set(slug, page);
    return page;
  } finally {
    await uninstallDom();
  }
}

/** Why a home-page link would not land, or null when it lands. */
async function unresolved(href: string): Promise<string | null> {
  const match = /^\/papers\/([a-z-]+)\/(?:#(.+))?$/.exec(href);
  if (!match) return `${href}: not a paper link`;
  const [, slug = "", fragment] = match;
  if (!routes.has(slug)) return `${href}: /papers/${slug}/ is not a generated route`;
  if (fragment === undefined) return null;
  const count = (await paperPage(slug)).split(`id="${fragment}"`).length - 1;
  return count === 1 ? null : `${href}: #${fragment} occurs ${count} times on the page`;
}

/** Each first page as rendered: its paper, its question, and its two links, read with a DOM. */
async function readInvitations() {
  await installDom();
  try {
    const page = new DOMParser().parseFromString(html, "text/html");
    return [...page.querySelectorAll("li.first-page")].map((li) => ({
      slug:
        /^\/papers\/([a-z-]+)\/$/.exec(li.querySelector("a")?.getAttribute("href") ?? "")?.[1] ??
        "",
      question: li.querySelector(".first-page-question")?.textContent ?? null,
      links: [...li.querySelectorAll(".first-page-actions a")].map((a) => ({
        href: a.getAttribute("href") ?? "",
        text: a.firstChild?.textContent?.trim() ?? "",
      })),
    }));
  } finally {
    await uninstallDom();
  }
}
const invitations = await readInvitations();

describe("the home page invites a reader into each paper with a question", () => {
  test("each of the four first pages carries its question and both ways in", () => {
    // Non-vacuity: every paper with a question is on the page, and nothing else.
    expect(invitations.length).toBe(Object.keys(INVITATIONS).length);
    for (const { slug, question, links } of invitations) {
      expect(question).toBe(INVITATIONS[slug] ?? "");
      expect(question?.trim().endsWith("?")).toBe(true);
      expect(links).toEqual([
        { href: exampleHref(slug), text: "Show me with an example" },
        { href: `/papers/${slug}/`, text: "Take me to the paper" },
      ]);
    }
  });

  test("every link lands: the route is generated and the anchor is on the page once", async () => {
    const hrefs = invitations.flatMap((i) => i.links.map((l) => l.href));
    // Two per paper; the first test already holds the papers to INVITATIONS.
    expect(invitations.length).toBeGreaterThan(0);
    expect(hrefs.length).toBe(2 * invitations.length);
    for (const href of hrefs) expect(await unresolved(href)).toBeNull();
  });

  test("a missing route and a missing anchor are refused by the same resolver", async () => {
    expect(await unresolved("/papers/no-such-paper/")).toContain("not a generated route");
    expect(await unresolved("/papers/light-quanta/#entry-nowhere")).toContain("occurs 0 times");
  });

  test("the 404 page shows the first pages without invitations", async () => {
    const { default: NotFound } = await import("./not-found");
    const page = renderToStaticMarkup(<NotFound />);
    expect(page).toContain('class="first-page"');
    expect(page).not.toContain("first-page-question");
  });
});
