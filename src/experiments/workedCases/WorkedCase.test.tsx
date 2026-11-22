import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readInstrumentWorkedCase } from "../../../scripts/instrument-worked-case.ts";
import { findWorkedCase, type InstrumentWorkedCaseIndex } from "./types.ts";
import { WorkedCase } from "./WorkedCase.tsx";

function example() {
  return readInstrumentWorkedCase(
    '<section data-instrument-id="bm-06" data-snapshot-version="1" data-accepted-input-revision="0">' +
      '<label for="time">Elapsed time (s)</label><input id="time" value="1"/>' +
      "<table><caption>Prepared probability</caption><tbody><tr><th>Selected interval (μm)</th><td>[−1, 1]</td></tr>" +
      "<tr><th>Probability</th><td>71.94%</td></tr><tr><th>Diffusivity</th><td>4.294 × 10<sup>−13</sup> m²/s</td></tr>" +
      "<tr><th>Unknown value</th><td>Requires a known radius.</td></tr></tbody></table></section>",
    {
      instrumentId: "bm-06",
      mode: null,
      title: "The spreading laboratory",
      notModeled: ["Molecular collisions."],
      sources: [{ href: "/papers/brownian-motion/#s4", label: "Brownian motion, section 4" }],
    },
  );
}

describe("prepared worked-case rendering", () => {
  test("shows an actual fixed example, its settings, units, limits and exact source link", () => {
    const html = renderToStaticMarkup(
      <WorkedCase record={example()} instrumentId="bm-06" mode={null} />,
    );
    expect(html).toContain('data-example-origin="prepared-default"');
    expect(html).toContain("Elapsed time (s)");
    expect(html).toContain("71.94%");
    expect(html).toContain("4.294 × 10<sup>−13</sup> m²/s");
    expect(html).toContain("Requires a known radius.");
    expect(html).toContain("Molecular collisions.");
    expect(html).toContain('href="/papers/brownian-motion/#s4"');
    expect(html).toContain("This example stays fixed");
    expect(html).not.toContain("The static worked case stays in the page");
  });

  test("keeps text inert and does not reinterpret a typed unknown as a numerical zero", () => {
    const record = example();
    expect(record.kind).toBe("prepared");
    if (record.kind !== "prepared") return;
    const html = renderToStaticMarkup(
      <WorkedCase
        record={{ ...record, notes: ['<img src=x onerror="alert(1)">'] }}
        instrumentId="bm-06"
        mode={null}
      />,
    );
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).toContain("Requires a known radius.");
    expect(html).not.toContain("NaN");
  });

  test("unknown or unavailable modes keep a real onward link without borrowing default numbers", () => {
    const record = example();
    const index: InstrumentWorkedCaseIndex = { schemaVersion: 1, cases: { "bm-06": record } };
    expect(findWorkedCase(index, "bm-06:other")).toBeUndefined();
    const html = renderToStaticMarkup(
      <WorkedCase record={record} instrumentId="bm-06" mode="other" />,
    );
    expect(html).toContain("for this mode is not available");
    expect(html).toContain('href="/lab/bm-06/"');
    expect(html).not.toContain("71.94%");
    expect(html).not.toContain("data-prepared-worked-case");
  });
});
