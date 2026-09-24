import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import TracerPage from "../app/lab/bm-01/page.tsx";
import { loadPaper } from "../content/server";
import { exportMarkup } from "../testing/exportMarkup.ts";
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
/** The tracer laboratory shows the equations bound to one of its outputs, and only those. */
const LAB_RECORD_IDS = RECORDS.filter((r) => r.bindings.some((b) => b.experimentId === "bm-01"))
  .map((r) => r.id)
  .sort();
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

  test("whole-paper page: no card is server-rendered; every argument's explorer loads on opening (AC3)", async () => {
    // Both kinds of card load on opening here: the reading's through "Explore the equations in this
    // step", the laboratory's with the tracer ensemble itself ("the Brownian reading mounts its
    // tracer laboratory on first opening"). So the page carries no card to collide.
    const html = await exportMarkup(await PaperReader());
    expect(extractEquationIds(html)).toEqual([]);
    expect(extractChipNavLabels(html)).toEqual([]);

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
      message: `whole-paper page: 0 server-rendered cards; ${lazy.length} argument explorers load on opening`,
    });
  });

  test("every section page: its reading cards, each id and chip name once (AC3)", async () => {
    const { paper, arguments: args } = await loadPaper("brownian-motion");
    expect(paper.sections.length).toBeGreaterThan(0);
    let readingCards = 0;
    for (const section of paper.sections) {
      const html = await exportMarkup(await PaperReader({ section: section.id }));
      const expected = readingIdsFor(args.filter((a) => a.section === section.id).map((a) => a.id));
      const result = assertEquationIdUniqueness(html, expected);
      expect(result.ids.sort()).toEqual([...expected].sort());
      assertChipNavUniqueness(html, expected.length);
      readingCards += expected.length;
    }
    // Non-vacuity: the sections between them server-render every record's reading card.
    expect(readingCards).toBe(RECORDS.length);

    logger.log({
      testId: "paper-reader-nav-label-uniqueness",
      beadId: "am-txy3",
      outcome: "passed",
      message: `${paper.sections.length} section pages: ${readingCards} reading cards, ids and chip names unique`,
    });
  });

  test("planted negative: duplicate data-equation-id is rejected", () => {
    const plantedDuplicateHtml = `
      <div data-equation-id="eq-model-bm-apparent-speed"></div>
      <div data-equation-id="eq-model-bm-diffusivity"></div>
      <div data-equation-id="eq-model-bm-apparent-speed"></div>
    `;
    expect(() => assertEquationIdUniqueness(plantedDuplicateHtml, LAB_RECORD_IDS)).toThrow(
      /Duplicate data-equation-id attributes found: eq-model-bm-apparent-speed/,
    );
  });

  test("planted negative: a laboratory showing every record is rejected", () => {
    const plantedAll = RECORDS.map((r) => `<div data-equation-id="${r.id}"></div>`).join("");
    expect(() => assertEquationIdUniqueness(plantedAll, LAB_RECORD_IDS)).toThrow(
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

  test("/lab/bm-01/ shows the bound equations, each once (AC5)", () => {
    const tracerHtml = renderToStaticMarkup(TracerPage());
    const result = assertEquationIdUniqueness(tracerHtml, LAB_RECORD_IDS);
    expect(result.ids.sort()).toEqual(LAB_RECORD_IDS);
    assertChipNavUniqueness(tracerHtml, LAB_RECORD_IDS.length);

    logger.log({
      testId: "cross-route-equation-counts",
      beadId: "am-txy3",
      outcome: "passed",
      message: `/lab/bm-01/ shows the ${LAB_RECORD_IDS.length} bound equations once each; /papers/brownian-motion/ server-renders none`,
    });
  });
});
