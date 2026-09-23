import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { installDom, uninstallDom } from "./reactDom.ts";

/**
 * No laboratory page shows a reader a number in JavaScript's e-notation.
 *
 * toString, toFixed, toPrecision and toExponential all write "1.3806e-23" once a value leaves their
 * range, and each lab formats with one of them somewhere. On 2026-09-23 the default renders still
 * carried "Inferred h … 6.39268e-34 ± 2.02661e-35 J s" (lq-08/data, 08bb627b) and "Boltzmann
 * constant 1.3806e-23 J/K" (bm-01, 3a75ad4e), after the extreme-input fixes had removed others.
 *
 * Text a reader types or a program printed is marked as such and is not counted: <kbd> (the shelf
 * labs' "type 10⁻⁹ as 1e-9"), <samp> (countermodels' full-precision readouts), <code>, <pre>,
 * <textarea>, and KaTeX's MathML. This covers each page's default state; a value reached only by
 * typing is the extreme-input sweep's job, not this test's.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LAB = join(ROOT, "src", "app", "lab");
const E_NOTATION = /\b\d(?:\.\d+)?e[+-]?\d+\b/g;
const NOT_READER_PROSE = "code, pre, kbd, samp, textarea, script, style, math, .katex-mathml";

function labRoutes(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (!statSync(path).isDirectory()) continue;
    if (existsSync(join(path, "page.tsx"))) out.push(relative(LAB, path));
    labRoutes(path, out);
  }
  return out.sort();
}

/** The page's visible text, without the elements that hold machine or typed text. */
async function readerText(route: string): Promise<string> {
  const mod = (await import(join(LAB, route, "page.tsx"))) as {
    default: (props: Record<string, unknown>) => unknown;
  };
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    (await mod.default({ params: Promise.resolve({}) })) as never,
  ).replace(/<noscript>[\s\S]*?<\/noscript>/g, "");
  for (const el of Array.from(host.querySelectorAll(NOT_READER_PROSE))) el.remove();
  // Text nodes joined with spaces, not textContent: textContent runs a <dt> into its <dd>
  // ("Boltzmann constant1.3806e-23"), and the leading \b of the pattern then never matches, which
  // let a planted leak on bm-01 pass.
  const parts: string[] = [];
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode())
    parts.push(node.textContent ?? "");
  return parts.join(" ");
}

describe("no laboratory page shows e-notation to a reader", () => {
  beforeAll(async () => {
    await installDom();
  });
  afterAll(async () => {
    await uninstallDom();
  });

  const routes = labRoutes(LAB);

  test("the population is every lab route, and it is not empty", () => {
    // 45 routes on 2026-09-23. Asserted as a floor with named members, not a count: a lab added
    // later joins the population, and an empty one would pass every case below.
    expect(routes.length).toBeGreaterThan(30);
    expect(routes).toContain("bm-01");
    expect(routes).toContain("lq-08/data");
  });

  for (const route of routes) {
    test(route, async () => {
      const text = await readerText(route);
      expect(text.length).toBeGreaterThan(500);
      const leaks = [...text.matchAll(E_NOTATION)].map((m) =>
        text.slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + m[0].length).trim(),
      );
      expect(leaks).toEqual([]);
    });
  }
});
