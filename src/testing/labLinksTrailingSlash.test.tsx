import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exportMarkup } from "./exportMarkup.ts";

/**
 * The site exports with trailingSlash: true, so a link to /lab/lq-06 answers 308 before the page
 * loads. Rendering every lab and embed page on 2026-09-24 found 10 internal links without the slash,
 * among them both share permalinks, so every shared light-thread and Avogadro link bounced (fixed in
 * 84130cfb). This reads what the pages render, not their source, so a link built in a template
 * literal or a helper is checked as readers get it.
 */
const APP = fileURLToPath(new URL("../app/", import.meta.url));

function pages(dir: string, base: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}${name}`;
    if (statSync(full).isDirectory()) return pages(`${full}/`, `${base}${name}/`);
    return name === "page.tsx" ? [base] : [];
  });
}

/** Internal page links in rendered HTML that lack the trailing slash (files and "/" excepted). */
function slashless(html: string): string[] {
  return [...html.matchAll(/href="(\/[^"#?]*)([#?][^"]*)?"/g)]
    .map((m) => m[1] ?? "")
    .filter((path) => path !== "/" && !/\.[a-z0-9]+$/i.test(path) && !path.endsWith("/"));
}

describe("lab and embed pages link to pages with the trailing slash", () => {
  test("the detector flags a slashless page link and passes files, anchors and slashed links", () => {
    expect(slashless('<a href="/lab/lq-06">')).toEqual(["/lab/lq-06"]);
    expect(slashless('<a href="/lab/light-thread?lt=1&amp;beta=0.6">')).toEqual([
      "/lab/light-thread",
    ]);
    expect(
      slashless('<a href="/lab/lq-06/"><a href="/papers/x/#s2"><a href="/print.css"><a href="/">'),
    ).toEqual([]);
  });

  test("no rendered internal page link on a lab or embed page lacks the trailing slash", async () => {
    const routes = [...pages(`${APP}lab/`, "lab/"), ...pages(`${APP}embed/`, "embed/")].sort();
    const found: string[] = [];
    let renders = 0;
    let links = 0;
    for (const rel of routes) {
      const mod = await import(`${APP}${rel}page.tsx`);
      const list: object[] =
        rel.includes("[") && mod.generateStaticParams ? await mod.generateStaticParams() : [{}];
      for (const params of list) {
        const out = mod.default({
          searchParams: Promise.resolve({}),
          params: Promise.resolve(params),
        });
        const html = await exportMarkup(out instanceof Promise ? await out : out);
        renders += 1;
        links += [...html.matchAll(/href="\/[^"]/g)].length;
        for (const path of slashless(html)) found.push(`${rel} -> ${path}`);
      }
    }
    console.log(
      `[trailing slash] ${renders} renders, ${links} internal links, ${found.length} slashless`,
    );
    expect(renders).toBeGreaterThan(60);
    expect([...new Set(found)]).toEqual([]);
  });
});
