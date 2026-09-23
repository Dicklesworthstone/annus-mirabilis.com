import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { LazyInlineTracerLab } from "./LazyInlineTracerLab.tsx";

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
});
