/**
 * EVERY BUILT ROUTE IS REACHED BY A LINK FROM ANOTHER BUILT ROUTE.
 *
 * THE DEFECT CLASS IS DOCUMENTED IN THE TREE, which is why this is a gate and not a tidiness check.
 * `src/app/lab/page.tsx` exists because of it, and says so: "/lab/ had no page. Every instrument
 * lives at /lab/<id>/, so a reader who trims a lab URL back to /lab/ reached a directory listing on
 * a local static server and a 404 on Vercel: a dead end one edit away from every instrument in the
 * edition." A page that is built and linked from nowhere is the same failure seen from the other
 * side: the work exists, it passes every content gate, and no reader arrives.
 *
 * Nothing guarded this. Measured 2026-10-11 over out/: 720 built HTML files, 719 distinct routes,
 * and exactly TWO with no inbound link, both of them correct and both declared below. A hub
 * control: /papers/mass-energy has 691 inbound, /notation 152, /lab/bm-01 29.
 *
 * WHAT COUNTS AS A LINK, and the choice is deliberate. This reads the whole built file, including
 * the inlined RSC flight payload, so a route linked only by a hydrated island still counts as
 * reached. The stricter question -- whether a reader with scripting off can get there -- is a
 * different gate over the static half of the file, and this one does not answer it. Taking the
 * permissive measure keeps this file free of false positives, and a zero here means nothing in the
 * built site points at that page by any route at all.
 *
 * WHICH HALF THIS WATCHES: that a path INTO the page exists, not that it is reachable by a sensible
 * number of clicks, not that the link is visible rather than in a closed disclosure, and not that
 * the link's text makes sense. Those are reader questions and belong to the browser lane.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = process.cwd();
const OUT = resolve(ROOT, "out");

/**
 * Routes that correctly have no inbound link, each with the reason it is correct.
 *
 * This is an allowlist of two, and it is meant to stay small: an entry here is a claim that a
 * reader reaches the page by some route other than a link, and that claim has to be true.
 */
const UNLINKED_BY_DESIGN: Readonly<Record<string, string>> = {
  "/404": "the not-found page, which the server reaches on a miss and which nothing should link to",
  "/lab":
    "a canonical alias of /instruments/ (src/app/lab/page.tsx sets alternates.canonical and renders the same component); it exists so a reader who trims /lab/<id>/ back to /lab/ is not dead-ended, so linking to it instead of the canonical would be the bug",
};

function htmlFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) found.push(...htmlFiles(full));
    else if (st.isFile() && entry.endsWith(".html")) found.push(full);
  }
  return found;
}

/** `out/a/b/index.html` and `out/a/b.html` are both the route `/a/b`; `out/index.html` is `/`. */
function routeOf(file: string): string {
  let r = file.slice(OUT.length);
  if (r.endsWith("/index.html")) r = r.slice(0, -"/index.html".length);
  else if (r.endsWith(".html")) r = r.slice(0, -".html".length);
  return r.replace(/\/+$/, "") || "/";
}

function normalizeHref(href: string): string {
  const withoutFragment = href.split("#")[0]?.split("?")[0] ?? "";
  return withoutFragment.replace(/\/+$/, "") || "/";
}

describe("every built route is reachable by a link from another built route", () => {
  const files = existsSync(OUT) ? htmlFiles(OUT) : [];
  const routes = new Set(files.map(routeOf));
  const inbound = new Map<string, Set<string>>();

  for (const file of files) {
    const from = routeOf(file);
    const raw = readFileSync(file, "utf8");
    for (const match of raw.matchAll(/href="(\/[^"]*)"/g)) {
      const to = normalizeHref(match[1] ?? "");
      if (to === from || !routes.has(to)) continue;
      const set = inbound.get(to) ?? new Set<string>();
      set.add(from);
      inbound.set(to, set);
    }
  }

  test("the built site is present, so a clean result is not an empty one", () => {
    // 0 routes scanned reads exactly like 0 unreachable routes.
    expect(files.length).toBeGreaterThan(300);
    expect(routes.size).toBeGreaterThan(300);
  });

  test("the link index found real links, so a zero is a finding and not a broken reader", () => {
    // A positive control on the instrument itself: if the href regex or the route normalisation
    // broke, every route would report zero inbound and the whole site would read as unreachable.
    // These three are hubs; any of them at zero means this file, not the site, is wrong.
    for (const hub of ["/papers/mass-energy", "/notation", "/lab/bm-01"]) {
      expect([hub, (inbound.get(hub) ?? new Set()).size > 5]).toEqual([hub, true]);
    }
  });

  test("no built route is linked from nowhere, except the two that should not be", () => {
    const unreached = [...routes]
      .filter((r) => (inbound.get(r) ?? new Set()).size === 0)
      .filter((r) => !(r in UNLINKED_BY_DESIGN))
      .sort();
    console.log(
      `[route-reachability] ${files.length} built files, ${routes.size} routes; ` +
        `${routes.size - unreached.length - Object.keys(UNLINKED_BY_DESIGN).length} reached by a link, ` +
        `${Object.keys(UNLINKED_BY_DESIGN).length} unlinked by design, ${unreached.length} unreachable`,
    );
    for (const r of unreached) console.log(`[route-reachability] UNREACHABLE ${r}`);
    expect(unreached).toEqual([]);
  });

  test("each route declared unlinked by design really is unlinked, and really is built", () => {
    // An allowlist entry that has quietly gained an inbound link is a stale exemption, and one
    // naming a route that no longer exists is worse: it reads as a considered decision about a page
    // nobody built. Both directions, so the list cannot rot in either.
    const problems: string[] = [];
    for (const [route, reason] of Object.entries(UNLINKED_BY_DESIGN)) {
      if (!routes.has(route))
        problems.push(`${route} is declared unlinked by design but is not built`);
      const links = inbound.get(route) ?? new Set<string>();
      if (links.size > 0)
        problems.push(
          `${route} is declared unlinked by design but is linked from ${[...links].slice(0, 3).join(", ")}`,
        );
      if (reason.length < 40) problems.push(`${route}'s reason is too short to be one`);
    }
    expect(problems).toEqual([]);
  });
});
