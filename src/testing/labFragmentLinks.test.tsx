import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exportMarkup } from "./exportMarkup.ts";

/**
 * An in-page link (href="#x") on a lab or embed page lands on an element with id="x" in the same
 * page. A sweep of every live page on 2026-09-24 found 1,050 fragment links, and 7 of 687 distinct
 * targets missing, all from ShowTheCode:
 *
 * - "Show the code" in the model note of BM-01, BM-05, BM-06 and the Brownian investigation
 *   linked to #stc-<uid>, but ShowTheCode gave its root no id, only its sub-sections;
 * - the worked trace on BM-01 linked each operation to #<operation id>, which no element carried.
 *
 * Rendered as readers get the pages, as labLinksTrailingSlash.test.tsx does, so an id built in a
 * helper or a template literal is checked where it lands.
 */
const APP = fileURLToPath(new URL("../app/", import.meta.url));

function pages(dir: string, base: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}${name}`;
    if (statSync(full).isDirectory()) return pages(`${full}/`, `${base}${name}/`);
    return name === "page.tsx" ? [base] : [];
  });
}

const decode = (s: string) =>
  s.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'");

/** Fragment links in `html` whose target id is not in `html`. */
export function unresolvedFragments(html: string): string[] {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => decode(m[1] ?? "")));
  return [...html.matchAll(/href="#([^"]+)"/g)]
    .map((m) => decode(m[1] ?? ""))
    .filter((target) => !ids.has(target));
}

describe("in-page links on lab and embed pages land on an element", () => {
  test("the detector finds a link with no target and passes one with a target", () => {
    expect(unresolvedFragments('<a href="#stc-x">Show the code</a><details class="s">')).toEqual([
      "stc-x",
    ]);
    expect(unresolvedFragments('<a href="#stc-x">Show</a><details id="stc-x">')).toEqual([]);
    expect(
      unresolvedFragments('<a href="#eq.op.a&amp;b">x</a><button id="eq.op.a&amp;b">'),
    ).toEqual([]);
  });

  test("every fragment link on every lab and embed page resolves in the same page", async () => {
    const routes = [...pages(`${APP}lab/`, "lab/"), ...pages(`${APP}embed/`, "embed/")].sort();
    const found: string[] = [];
    let renders = 0;
    let fragments = 0;
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
        fragments += [...html.matchAll(/href="#/g)].length;
        for (const target of unresolvedFragments(html))
          found.push(`${rel}${JSON.stringify(params)} -> #${target}`);
      }
    }
    console.log(
      `[fragments] ${renders} renders, ${fragments} fragment links, ${found.length} unresolved`,
    );
    expect(renders).toBeGreaterThan(60);
    expect(fragments).toBeGreaterThan(0);
    expect([...new Set(found)]).toEqual([]);
  });
});
