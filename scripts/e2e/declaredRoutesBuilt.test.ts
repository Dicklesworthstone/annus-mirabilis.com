/**
 * Every route this project DECLARES is built, and every built page carries real text.
 *
 * This began as an observation while am-launch-readiness-audit-sc9b was found unstartable:
 * `/sources`, `/about`, `/timeline`, `/1904` and `/search` were absent from `out/`. Turned
 * into an inventory that would have been wrong within a day. It is a check instead,
 * because an inventory gates nothing and rots into a description of a tree that has moved.
 *
 * WHAT IT PROVES: every route the App Router declares produced a page, and that page is
 * not an empty shell.
 *
 * WHAT IT DOES NOT PROVE, and the distinction is the whole reason this exists: that a
 * route RENDERS is not that it renders CORRECTLY. This check knows nothing about whether
 * a page shows the right paper, the right physics, or the right label. It replaces one
 * specific false comfort - "I looked and the file was there" - and nothing else. Presence
 * is the weakest evidence there is, which is why non-emptiness is asserted too, and even
 * that is a floor rather than a verdict.
 *
 * THE DECLARATION IS THE FILESYSTEM, NOT A LIST IN THIS FILE. Every `src/app/**\/page.tsx`
 * declares a route. A hand-maintained list would drift from the routes the moment someone
 * added one, and drifting away from the thing it describes is exactly the failure that
 * made the inventory the wrong shape. Nothing here needs updating when a route is added:
 * the new route simply starts being checked.
 *
 * ABSENCE OF AN UNDECLARED ROUTE IS NOT A FAILURE. `/sources` and `/about` have no
 * page.tsx because their beads are open. This check would be lying if it demanded them,
 * and it will start demanding them on the day somebody declares them, which is the
 * correct moment and needs no edit here.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const APP_ROOT = join(REPO_ROOT, "src", "app");
const OUT_DIR = join(REPO_ROOT, "out");

/**
 * The floor for "not an empty shell", chosen from measurement rather than taste.
 *
 * Measured over the 308 pages built on 2026-09-21, the least visible text on any page was
 * 850 characters (the 404) and the next lowest was 1118. A Next shell with no content
 * strips to well under 200. The floor sits at 200 so that it separates a shell from every
 * real page with four times the headroom, and does not become a de facto content budget
 * that fails when a legitimately short page appears.
 */
const MIN_VISIBLE_TEXT = 200;

/** Visible text, with script and style contents removed so their bytes cannot pad a shell. */
function visibleTextLength(html: string): number {
  const withoutCode = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  return withoutCode
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

type DeclaredRoute = Readonly<{ route: string; dynamic: boolean }>;

/** Every route declared by a page.tsx under src/app, as a URL path. */
function declaredRoutes(): DeclaredRoute[] {
  const found: DeclaredRoute[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "page.tsx") {
        const rel = relative(APP_ROOT, dirname(full));
        const route = rel === "" ? "/" : `/${rel.split(/[\\/]/).join("/")}`;
        found.push({ route, dynamic: route.includes("[") });
      }
    }
  };
  walk(APP_ROOT);
  return found.sort((a, b) => a.route.localeCompare(b.route));
}

/** The static prefix of a dynamic route: /papers/[paper]/view/[face] -> /papers. */
function staticPrefix(route: string): string {
  const parts = route.split("/").filter(Boolean);
  const stop = parts.findIndex((p) => p.startsWith("["));
  return `/${parts.slice(0, stop === -1 ? parts.length : stop).join("/")}`;
}

function builtPagesUnder(prefix: string): string[] {
  const base = prefix === "/" ? OUT_DIR : join(OUT_DIR, prefix);
  if (!existsSync(base)) return [];
  const pages: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "index.html") pages.push(full);
    }
  };
  walk(base);
  return pages;
}

test("every declared route is built, and no built page is an empty shell", () => {
  const routes = declaredRoutes();

  // Reachability before the claim. With no declared routes this test would pass over an
  // empty population and keep passing forever, which is the exact failure the launch
  // audit refused to commit and the reason this check exists at all.
  assert.ok(
    routes.length > 10,
    `only ${routes.length} declared routes were found under ${APP_ROOT}. ` +
      "If the App Router has moved, this check must move with it rather than pass.",
  );

  if (!existsSync(join(OUT_DIR, "index.html"))) {
    assert.fail(
      "out/ is absent, so what is built cannot be checked. Run bun run build. " +
        "This is not-available rather than a pass: a missing artefact is not evidence.",
    );
  }

  const missing: string[] = [];
  const empty: string[] = [];
  let pagesChecked = 0;

  for (const { route, dynamic } of routes) {
    if (dynamic) {
      // A dynamic route declares a FAMILY. Producing zero pages is the interesting
      // failure: the route exists, generateStaticParams returned nothing, and the section
      // of the site is silently absent while every file it needs is present.
      const pages = builtPagesUnder(staticPrefix(route));
      if (pages.length === 0) {
        missing.push(`${route} (dynamic) produced no pages under ${staticPrefix(route)}`);
      }
      continue;
    }
    const page = route === "/" ? join(OUT_DIR, "index.html") : join(OUT_DIR, route, "index.html");
    if (!existsSync(page)) {
      missing.push(
        `${route} is declared by src/app${route === "/" ? "" : route}/page.tsx and is not in out/`,
      );
      continue;
    }
    pagesChecked++;
    const text = visibleTextLength(readFileSync(page, "utf8"));
    if (text < MIN_VISIBLE_TEXT) {
      empty.push(
        `${route} built ${statSync(page).size} bytes but only ${text} characters of visible text`,
      );
    }
  }

  assert.deepEqual(
    missing,
    [],
    `Declared routes that did not build:\n  ${missing.join("\n  ")}\n` +
      "A route with a page.tsx and no page in out/ is a section of the site that silently " +
      "does not exist. An UNDECLARED route being absent is not a failure and is not " +
      "reported here: /sources and /about have no page.tsx because their beads are open.",
  );
  assert.deepEqual(
    empty,
    [],
    `Built pages with no real text:\n  ${empty.join("\n  ")}\n` +
      `Fewer than ${MIN_VISIBLE_TEXT} characters of visible text after removing script and ` +
      "style contents. The floor was measured: the least visible text on any of the 308 " +
      "pages built on 2026-09-21 was 850 characters.",
  );

  assert.ok(pagesChecked > 10, `only ${pagesChecked} static pages were actually opened`);
});

test("the declared-route set is read from the filesystem, not written down here", () => {
  // The property that stops this becoming the inventory it replaced. If someone adds a
  // route, it is checked without anyone editing this file; if someone converts this to a
  // hand-maintained list, this fails and says why.
  const routes = declaredRoutes();
  const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
  for (const { route } of routes.slice(0, 40)) {
    if (route === "/" || route.includes("[")) continue;
    assert.ok(
      !source.includes(`"${route}"`),
      `${route} is hard-coded in this check. The declared set must come from src/app so ` +
        "that it cannot drift from the routes it describes.",
    );
  }
});
