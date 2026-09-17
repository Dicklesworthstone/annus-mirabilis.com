import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import TracerPage from "../../app/lab/bm-01/page.tsx";
import { getLogger } from "../../testing/log/logger.ts";

const logger = getLogger("tracer-lab-equations");

const EXPECTED_EQUATION_IDS = [
  "eq-model-bm-apparent-speed",
  "eq-model-bm-diffusivity",
  "eq-model-bm-rms",
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
 * Validates that data-equation-id occurrences are unique and match the expected set.
 * Throws a descriptive error if any duplicate or unexpected equation id is encountered.
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

describe("TracerLab equation uniqueness (am-w7rx)", () => {
  test("TracerPage renders exactly 3 distinct data-equation-id attributes with no duplicates", () => {
    const html = renderToStaticMarkup(<TracerPage />);
    const result = assertEquationIdUniqueness(html, EXPECTED_EQUATION_IDS);

    expect(result.count).toBe(3);
    expect(result.ids.sort()).toEqual([...EXPECTED_EQUATION_IDS].sort());

    // ShowTheCode uses data-equation-ref rather than duplicating data-equation-id
    const refRegex = /data-equation-ref="([^"]+)"/g;
    const refs: string[] = [];
    for (const refMatch of html.matchAll(refRegex)) {
      const ref = refMatch[1];
      if (ref) {
        refs.push(ref);
      }
    }
    expect(refs.sort()).toEqual([...EXPECTED_EQUATION_IDS].sort());

    logger.log({
      testId: "tracer-lab-equation-uniqueness",
      beadId: "am-w7rx",
      outcome: "passed",
      message:
        "TracerPage renders exactly 3 unique data-equation-id attributes; ShowTheCode uses data-equation-ref",
    });
  });

  test("planted negative: duplicate equation id is caught and rejected", () => {
    // Planted copy: 1 duplicate (total 4)
    const plantedDuplicateHtml = `
      <div data-equation-id="eq-model-bm-apparent-speed"></div>
      <div data-equation-id="eq-model-bm-diffusivity"></div>
      <div data-equation-id="eq-model-bm-rms"></div>
      <div data-equation-id="eq-model-bm-rms"></div>
    `;
    expect(() => assertEquationIdUniqueness(plantedDuplicateHtml, EXPECTED_EQUATION_IDS)).toThrow(
      /Duplicate data-equation-id attributes found: eq-model-bm-rms/,
    );

    // Planted copy: regression representation of original bug (2x of each, total 6)
    const originalBugHtml = `
      <div class="semantic-equation" data-equation-id="eq-model-bm-apparent-speed"></div>
      <div class="semantic-equation" data-equation-id="eq-model-bm-diffusivity"></div>
      <div class="semantic-equation" data-equation-id="eq-model-bm-rms"></div>
      <div data-equation-card="" data-equation-id="eq-model-bm-diffusivity"></div>
      <div data-equation-card="" data-equation-id="eq-model-bm-rms"></div>
      <div data-equation-card="" data-equation-id="eq-model-bm-apparent-speed"></div>
    `;
    expect(() => assertEquationIdUniqueness(originalBugHtml, EXPECTED_EQUATION_IDS)).toThrow(
      /Duplicate data-equation-id attributes found/,
    );

    // Planted copy: third copy of an equation (total 7 or 4) is also caught
    const tripleCopyHtml = `
      <div data-equation-id="eq-model-bm-apparent-speed"></div>
      <div data-equation-id="eq-model-bm-apparent-speed"></div>
      <div data-equation-id="eq-model-bm-apparent-speed"></div>
      <div data-equation-id="eq-model-bm-diffusivity"></div>
      <div data-equation-id="eq-model-bm-rms"></div>
    `;
    expect(() => assertEquationIdUniqueness(tripleCopyHtml, EXPECTED_EQUATION_IDS)).toThrow(
      /Duplicate data-equation-id attributes found: eq-model-bm-apparent-speed/,
    );

    logger.log({
      testId: "tracer-lab-equation-planted-negative",
      beadId: "am-w7rx",
      outcome: "passed",
      message:
        "Planted duplicates (2x, 3x, and original bug shape) are strictly caught by assertEquationIdUniqueness",
    });
  });
});
