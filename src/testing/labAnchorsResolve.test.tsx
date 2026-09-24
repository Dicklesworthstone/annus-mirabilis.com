import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exportMarkup } from "./exportMarkup.ts";

/**
 * am-inst-lab-route-f8f3 criterion 2: a lab's source and explanation links resolve to anchors that
 * exist. On 2026-09-24 two did not: BM-03 and BM-04 linked /papers/brownian-motion/#arg-bm-configuration
 * and #s3, but the Brownian reading face renders only §4 and §5, so the reader landed at the top of
 * the paper (fixed in 78019799 by linking the German face, which has §2 and §3).
 *
 * Every lab and embed page is rendered, and each `href="/path/#anchor"` it contains is resolved to
 * the App Router page that serves /path/ (a literal segment before a dynamic one), which is rendered
 * in turn and must carry id="anchor". An anchor added by client code after hydration would not be
 * seen here; the reading faces render their section ids on the server.
 */
const APP = fileURLToPath(new URL("../app/", import.meta.url));

function pages(dir: string, base: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}${name}`;
    if (statSync(full).isDirectory()) return pages(`${full}/`, `${base}${name}/`);
    return name === "page.tsx" ? [base] : [];
  });
}

type Route = { module: string; params: Record<string, string> };

/** The page module serving a URL path, and the dynamic params it needs, or undefined. */
function resolveRoute(path: string): Route | undefined {
  const segments = path.split("/").filter(Boolean);
  const walk = (dir: string, i: number, params: Record<string, string>): Route | undefined => {
    if (i === segments.length)
      return existsSync(`${dir}page.tsx`) ? { module: `${dir}page.tsx`, params } : undefined;
    const segment = segments[i] as string;
    if (existsSync(`${dir}${segment}`) && statSync(`${dir}${segment}`).isDirectory()) {
      const found = walk(`${dir}${segment}/`, i + 1, params);
      if (found) return found;
    }
    for (const name of readdirSync(dir)) {
      const m = /^\[([a-z]+)\]$/i.exec(name);
      if (!m) continue;
      const found = walk(`${dir}${name}/`, i + 1, { ...params, [m[1] as string]: segment });
      if (found) return found;
    }
    return undefined;
  };
  return walk(APP, 0, {});
}

async function render(module: string, params: object): Promise<string> {
  const mod = await import(module);
  const out = mod.default({ params: Promise.resolve(params), searchParams: Promise.resolve({}) });
  return exportMarkup(out instanceof Promise ? await out : out);
}

describe("lab and embed pages link only to anchors that exist", () => {
  test("the route resolver finds a literal page before a dynamic one, and refuses a missing page", () => {
    expect(resolveRoute("/papers/brownian-motion/")?.module).toEndWith(
      "papers/brownian-motion/page.tsx",
    );
    expect(resolveRoute("/papers/light-quanta/")).toMatchObject({
      params: { paper: "light-quanta" },
    });
    expect(resolveRoute("/no-such-route/")).toBeUndefined();
  });

  test("every #anchor a lab or embed page links to is an id on the page it names", async () => {
    const links = new Map<string, string>();
    for (const rel of [...pages(`${APP}lab/`, "lab/"), ...pages(`${APP}embed/`, "embed/")]) {
      const mod = await import(`${APP}${rel}page.tsx`);
      const list: object[] =
        rel.includes("[") && mod.generateStaticParams ? await mod.generateStaticParams() : [{}];
      for (const params of list) {
        const html = await render(`${APP}${rel}page.tsx`, params);
        for (const m of html.matchAll(/href="(\/[^"#?]*\/)#([^"]+)"/g))
          if (!links.has(`${m[1]}#${m[2]}`)) links.set(`${m[1]}#${m[2]}`, rel);
      }
    }
    const ids = new Map<string, Set<string> | undefined>();
    const missing: string[] = [];
    for (const [link, from] of links) {
      const [path = "", anchor = ""] = link.split("#");
      if (!ids.has(path)) {
        const route = resolveRoute(path);
        ids.set(
          path,
          route
            ? new Set(
                [...(await render(route.module, route.params)).matchAll(/\sid="([^"]+)"/g)].map(
                  (m) => m[1] as string,
                ),
              )
            : undefined,
        );
      }
      const found = ids.get(path);
      if (!found) missing.push(`${link} (from ${from}): no page serves ${path}`);
      else if (!found.has(decodeURIComponent(anchor))) missing.push(`${link} (from ${from})`);
    }
    console.log(
      `[anchors] ${links.size} anchor links to ${ids.size} pages; ${missing.length} missing`,
    );
    expect(links.size).toBeGreaterThan(10);
    expect(missing).toEqual([]);
  });
});
