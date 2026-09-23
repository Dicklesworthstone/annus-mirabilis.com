import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import TracerPage from "../app/lab/bm-01/page.tsx";
import { loadPaper } from "../content/server";
import { getLogger } from "../testing/log/logger.ts";
import { PaperReader } from "./PaperReader.tsx";

const logger = getLogger("paper-reader-equations");

/*
  THE EXPECTED IDS COME FROM THE RECORDS, not from a frozen list. This file used to pin six ids and
  six chip names; nine Brownian records took the page to 24 and turned it red while the property it
  guards (no card on a page shares an id or a chip-nav name with another) still held. The census
  moved to the containers: the records directory says which equations exist, their bindings say
  which the tracer laboratory shows, and the compiled outline says which arguments a section holds.
*/
type RecordFile = { id: string; argument: string; bindings: readonly { experimentId: string }[] };
const RECORDS: readonly RecordFile[] = readdirSync(
  new URL("../../content/equations/brownian-motion/", import.meta.url),
)
  .filter((f) => f.endsWith(".json"))
  .map((f) =>
    JSON.parse(
      readFileSync(
        new URL(`../../content/equations/brownian-motion/${f}`, import.meta.url),
        "utf8",
      ),
    ),
  );
/** The laboratory shows the equations bound to one of its outputs, and only those. */
const LAB_RECORD_IDS = RECORDS.filter((r) => r.bindings.some((b) => b.experimentId === "bm-01"))
  .map((r) => r.id)
  .sort();
const LAB_IDS = LAB_RECORD_IDS.map((id) => `${id}-lab`);
/** Section pages server-render each argument's cards, scoped to that argument. */
const readingIdsFor = (argumentIds: readonly string[]) =>
  RECORDS.filter((r) => argumentIds.includes(r.argument))
    .map((r) => `${r.id}-reader-${r.argument}`)
    .sort();

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
  test("non-vacuity: the laboratory shows some records and leaves others to the reading", () => {
    // Identity, not census: the three bound records are permanent, and the (A+B)^2 identity is
    // a reading step no laboratory output can fill.
    expect(LAB_RECORD_IDS).toEqual([
      "eq-model-bm-apparent-speed",
      "eq-model-bm-diffusivity",
      "eq-model-bm-rms",
    ]);
    expect(RECORDS.some((r) => r.id === "eq-model-bm-square-of-sum")).toBe(true);
    expect(LAB_RECORD_IDS).not.toContain("eq-model-bm-square-of-sum");
  });

  test("whole-paper page: the laboratory's cards only, each id and chip name once; the reading's load on opening (AC3)", async () => {
    const html = renderToStaticMarkup(await PaperReader());
    const result = assertEquationIdUniqueness(html, LAB_IDS);
    expect(result.ids.sort()).toEqual([...LAB_IDS].sort());
    const navs = assertChipNavUniqueness(html, LAB_IDS.length);
    expect(navs.labels.every((l) => l.endsWith("(laboratory model)"))).toBe(true);

    // Every argument with records keeps its explorer, as a disclosure that loads on opening.
    const withRecords = [...new Set(RECORDS.map((r) => r.argument))].sort();
    const lazy = [
      ...html.matchAll(/data-argument-equations="([^"]+)"[^>]*data-equations-loaded="false"/g),
    ]
      .map((m) => m[1])
      .sort();
    expect(withRecords.length).toBeGreaterThan(0);
    expect(lazy).toEqual(withRecords);

    logger.log({
      testId: "paper-reader-equation-id-uniqueness",
      beadId: "am-txy3",
      outcome: "passed",
      message: `whole-paper page: ${result.count} laboratory cards, unique; ${lazy.length} argument explorers load on opening`,
    });
  });

  test("every section page: reading and laboratory cards never share an id or a chip name (AC3)", async () => {
    const { paper, arguments: args } = await loadPaper("brownian-motion");
    expect(paper.sections.length).toBeGreaterThan(0);
    let readingCards = 0;
    for (const section of paper.sections) {
      const html = renderToStaticMarkup(await PaperReader({ section: section.id }));
      const reading = readingIdsFor(args.filter((a) => a.section === section.id).map((a) => a.id));
      const expected = [...reading, ...LAB_IDS];
      const result = assertEquationIdUniqueness(html, expected);
      expect(result.ids.sort()).toEqual([...expected].sort());
      const navs = assertChipNavUniqueness(html, expected.length);
      expect(navs.labels.filter((l) => l.endsWith("(laboratory model)")).length).toBe(
        LAB_IDS.length,
      );
      readingCards += reading.length;
    }
    // Non-vacuity: the sections between them server-render every record's reading card.
    expect(readingCards).toBe(RECORDS.length);

    logger.log({
      testId: "paper-reader-nav-label-uniqueness",
      beadId: "am-txy3",
      outcome: "passed",
      message: `${paper.sections.length} section pages: ${readingCards} reading cards and ${LAB_IDS.length} laboratory cards each, ids and chip names unique`,
    });
  });

  test("planted negative: duplicate data-equation-id is rejected", () => {
    const plantedDuplicateHtml = `
      <div data-equation-id="eq-model-bm-apparent-speed-lab"></div>
      <div data-equation-id="eq-model-bm-diffusivity-lab"></div>
      <div data-equation-id="eq-model-bm-apparent-speed-lab"></div>
    `;
    expect(() => assertEquationIdUniqueness(plantedDuplicateHtml, LAB_IDS)).toThrow(
      /Duplicate data-equation-id attributes found: eq-model-bm-apparent-speed-lab/,
    );
  });

  test("planted negative: a laboratory showing every record is rejected", () => {
    const plantedAll = RECORDS.map((r) => `<div data-equation-id="${r.id}-lab"></div>`).join("");
    expect(() => assertEquationIdUniqueness(plantedAll, LAB_IDS)).toThrow(
      /Expected exactly 3 data-equation-id attributes/,
    );
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

  test("the paper's laboratory and /lab/bm-01/ show the same equations, each once (AC5)", async () => {
    const readerIds = extractEquationIds(renderToStaticMarkup(await PaperReader()));
    const tracerHtml = renderToStaticMarkup(TracerPage());
    const tracerIds = extractEquationIds(tracerHtml);
    const tracerNavs = extractChipNavLabels(tracerHtml);

    expect(new Set(tracerIds).size).toBe(tracerIds.length);
    expect(new Set(tracerNavs).size).toBe(tracerNavs.length);
    expect([...tracerIds].sort()).toEqual(LAB_RECORD_IDS);
    expect(readerIds.map((id) => id.replace(/-lab$/, "")).sort()).toEqual(LAB_RECORD_IDS);

    logger.log({
      testId: "cross-route-equation-counts",
      beadId: "am-txy3",
      outcome: "passed",
      message: `/papers/brownian-motion/ and /lab/bm-01/ each show the ${LAB_RECORD_IDS.length} bound equations once`,
    });
  });
});
