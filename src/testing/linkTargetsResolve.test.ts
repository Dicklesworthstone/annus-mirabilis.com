/**
 * EVERY INTERNAL LINK IN THE BUILT SITE POINTS AT SOMETHING THE BUILD SERVES.
 *
 * THIS IS THE DUAL OF `routeReachability.test.ts`, AND NEITHER CAN SEE THE OTHER'S DEFECT. That
 * file asks whether every built route has an inbound link; a route with no inbound link is work no
 * reader arrives at. This file asks the opposite: whether every link has a route. A one-way
 * correspondence check cannot see a surplus on the side it iterates, so a site could pass that gate
 * with 719 of 719 routes linked while every one of a hundred hrefs pointed at a page that was never
 * generated, and nothing would be red.
 *
 * THE CLASS HAS HAPPENED HERE. `src/app/lab/page.tsx` exists because trimming a lab URL back to
 * `/lab/` reached a 404 on Vercel. And a reader-facing instance is recorded in the beads: 39 no-JS
 * anchors rendered against 0 built pages, because rendering a control and registering its route are
 * two separate acts. A real link to an ungenerated route is worse than no link, because a reader
 * follows it and lands on the 404.
 *
 * MEASURED 2026-10-21 over the built `out/`: 759 pages, 907 distinct internal targets, 0 that
 * resolve to nothing. The guard goes in while the count is zero, which is the only comfortable time
 * to add one.
 *
 * WHAT COUNTS AS A LINK, and it is narrower than the sibling's deliberately. This matches ` href="`
 * in the served bytes, which reaches the static markup and NOT the inlined RSC flight payload,
 * where hrefs appear escaped as `\"href\":\"...\"`. That is the right side for this question: a
 * target that only a hydrated island would navigate to is not a link a reader can follow with
 * scripting off, and a payload-encoded duplicate of a markup href would only be counted twice.
 *
 * WHICH HALF THIS WATCHES: that the target EXISTS in the build. Not that the fragment after `#`
 * resolves to an element -- `src/testing/` has anchor gates for that -- not that the link is
 * visible, and not that its text names its destination, which `linkNames.test.tsx` owns.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix, resolve } from "node:path";

const OUT = resolve(process.cwd(), "out");
const HREF = /\shref="([^"]+)"/g;
const SKIP = /^(?:https?:|mailto:|tel:|data:|javascript:|#)/i;

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, found);
    else found.push(p);
  }
  return found;
}

/** Every path the build serves, plus the directory forms an index.html answers to. */
function servedPaths(files: readonly string[]): { served: Set<string>; routes: Set<string> } {
  const served = new Set<string>();
  for (const f of files) served.add(`/${posix.relative(OUT, f).split("\\").join("/")}`);
  const routes = new Set(served);
  for (const s of served) {
    if (!s.endsWith("/index.html")) continue;
    const dir = s.slice(0, -"index.html".length);
    routes.add(dir);
    routes.add(dir.replace(/\/$/, "") || "/");
  }
  return { served, routes };
}

const FILES = existsSync(OUT) ? walk(OUT) : [];
const PAGES = FILES.filter((f) => f.endsWith(".html"));
const { served, routes } = servedPaths(FILES);

/** Does the build serve this path, as a file or as a directory with an index? */
function resolvesInBuild(target: string): boolean {
  if (routes.has(target)) return true;
  if (served.has(`${target.replace(/\/$/, "")}/index.html`)) return true;
  return served.has(`${target}/index.html`);
}

/** Distinct internal targets, each with the pages that reference it. */
function internalTargets(): Map<string, string[]> {
  const targets = new Map<string, string[]>();
  for (const page of PAGES) {
    const pageRoute = `/${posix.relative(OUT, page).split("\\").join("/")}`;
    const body = readFileSync(page, "utf8");
    for (const m of body.matchAll(HREF)) {
      const raw = m[1];
      if (raw === undefined || SKIP.test(raw)) continue;
      const bare = (raw.split("#")[0] ?? "").split("?")[0] ?? "";
      if (bare === "") continue;
      const target = bare.startsWith("/") ? bare : posix.resolve(posix.dirname(pageRoute), bare);
      const refs = targets.get(target);
      if (refs === undefined) targets.set(target, [pageRoute]);
      else if (refs.length < 4) refs.push(pageRoute);
    }
  }
  return targets;
}

describe("every internal link in the built site resolves", () => {
  test("the build is present and the population is not vacuous", () => {
    // Without this the whole file passes on a checkout with no out/, iterating nothing, which is
    // the shape of a clean run over an empty population. Measured 2026-10-21: 759 pages.
    expect(
      PAGES.length,
      "no built pages under out/. Run `bun run build`; this gate reads the build, it does not make one.",
    ).toBeGreaterThanOrEqual(400);
    const targets = internalTargets();
    console.log(
      `[linkcheck] ${PAGES.length} built page(s); ${targets.size} distinct internal target(s)`,
    );
    expect(targets.size).toBeGreaterThanOrEqual(300);
  });

  test("no internal link points at a path the build does not serve", () => {
    const broken = [...internalTargets().entries()]
      .filter(([target]) => !resolvesInBuild(target))
      .sort((a, b) => b[1].length - a[1].length)
      .map(([target, refs]) => `${target} <- ${refs.length}+ page(s), e.g. ${refs[0]}`);
    // Named, not counted: a broken target is repaired by looking at the page that emits it.
    expect(broken, broken.join("\n")).toEqual([]);
  });

  test("PLANTED: the resolver rejects routes the build never generated, and accepts real ones", () => {
    /*
     * A sweep that comes back clean and a sweep that cannot fail look identical, and this one comes
     * back clean. So the resolver is driven with both kinds, including the shapes it is most likely
     * to get wrong: a directory route, a trailing-slash variant, and a static asset.
     */
    for (const real of ["/papers/mass-energy/", "/papers/mass-energy", "/about/", "/404.html"]) {
      expect(resolvesInBuild(real), `${real} is built but the resolver rejected it`).toBe(true);
    }
    for (const absent of [
      "/papers/mass-energy/view/klingon/",
      "/papers/not-a-paper/",
      "/lab/not-an-instrument/",
      "/wasm/does-not-exist.wasm",
    ]) {
      expect(resolvesInBuild(absent), `${absent} is not built but the resolver accepted it`).toBe(
        false,
      );
    }
  });

  test("the href pattern reads markup and not the inlined flight payload", () => {
    // The payload escapes its quotes, so ` href="` cannot match inside it. If that ever changes,
    // this file would start counting duplicates and payload-only targets as reader-followable
    // links, so the assumption is pinned rather than assumed.
    const sample = ' <a href="/papers/mass-energy/">x</a>';
    const payload = '{\\"href\\":\\"/papers/not-a-paper/\\"}';
    expect([...sample.matchAll(HREF)].map((m) => m[1])).toEqual(["/papers/mass-energy/"]);
    expect([...payload.matchAll(HREF)]).toEqual([]);
  });
});
