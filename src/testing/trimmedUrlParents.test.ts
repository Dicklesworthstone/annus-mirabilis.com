/**
 * A READER WHO TRIMS A URL FINDS A DOOR, OR THE DEAD END IS DECLARED.
 *
 * THE CLASS IS DOCUMENTED IN THE TREE AND WAS FIXED ONCE BY HAND. `src/app/lab/page.tsx` exists
 * for it and says so: "/lab/ had no page. Every instrument lives at /lab/<id>/, so a reader who
 * trims a lab URL back to /lab/ reached a directory listing on a local static server and a 404 on
 * Vercel: a dead end one edit away from every instrument in the edition." That fix was cheap
 * because the instruments catalogue already existed, so the page is fourteen lines that re-render
 * it with `canonical` pointing at the real address.
 *
 * NOTHING MEASURED THE REST. This is the third question about links and the only one neither of the
 * other two can ask:
 *
 *   routeReachability.test.ts   every built route has an inbound LINK        (inbound)
 *   linkTargetsResolve.test.ts  every emitted link points at a built route  (outbound)
 *   this file                   every PARENT of a built route resolves      (typed, not linked)
 *
 * A trimmed URL emits no link, so an outbound sweep cannot see it: the reader types it. Measured
 * 2026-10-21 over the built `out/`: 758 page routes and 43 parent paths that resolve to nothing.
 * `vercel.json` carries no rewrite and `next.config` only sets `trailingSlash`, so these are 404s
 * on the deployment and not an artefact of reading the directory.
 *
 * SO THE 43 ARE A DECLARED DEBT AND MAY ONLY FALL, which is this repository's pattern for a gap it
 * has measured and not yet decided -- `perf/readingFaceRecords.json` ("The budget is not raised")
 * and `readingCoverage.baseline.json` ("They may only fall"). A NEW unresolvable parent is a
 * failure. A declared one that starts resolving is also a failure, because the entry has to go
 * when the debt is paid: a baseline that only ever rises is a budget.
 *
 * WHY THIS FILE DOES NOT FIX THEM. The two with a natural destination, `/equations/` with 279
 * descendant routes and `/capstones/` with 4, need an index page that does not exist -- there is no
 * equations catalogue to re-render, so unlike `/lab/` the fix is a new reader-facing surface, which
 * is product design and the owner's. The other 36 are intermediate segments (`/papers/<paper>/
 * view/`, `/offline/<paper>/`, `/embed/lab/`) where a reader trimming one more segment reaches a
 * real page. Both groups are recorded below with their descendant counts so whoever decides has the
 * numbers, and neither is invented here.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, posix, resolve } from "node:path";

const OUT = resolve(process.cwd(), "out");

/**
 * Parent paths that 404 today, each with the number of built routes beneath it, measured
 * 2026-10-21. Explicit paths rather than patterns: a fifth paper's faces would add entries and
 * SHOULD turn this red, so that the class is decided rather than silently extended.
 */
const DECLARED_DEAD_ENDS: Readonly<Record<string, number>> = Object.freeze({
  // A natural index that does not exist. The biggest dead end in the edition by descendants.
  "/equations/": 279,
  "/equations/special-relativity/": 122,
  "/equations/light-quanta/": 62,
  "/equations/brownian-motion/": 55,
  "/equations/mass-energy/": 40,
  // A natural index that does not exist, four descendants.
  "/capstones/": 4,
  // Intermediate segments: trimming one more reaches a real page.
  "/embed/lab/": 36,
  "/offline/special-relativity/": 11,
  "/offline/light-quanta/": 10,
  "/offline/brownian-motion/": 6,
  "/offline/mass-energy/": 1,
  "/papers/brownian-motion/view/": 7,
  "/papers/brownian-motion/s0/view/": 7,
  "/papers/brownian-motion/s1/view/": 7,
  "/papers/brownian-motion/s2/view/": 7,
  "/papers/brownian-motion/s3/view/": 7,
  "/papers/brownian-motion/s4/view/": 7,
  "/papers/brownian-motion/s5/view/": 7,
  "/papers/light-quanta/view/": 7,
  "/papers/light-quanta/s0/view/": 7,
  "/papers/light-quanta/s1/view/": 7,
  "/papers/light-quanta/s2/view/": 7,
  "/papers/light-quanta/s3/view/": 7,
  "/papers/light-quanta/s4/view/": 7,
  "/papers/light-quanta/s5/view/": 7,
  "/papers/light-quanta/s6/view/": 7,
  "/papers/light-quanta/s7/view/": 7,
  "/papers/light-quanta/s8/view/": 7,
  "/papers/light-quanta/s9/view/": 7,
  "/papers/mass-energy/view/": 7,
  "/papers/mass-energy/s0/view/": 7,
  "/papers/special-relativity/view/": 7,
  "/papers/special-relativity/s0/view/": 7,
  "/papers/special-relativity/s1/view/": 7,
  "/papers/special-relativity/s2/view/": 7,
  "/papers/special-relativity/s3/view/": 7,
  "/papers/special-relativity/s4/view/": 7,
  "/papers/special-relativity/s5/view/": 7,
  "/papers/special-relativity/s6/view/": 7,
  "/papers/special-relativity/s7/view/": 7,
  "/papers/special-relativity/s8/view/": 7,
  "/papers/special-relativity/s9/view/": 7,
  "/papers/special-relativity/s10/view/": 7,
});

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, found);
    else found.push(p);
  }
  return found;
}

