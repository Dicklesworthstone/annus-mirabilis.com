import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadPerrinSummaryRecord } from "../../experiments/bm07/perrinSummaryRecord.ts";
import type { PreparedBm07Example } from "../../experiments/bm07/session.ts";
import example from "../../generated/bm07-example.json";
import { InferenceLab } from "./InferenceLab.tsx";
import { PerrinSummary } from "./PerrinSummary.tsx";

describe("BM07's measured observation entry points", () => {
  test("the synthetic lab offers working native links in its server HTML", () => {
    const html = renderToStaticMarkup(<InferenceLab example={example as PreparedBm07Example} />);
    expect(html).toContain('href="/lab/bm-07/#perrin-1909"');
    expect(html).toContain('href="/lab/brownian-data/"');
    expect(html).toContain('href="/lab/bm-07/kitchen/"');
    expect(html).not.toContain('<option value="perrin-1909"');
    expect(html).not.toContain('<option value="kitchen"');
    expect(html).not.toContain("waits on the admitted");
    expect(html).not.toContain("this laboratory consumes that session");
  });

  test("the historical section serves the source and apparent diffusivities with no script", () => {
    const html = renderToStaticMarkup(<PerrinSummary record={loadPerrinSummaryRecord()} />);
    expect(html).toContain('id="perrin-1909"');
    expect(html).toContain('data-historical-summary="available"');
    expect(html).toContain("later evidence, published 1909");
    expect(html.match(/data-perrin-observed/g)).toHaveLength(4);
    expect(html.match(/data-perrin-diffusivity/g)).toHaveLength(4);
    for (const value of ["50.2", "113.5", "0.837", "0.946", "0.711", "0.6"]) {
      expect(html).toContain(value);
    }
    expect(html).toContain('data-perrin-interval-status="not-applicable"');
    expect(html).toContain("No molecular number is");
    expect(html).toContain("independent displacement count is unreported");
    expect(html).toContain("#page=75");
    expect(html).toContain('href="/discover/brownian-motion/#step-06"');
    expect(html).not.toContain("<script");
  });

  test("a withdrawn record renders its reason, never a plausible replacement result", () => {
    const html = renderToStaticMarkup(
      <PerrinSummary
        record={{ kind: "withheld", citation: "Perrin, p. 77", reason: "Source withdrawn." }}
      />,
    );
    expect(html).toContain("Source withdrawn.");
    expect(html).toContain("Perrin, p. 77");
    expect(html).not.toContain("data-perrin-diffusivity");
    expect(html).not.toContain("data-perrin-observed");
    expect(html).not.toContain("<table");
  });
});
