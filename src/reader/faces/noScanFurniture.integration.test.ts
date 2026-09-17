import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FIXTURE_BROWNIAN_ALIGNMENT,
  FIXTURE_BROWNIAN_PAPER,
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  FIXTURE_BROWNIAN_TRANSLATION_UNITS,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { GermanFace } from "./GermanFace.tsx";
import { checkNoScanFurniture } from "./noScanFurniture.ts";
import { ParallelFace } from "./ParallelFace.tsx";

describe("noScanFurniture integration tests", () => {
  test("rendered GermanFace contains no forbidden scan furniture or ledger markers", () => {
    const html = renderToStaticMarkup(
      createElement(GermanFace, {
        paper: FIXTURE_BROWNIAN_PAPER,
        blocks: FIXTURE_BROWNIAN_SOURCE_BLOCKS,
        alignment: FIXTURE_BROWNIAN_ALIGNMENT,
      }),
    );

    const result = checkNoScanFurniture(html);
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test("rendered ParallelFace contains no forbidden scan furniture", () => {
    const html = renderToStaticMarkup(
      createElement(ParallelFace, {
        paper: FIXTURE_BROWNIAN_PAPER,
        blocks: FIXTURE_BROWNIAN_SOURCE_BLOCKS,
        units: FIXTURE_BROWNIAN_TRANSLATION_UNITS,
        alignment: FIXTURE_BROWNIAN_ALIGNMENT,
      }),
    );

    const result = checkNoScanFurniture(html);
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test("seeded scan furniture marker triggers violation failure", () => {
    const dirtyHtml = "<div><p>Normal text</p>[BEGIN_CHUNK]556[/BEGIN_CHUNK]</div>";
    const result = checkNoScanFurniture(dirtyHtml);
    expect(result.ok).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]).toContain("[BEGIN_CHUNK]");
  });

  test("seeded OCR_PAGE_MARKER or PAGE_BREAK triggers violation", () => {
    const dirtyHtml = "<div><<<PAGE_BREAK>>></div>";
    const result = checkNoScanFurniture(dirtyHtml);
    expect(result.ok).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});