const FILES = existsSync(OUT) ? walk(OUT) : [];
const served = new Set(FILES.map((f) => `/${posix.relative(OUT, f).split("\\").join("/")}`));
const routes = new Set(served);
for (const s of served) {
  if (!s.endsWith("/index.html")) continue;
  const dir = s.slice(0, -"index.html".length);
  routes.add(dir);
  routes.add(dir.replace(/\/$/, "") || "/");
}

function resolvesInBuild(target: string): boolean {
  if (routes.has(target)) return true;
  if (served.has(`${target.replace(/\/$/, "")}/index.html`)) return true;
  return served.has(`${target}/index.html`);
}

/** Every page route, as a trailing-slash path. */
const PAGE_ROUTES = [...served]
  .filter((s) => s.endsWith("/index.html"))
  .map((s) => s.slice(0, -"index.html".length).replace(/\/$/, "") || "/")
  .sort();

/** Unresolvable proper prefixes of a page route, with how many routes sit beneath each. */
function deadEnds(): Map<string, number> {
  const found = new Map<string, number>();
  for (const route of PAGE_ROUTES) {
    const parts = route.split("/").filter((p) => p !== "");
    for (let i = 1; i < parts.length; i += 1) {
      const parent = `/${parts.slice(0, i).join("/")}/`;
      if (resolvesInBuild(parent)) continue;
      found.set(parent, (found.get(parent) ?? 0) + 1);
    }
  }
  return found;
}

describe("a trimmed URL finds a page, or the dead end is declared", () => {
  test("the build is present and the population is not vacuous", () => {
    // Otherwise every assertion below iterates nothing and passes, which is the clean-run-over-an-
    // empty-population shape. Measured 2026-10-21: 758 page routes.
    expect(
      PAGE_ROUTES.length,
      "no built page routes under out/. Run `bun run build`; this gate reads the build.",
    ).toBeGreaterThanOrEqual(400);
    const found = deadEnds();
    console.log(
      `[trimmed-url] ${PAGE_ROUTES.length} page route(s); ${found.size} parent path(s) resolve to nothing; ${Object.keys(DECLARED_DEAD_ENDS).length} declared`,
    );
    expect(found.size).toBeGreaterThan(0);
  });

  test("no UNDECLARED parent path is a dead end", () => {
    const undeclared = [...deadEnds().entries()]
      .filter(([parent]) => DECLARED_DEAD_ENDS[parent] === undefined)
      .sort((a, b) => b[1] - a[1])
      .map(([parent, n]) => `${parent} (${n} route(s) beneath it)`);
    // Named rather than counted: the repair is either a page at that path or an entry here with
    // its reason, and both need to know which path it is.
    expect(undeclared, undeclared.join("\n")).toEqual([]);
  });

  test("a declared dead end that now resolves must leave this list", () => {
    // The other half of a ratchet, and the half that is usually missing: when `/equations/` gets
    // its index, this test goes red until the entry is deleted. A baseline that only ever rises is
    // a budget.
    const fixed = Object.keys(DECLARED_DEAD_ENDS).filter((parent) => resolvesInBuild(parent));
    expect(
      fixed,
      `these are declared as dead ends and now resolve; delete them from DECLARED_DEAD_ENDS:\n${fixed.join("\n")}`,
    ).toEqual([]);
  });

  test("PLANTED: the prefix walk and the resolver both discriminate", () => {
    /*
     * This file's verdict is a zero over undeclared paths, and a zero from a sweep that cannot fail
     * is worth nothing. Two halves to control: that the resolver knows a real path from an absent
     * one, and that the prefix walk actually enumerates parents.
     */
    expect(resolvesInBuild("/lab/"), "the /lab/ page is the precedent and must resolve").toBe(true);
    expect(resolvesInBuild("/instruments/")).toBe(true);
    expect(resolvesInBuild("/papers/mass-energy/")).toBe(true);
    expect(resolvesInBuild("/papers/not-a-paper/")).toBe(false);

    // The walk must find the declared ones; if it enumerated nothing, "0 undeclared" would be
    // vacuous rather than clean.
    const found = deadEnds();
    expect(
      found.get("/equations/"),
      "/equations/ is the largest declared dead end",
    ).toBeGreaterThan(200);
    expect(found.has("/papers/mass-energy/view/")).toBe(true);
    // And it must NOT report a parent that resolves.
    expect(found.has("/papers/")).toBe(false);
    expect(found.has("/lab/")).toBe(false);
  });

  test("every declared entry names a path shaped like a route prefix", () => {
    // A typo here would silently excuse nothing and quietly shrink the guard, so the shape is
    // asserted rather than trusted.
    const malformed = Object.keys(DECLARED_DEAD_ENDS).filter(
      (p) => !p.startsWith("/") || !p.endsWith("/") || p.includes("//"),
    );
    expect(malformed, malformed.join(", ")).toEqual([]);
  });
});
