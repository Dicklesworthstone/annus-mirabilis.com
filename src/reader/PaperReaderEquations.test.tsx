import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import TracerPage from "../app/lab/bm-01/page.tsx";
import { getLogger } from "../testing/log/logger.ts";
import { PaperReader } from "./PaperReader.tsx";

const logger = getLogger("paper-reader-equations");

const EXPECTED_READER_EQUATION_IDS = [
  "eq-model-bm-apparent-speed",
  "eq-model-bm-rms",
  "eq-model-bm-diffusivity",
  "eq-model-bm-apparent-speed-lab",
  "eq-model-bm-diffusivity-lab",
  "eq-model-bm-rms-lab",
] as const;

/**
 * Extracts all data-equation-id attribute values from rendered markup.
 */
export function extractEquationIds(html: string): string[] {
  const matches: string[] = [];
  const regex = /data-equation-id="([^"]+)"/g;
  for (const match of html.matchAll(regex)) {
    const id = match[1];
    if (id) {
      matches.push(id);
    }
  }
  return matches;
}

/**
 * Extracts all equation-chips nav landmark accessible names from rendered markup.
 */
export function extractChipNavLabels(html: string): string[] {
  const matches: string[] = [];
  const regex = /<nav\b[^>]*\bclass="[^"]*equation-chips[^"]*"[^>]*\baria-label="([^"]+)"/g;
  for (const match of html.matchAll(regex)) {
    const label = match[1];
    if (label) {
      matches.push(label);
    }
  }
  return matches;
}

/**
 * Asserts that equation ids in html are unique and match expected count/ids.
 */
export function assertEquationIdUniqueness(
  html: string,
  expectedIds: readonly string[],
): { count: number; ids: string[] } {
  const ids = extractEquationIds(html);
  const counts = new Map<string, number>();
  const duplicates: string[] = [];

  for (const id of ids) {
    const current = (counts.get(id) ?? 0) + 1;
    counts.set(id, current);
    if (current === 2) {
      duplicates.push(id);
    }
  }

  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate data-equation-id attributes found: ${duplicates.map((d) => `${d} (${counts.get(d)}x)`).join(", ")}`,
    );
  }

  if (ids.length !== expectedIds.length) {
    throw new Error(
      `Expected exactly ${expectedIds.length} data-equation-id attributes, but found ${ids.length}: [${ids.join(", ")}]`,
    );
  }

  const expectedSet = new Set(expectedIds);
  for (const id of ids) {
    if (!expectedSet.has(id)) {
      throw new Error(`Unexpected data-equation-id found: ${id}`);
    }
  }

  return { count: ids.length, ids };
}

/**
 * Asserts that equation chips nav landmark names are unique and match expected count.
 */
export function assertChipNavUniqueness(
  html: string,
  expectedCount: number,
): { count: number; labels: string[] } {
  const labels = extractChipNavLabels(html);
  const counts = new Map<string, number>();
  const duplicates: string[] = [];

  for (const label of labels) {
    const current = (counts.get(label) ?? 0) + 1;
    counts.set(label, current);
    if (current === 2) {
      duplicates.push(label);
    }
  }

  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate equation-chips nav accessible names found: ${duplicates.map((d) => `"${d}" (${counts.get(d)}x)`).join(", ")}`,
    );
  }

  if (labels.length !== expectedCount) {
    throw new Error(
      `Expected exactly ${expectedCount} equation-chips nav landmarks, but found ${labels.length}: [${labels.join(", ")}]`,
    );
  }

  return { count: labels.length, labels };
}

describe("PaperReader equation disambiguation (am-txy3)", () => {
  test("PaperReader renders exactly 6 distinct data-equation-id attributes with no duplicates (AC3)", async () => {
    const html = renderToStaticMarkup(await PaperReader());
    const result = assertEquationIdUniqueness(html, EXPECTED_READER_EQUATION_IDS);

    expect(result.count).toBe(6);
    expect(result.ids.sort()).toEqual([...EXPECTED_READER_EQUATION_IDS].sort());

    logger.log({
      testId: "paper-reader-equation-id-uniqueness",
      beadId: "am-txy3",
      outcome: "passed",
      message:
        "PaperReader renders exactly 6 unique data-equation-id attributes across reading and laboratory",
    });
  });

  test("PaperReader renders exactly 6 distinct equation-chips nav accessible names (AC3)", async () => {
    const html = renderToStaticMarkup(await PaperReader());
    const result = assertChipNavUniqueness(html, 6);

    expect(result.count).toBe(6);
    const readingLabels = result.labels.filter((l) => l.includes("(reading argument)"));
    const labLabels = result.labels.filter((l) => l.includes("(laboratory model)"));

    expect(readingLabels.length).toBe(3);
    expect(labLabels.length).toBe(3);

    logger.log({
      testId: "paper-reader-nav-label-uniqueness",
      beadId: "am-txy3",
      outcome: "passed",
      message:
        "PaperReader renders 6 equation-chips nav landmarks with mutually unique accessible names (3 reading, 3 lab)",
    });
  });

  test("planted negative: duplicate data-equation-id is rejected", () => {
    const plantedDuplicateHtml = `
      <div data-equation-id="eq-model-bm-apparent-speed"></div>
      <div data-equation-id="eq-model-bm-rms"></div>
      <div data-equation-id="eq-model-bm-diffusivity"></div>
      <div data-equation-id="eq-model-bm-apparent-speed"></div>
      <div data-equation-id="eq-model-bm-diffusivity-lab"></div>
      <div data-equation-id="eq-model-bm-rms-lab"></div>
    `;
    expect(() =>
      assertEquationIdUniqueness(plantedDuplicateHtml, EXPECTED_READER_EQUATION_IDS),
    ).toThrow(/Duplicate data-equation-id attributes found: eq-model-bm-apparent-speed/);
  });

  test("planted negative: duplicate equation-chips nav accessible name is rejected", () => {
    const plantedDuplicateHtml = `
      <nav class="equation-chips" aria-label="Terms and operations in Why the apparent speed depends on how you watch"></nav>
      <nav class="equation-chips" aria-label="Terms and operations in Why the apparent speed depends on how you watch"></nav>
    `;
    expect(() => assertChipNavUniqueness(plantedDuplicateHtml, 2)).toThrow(
      /Duplicate equation-chips nav accessible names found: "Terms and operations in Why the apparent speed depends on how you watch" \(2x\)/,
    );
  });

  test("comparison of equation counts across routes (/papers/brownian-motion/, /lab/bm-01/) (AC5)", async () => {
    const readerHtml = renderToStaticMarkup(await PaperReader());
    const readerEqResult = assertEquationIdUniqueness(readerHtml, EXPECTED_READER_EQUATION_IDS);
    const readerNavResult = assertChipNavUniqueness(readerHtml, 6);

    expect(readerEqResult.count).toBe(6);
    expect(readerNavResult.count).toBe(6);

    const tracerHtml = renderToStaticMarkup(TracerPage());
    const tracerEqIds = extractEquationIds(tracerHtml);
    const tracerNavs = extractChipNavLabels(tracerHtml);

    expect(tracerEqIds.length).toBe(3);
    expect(new Set(tracerEqIds).size).toBe(3);
    expect(tracerNavs.length).toBe(3);
    expect(new Set(tracerNavs).size).toBe(3);

    logger.log({
      testId: "cross-route-equation-counts",
      beadId: "am-txy3",
      outcome: "passed",
      message:
        "/papers/brownian-motion/ has 6 ids (6 distinct) and 6 navs (6 distinct); /lab/bm-01/ has 3 ids (3 distinct) and 3 navs (3 distinct)",
    });
  });
});
