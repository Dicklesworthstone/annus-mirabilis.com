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
    expect(html).toContain('<div data-reading="2" hidden="" class="reading-version">');
    expect(html).toContain('<aside class="modern-margin" data-reading="3" hidden="">');
  });

  test("equation unit emits semantic structure within the passage unit", async () => {
    const page = await PaperReader({ section: "s4" });
    const html = renderToStaticMarkup(page);

    // Semantic equations rendered within the passage
    expect(html).toContain("semantic-equation");
    expect(html).toContain('data-equation-id="eq-model-bm-apparent-speed"');
  });

  test("no-JS per-unit expansion exists as a static disclosure", async () => {
    const page = await PaperReader({ section: "s4" });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('<details class="local-steps">');
    expect(html).toContain("<summary>Show every step here:");
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
    expect(html).toContain('<aside class="modern-margin" data-reading="3" hidden="">');

    // Content from readings-owners manifest is preserved
    expect(html).toContain(target.readings.r0);
    expect(html).toContain(target.readings.r1);
    expect(html).toContain(target.readings.r2);
    expect(html).toContain(target.readings.r3.replaceAll("'", "&#x27;"));
  });
});
