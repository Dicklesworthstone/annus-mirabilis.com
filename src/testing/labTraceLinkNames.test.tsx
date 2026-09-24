import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exportMarkup } from "./exportMarkup.ts";

/**
 * A worked trace's operation link is named by what a reader sees. Each row of a "Show the code"
 * trace that carries an operation links to that operation in the equation. Measured on live
 * /lab/bm-01/ on 2026-09-24, all four such links were named "Operation explanation for
 * eq-model-bm-diffusivity.op.drag" and the like: an aria-label holding a record id replaced the
 * visible "6 π η a", so a screen reader heard the id, and the visible text was not in the name
 * (WCAG 2.5.3, label in name).
 *
 * Rendered as readers get the pages, as labFragmentLinks.test.tsx does. src/content/kernel/trace.ts
 * has a second, string renderer of the same table; no page calls it, so it is not checked here.
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
  s
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ");

type OpLink = Readonly<{ opId: string; attributes: string; visible: string; name: string }>;

/** The operation links in a page's trace rows: the link's attributes, visible text and name. */
export function traceOpLinks(html: string): OpLink[] {
  return [...html.matchAll(/<tr\b[^>]*\bdata-op-id="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)].flatMap(
    (row) =>
      [...(row[2] ?? "").matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((a) => {
        const inner = a[2] ?? "";
        return {
          opId: decode(row[1] ?? ""),
          attributes: a[1] ?? "",
          visible: text(
            inner.replace(/<span class="visually-hidden">[\s\S]*?<\/span>/g, ""),
          ).trim(),
          name: text(inner).trim(),
        };
      }),
  );
}

/** What is wrong with one link's name, or nothing. */
export function nameProblems(link: OpLink): string[] {
  const problems: string[] = [];
  if (/\baria-label(ledby)?=/.test(link.attributes))
    problems.push("an aria-label replaces the visible text");
  if (!link.visible) problems.push("no visible text");
  if (!link.name.startsWith(link.visible)) problems.push("the name does not begin with the text");
  if (link.name.includes(link.opId)) problems.push("the name holds the record id");
  return problems;
}

describe("worked-trace operation links are named by what a reader sees", () => {
  test("the check finds the defect as it shipped, and passes the repair", () => {
    const shipped =
      '<tr data-op-id="eq-x.op.drag"><th scope="row">F</th><td><a href="#eq-x.op.drag" aria-label="Operation explanation for eq-x.op.drag">6 π η a</a></td></tr>';
    const [before] = traceOpLinks(shipped);
    expect(before && nameProblems(before)).toEqual(["an aria-label replaces the visible text"]);
    const idInText =
      '<tr data-op-id="eq-x.op.drag"><td><a href="#eq-x.op.drag">6 π η a<span class="visually-hidden"> eq-x.op.drag</span></a></td></tr>';
    const [leaky] = traceOpLinks(idInText);
    expect(leaky && nameProblems(leaky)).toEqual(["the name holds the record id"]);
    const repaired =
      '<tr data-op-id="eq-x.op.drag"><td><a href="#eq-x.op.drag">6 π η a<span class="visually-hidden"> (this operation in the equation)</span></a></td></tr>';
    const [after] = traceOpLinks(repaired);
    expect(after && nameProblems(after)).toEqual([]);
    expect(after?.visible).toBe("6 π η a");
  });

  test("on every lab and embed page, each trace operation link is named by its expression", async () => {
    const routes = [...pages(`${APP}lab/`, "lab/"), ...pages(`${APP}embed/`, "embed/")].sort();
    const found: string[] = [];
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
        for (const link of traceOpLinks(html)) {
          links += 1;
          for (const problem of nameProblems(link))
            found.push(`${rel}${JSON.stringify(params)} #${link.opId}: ${problem}`);
        }
      }
    }
    console.log(`[trace links] ${routes.length} routes, ${links} operation links`);
    // BM-01's trace has four; the page must still render them, or this passes on nothing.
    expect(links).toBeGreaterThan(0);
    expect([...new Set(found)]).toEqual([]);
  });
});
