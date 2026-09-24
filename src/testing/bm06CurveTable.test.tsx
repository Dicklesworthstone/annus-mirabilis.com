import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BrownianLab } from "../components/lab/BrownianLab.tsx";
import { BM06_DEFAULTS } from "../experiments/bm06/definition.ts";
import { encodeResult } from "../experiments/results/codec.ts";
import example from "../generated/bm06-example.json";
import { evaluateBm06 } from "../workers/operations/bm06.ts";

/**
 * am-a11y-graph-descriptions-vxe1, layer three on a reader page: BM-06's density curve as numbers.
 * The drawing's description gave only the peak, so a reader who cannot see the curve could not read
 * its shape. These are properties of a Gaussian and of the table, not a census of its rows.
 */
describe("BM-06 reads its density curve as numbers", () => {
  const html = renderToStaticMarkup(<BrownianLab example={example} />);
  const start = html.indexOf("<caption>The accepted density at the plotted points");
  const table = start < 0 ? "" : html.slice(start, html.indexOf("</table>", start));
  const rows = [
    ...table.matchAll(/<tr><th scope="row">([^<]+)<\/th>((?:<td>[^<]*<\/td>)+)<\/tr>/g),
  ].map((m) => ({
    spread: m[1] ?? "",
    cells: [...(m[2] ?? "").matchAll(/<td>([^<]*)<\/td>/g)].map((c) => c[1] ?? ""),
  }));
  const at = (spread: string) => rows.find((r) => r.spread === spread);

  test("the table is in the page's HTML, in a disclosure, with more than a handful of points", () => {
    expect(table).not.toBe("");
    expect(html).toContain("<summary>Read the curve as numbers, at ");
    expect(rows.length).toBeGreaterThan(8);
  });

  test("the peak is at zero, and the curve falls to e^(-1/2) of it at one RMS distance", () => {
    expect(at("0")?.cells[2]).toBe("100%");
    // A Gaussian's height at one standard deviation is exp(-1/2) = 60.65 % of its peak.
    expect(at("1")?.cells[2]).toBe("60.7%");
    expect(at("−1")?.cells[2]).toBe("60.7%");
    // At two, exp(-2) = 13.53 %.
    expect(at("2")?.cells[2]).toBe("13.5%");
  });

  test("a tail that is small but not zero never reads as 0%", () => {
    // At four RMS distances the height is exp(-8) = 0.034 % of the peak, not nothing.
    expect(at("4")?.cells[2]).toBe("0.034%");
    expect(rows.filter((r) => r.cells[2] === "0%").map((r) => r.spread)).toEqual([]);
  });

  test("the rows are symmetric and ordered from the far left to the far right", () => {
    const spreads = rows.map((r) => Number(r.spread.replace("−", "-")));
    expect(spreads).toEqual([...spreads].sort((a, b) => a - b));
    expect(spreads.at(0)).toBe(-(spreads.at(-1) ?? Number.NaN));
    for (const row of rows) {
      const mirror = at(row.spread.startsWith("−") ? row.spread.slice(1) : `−${row.spread}`);
      if (row.spread === "0") continue;
      expect(mirror?.cells[2]).toBe(row.cells[2]);
    }
  });

  test("at t = 0 the point distribution has no curve, so there is no curve table", async () => {
    // Evaluated by the real owner at t = 0, as scripts/generate-lab.mjs prepares the default.
    const evaluated = await evaluateBm06(
      { ...BM06_DEFAULTS, t: 0 },
      { yieldControl: async () => {} },
    );
    if (evaluated.kind !== "accepted") throw new TypeError("BM-06 refused t = 0");
    const pointHtml = renderToStaticMarkup(
      <BrownianLab
        example={{
          ...example,
          parameters: { ...BM06_DEFAULTS, t: 0 },
          stepIndex: evaluated.data.stepIndex,
          simulationTime: evaluated.data.simulationTime,
          results: evaluated.data.outputs.map(encodeResult),
        }}
      />,
    );
    expect(pointHtml).toContain('data-result-status="analytic-limit"');
    expect(pointHtml).not.toContain("<caption>The accepted density at the plotted points");
  });
});
