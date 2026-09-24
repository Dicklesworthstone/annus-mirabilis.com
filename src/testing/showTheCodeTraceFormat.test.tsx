import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import TracerPage from "../app/lab/bm-01/page.tsx";

/**
 * BM-01's worked trace printed its 60 s coordinate RMS as "0.0000061564 m" one row under
 * "7.9478 × 10⁻⁷ m" (display() uses toPrecision, which keeps decimals down to 10⁻⁶). Values below
 * 10⁻³ in the trace keep their power of ten.
 */
describe("show-the-code trace values", async () => {
  const out = TracerPage();
  const html = renderToStaticMarkup(out instanceof Promise ? await out : out);
  const start = html.indexOf('class="kernel-trace"');
  const table = start < 0 ? "" : html.slice(start, html.indexOf("</table>", start));
  const text = table.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  test("the trace renders, with both coordinate RMS rows", () => {
    expect(table.length).toBeGreaterThan(0);
    expect(text).toContain("7.9478 × 10⁻⁷");
    expect(text).toContain("6.1564 × 10⁻⁶");
  });

  test("no trace value is a long leading-zero decimal", () => {
    expect(text).not.toMatch(/\b0\.000\d/);
  });
});
