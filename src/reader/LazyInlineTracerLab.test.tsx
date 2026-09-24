import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { LazyInlineTracerLab } from "./LazyInlineTracerLab.tsx";
import { PaperReader } from "./PaperReader.tsx";

describe("LazyInlineTracerLab", () => {
  const html = renderToStaticMarkup(<LazyInlineTracerLab />);

  test("the served markup is the disclosure and a real link, with no laboratory in it", () => {
    expect(html).toContain("<summary>Open the tracer ensemble in this reading</summary>");
    expect(html).toContain('href="/lab/bm-01/"');
    expect(html).toContain('data-inline-lab-mounted="false"');
    // What the eager version served: the laboratory section and its prepared tracer endpoints.
    expect(html).not.toContain('data-instrument-id="bm-01"');
    expect(html).not.toContain("tracerPositions");
    expect(html.length).toBeLessThan(1000);
  });

  test("the laboratory and its example are imported lazily, never statically", () => {
    // Import declarations only, so the prose above them (which names both) cannot satisfy or
    // trip the check.
    const source = readFileSync(new URL("./LazyInlineTracerLab.tsx", import.meta.url), "utf8");
    const staticImports = [...source.matchAll(/^import\s[^;]*?from\s+"([^"]+)";/gms)].map(
      (m) => m[1],
    );
    expect(staticImports).toEqual(["react"]);
    expect(source).toMatch(/lazy\(\(\) => import\("\.\/InlineTracerLab\.tsx"\)\)/);
  });

  test("the Brownian reading serves the disclosure, not the laboratory", async () => {
    // The page this exists for: BUILD 23 served 229,044 bytes of laboratory markup here.
    const page = await exportMarkup(await PaperReader({}));
    expect(page).toContain('data-inline-lab="bm-01"');
    // A pattern over the tag, not a literal: the laboratory's attributes come first
    // (`<section class="laboratory" aria-labelledby=… data-instrument-id="bm-01"`), so the
    // literal `section data-instrument-id` matched nothing even on BUILD 23's eager page.
    expect(page).not.toMatch(/<section\b[^>]*\bdata-instrument-id="bm-01"/);
    expect(page).not.toContain("tracerPositions");
  });
});
