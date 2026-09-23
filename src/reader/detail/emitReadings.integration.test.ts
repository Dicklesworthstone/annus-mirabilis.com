import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { PaperPage } from "../PaperPage.tsx";
import { PaperReader } from "../PaperReader.tsx";
import { type CaptionReadingSet, CaptionReadingUnit } from "./CaptionReadingUnit.tsx";

describe("emitReadings.integration (am-read-detail-axis-sfc)", () => {
  test("paragraph unit contains exactly four readings with R1 visible and R0, R2, R3 hidden", async () => {
    const page = await PaperReader({ section: "s4" });
    const html = renderToStaticMarkup(page);

    // Verify unit container
    expect(html).toContain('data-unit="arg-bm-observable"');

    // Verify readings R0 to R3
    expect(html).toContain('<div data-reading="0" hidden="" class="reading-version">');
    expect(html).toContain('<div data-reading="1" class="reading-version">');
    // R2 once, as the closed per-passage disclosure (see staticReadings.test.tsx).
    expect(html).toContain('<details class="local-steps reading-version" data-reading="2">');
    expect(html).not.toContain('<div data-reading="2"');
    // R3 is present and hidden. Its class list is presentation, not the contract: 9a4c224a added
    // callout-limit to the modern margin and four exact-string checks went red.
    expect(html).toMatch(/<aside\b[^>]*\sdata-reading="3"[^>]*\shidden=""/);
  });

  test("equation unit emits semantic structure within the passage unit", async () => {
    const page = await PaperReader({ section: "s4" });
    const html = renderToStaticMarkup(page);

    // Semantic equations rendered within the passage. A section page scopes each card to its
    // argument (as every paper's reader does), so the id carries the argument; the bare record id
    // this used to name was the Brownian reader's old unscoped card. The card must sit inside its
    // own passage unit, between that unit's opening and the next one.
    expect(html).toContain("semantic-equation");
    const id = 'data-equation-id="eq-model-bm-apparent-speed-reader-arg-bm-observable"';
    const unit = html.indexOf('data-unit="arg-bm-observable"');
    const next = html.indexOf("data-unit=", unit + 1);
    const card = html.indexOf(id);
    expect(unit).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(unit);
    if (next > -1) expect(card).toBeLessThan(next);
  });

  test("no-JS per-unit expansion exists as a static disclosure", async () => {
    const page = await PaperReader({ section: "s4" });
    const html = renderToStaticMarkup(page);

    expect(html).toContain(
      '<details class="local-steps reading-version" data-reading="2"><summary>Show every step here:',
    );
  });

  test("static paper route produces all four readings for each argument unit", async () => {
    const page = await PaperPage({ paperId: "brownian-motion" });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('data-reader-root="true"');
    expect(html).toContain('data-unit="arg-bm-observable"');
    expect(html).toContain('data-reading="0"');
    expect(html).toContain('data-reading="1"');
    expect(html).toContain('data-reading="2"');
    expect(html).toContain('data-reading="3"');
  });

  test("caption unit from instrument manifest emits the same four-reading structure with R1 visible and R0, R2, R3 hidden", () => {
    const manifestPath = resolve(
      process.cwd(),
      "content/editorial/readings-owners/am-bm-01-tracer-ensemble-hdly.yaml",
    );
    const parsed = parseYaml(readFileSync(manifestPath, "utf8")) as {
      targets: Array<{ id: string; kind: string; readings: CaptionReadingSet }>;
    };
    const target = parsed.targets.find((t) => t.id === "bm-01" && t.kind === "caption");
    expect(target).toBeDefined();
    if (!target) throw new Error("target bm-01 missing");

    const html = renderToStaticMarkup(
      createElement(CaptionReadingUnit, {
        id: "bm-01",
        readings: target.readings,
        title: "Tracer ensemble displacement",
      }),
    );

    // Container with unit id
    expect(html).toContain('data-unit="bm-01"');
    expect(html).toContain('id="bm-01"');

    // Title
    expect(html).toContain("Tracer ensemble displacement");

    // All four readings are present
    expect(html).toContain('<div data-reading="0" hidden="" class="reading-version">');
    expect(html).toContain('<div data-reading="1" class="reading-version">');
    expect(html).toContain('<div data-reading="2" hidden="" class="reading-version">');
    // R3 is present and hidden. Its class list is presentation, not the contract: 9a4c224a added
    // callout-limit to the modern margin and four exact-string checks went red.
    expect(html).toMatch(/<aside\b[^>]*\sdata-reading="3"[^>]*\shidden=""/);

    // Content from readings-owners manifest is preserved, as React escapes it. Only R3 used to be
    // escaped here, so an apostrophe in any other reading failed the check (bm-01's R1, 2f685a94).
    const escaped = (text: string) =>
      text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#x27;");
    expect(html).toContain(escaped(target.readings.r0));
    expect(html).toContain(escaped(target.readings.r1));
    expect(html).toContain(escaped(target.readings.r2));
    expect(html).toContain(escaped(target.readings.r3));
  });
});
