import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatDimension, generateMarkdown } from "../../../scripts/generate-quantity-ids.ts";
import { getQuantityRegistry } from "./registry.ts";
import { getLegacySpellings } from "./resolveQuantityId.ts";

describe("quantityIdsDoc (am-not-quantity-registry-2f7 Test Plan)", () => {
  const docPath = join(process.cwd(), "docs/QUANTITY_IDS.md");
  const committedDoc = readFileSync(docPath, "utf8");
  const registry = getQuantityRegistry();
  const legacySpellings = getLegacySpellings();
  const generated = generateMarkdown(registry, legacySpellings);

  test("regenerating docs/QUANTITY_IDS.md from the records reproduces the committed file byte for byte", () => {
    expect(generated).toBe(committedDoc);
  });

  test("every legacy spelling appears beside its canonical id in docs/QUANTITY_IDS.md", () => {
    for (const entry of legacySpellings.values()) {
      for (const canonicalId of entry.canonicalIds) {
        // Find the line for canonicalId
        const pattern = new RegExp(
          `\\| ${canonicalId} \\|[^|]+\\|[^|]+\\|[^|]+\\|[^|]+\\|([^|]+)\\|`,
        );
        const match = pattern.exec(committedDoc);
        expect(match).not.toBeNull();
        if (match?.[1]) {
          expect(match[1]).toContain(entry.spelling);
        }
      }
    }
  });

  test("every registered quantity has a row in the markdown table", () => {
    for (const id of registry.ids) {
      expect(committedDoc).toContain(`| ${id} |`);
    }
  });
});

test("a quantity the source names without defining says so in the dimension column (dispatch 236)", () => {
  const base = { id: "x", name: "x", description: "x", mathematicalKind: "scalar" } as const;
  // Each status prints its own word, so the document never shows a bare dash for a reason.
  const label = (q: Record<string, unknown>) =>
    formatDimension({ ...base, densityKind: "not-applicable", ...q } as never);
  expect(label({ dimensionStatus: "undefined-in-source" })).toBe("undefined in source");
  expect(label({ dimensionStatus: "state-dependent" })).toBe("symbolic");
  expect(label({ dimensionStatus: "declared" })).toBe("—");
  expect(
    label({
      dimensionStatus: "declared",
      dimension: [1, 0, -1, 0, 0, 0].map((num) => ({ num, den: 1 })),
    }),
  ).not.toBe("—");
});
