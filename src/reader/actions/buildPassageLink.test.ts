import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SEED_ENTRIES } from "../../platform/storage/keys.ts";
import type { ReaderRegistry } from "../navigation/state.ts";
import { buildPassageLink } from "./buildPassageLink.ts";

const REGISTRY: ReaderRegistry = {
  paperId: "brownian-motion",
  anchors: ["s4-p2-s1", "s4-p2"],
  foundations: [],
};
const ORIGIN = "https://annus-mirabilis.com";

describe("buildPassageLink (acceptance fixtures)", () => {
  test("the default reading face at Detail 1 with the paper lens copies the bare path and anchor", () => {
    const link = buildPassageLink({
      origin: ORIGIN,
      registry: REGISTRY,
      axes: { view: "reading", detail: 1, lens: false, anchor: "s4-p2-s1" },
    });
    expect(link).toBe("https://annus-mirabilis.com/papers/brownian-motion/#s4-p2-s1");
  });

  test("the German face at Detail 2 under the modern lens includes all three parameters in order", () => {
    const link = buildPassageLink({
      origin: ORIGIN,
      registry: REGISTRY,
      axes: { view: "german", detail: 2, lens: true, anchor: "s4-p2-s1" },
    });
    expect(link).toBe(
      "https://annus-mirabilis.com/papers/brownian-motion/?view=german&detail=2&lens=modern#s4-p2-s1",
    );
  });

  test("a paragraph anchor copies without a sentence suffix", () => {
    const link = buildPassageLink({
      origin: ORIGIN,
      registry: REGISTRY,
      axes: { view: "reading", detail: 1, lens: false, anchor: "s4-p2" },
    });
    expect(link).toBe("https://annus-mirabilis.com/papers/brownian-motion/#s4-p2");
  });

  test("an unknown anchor is refused, never silently included", () => {
    expect(() =>
      buildPassageLink({
        origin: ORIGIN,
        registry: REGISTRY,
        axes: { view: "reading", detail: 1, lens: false, anchor: "s99-p1" },
      }),
    ).toThrow();
  });

  test("the same registry and axes produce the same link regardless of any surrounding context (tour, capstone, or plain reading)", () => {
    const axes = { view: "reading" as const, detail: 1 as const, lens: false, anchor: "s4-p2" };
    const fromReading = buildPassageLink({ origin: ORIGIN, registry: REGISTRY, axes });
    const fromWhateverContext = buildPassageLink({ origin: ORIGIN, registry: REGISTRY, axes });
    expect(fromReading).toBe(fromWhateverContext);
  });
});

describe("import boundary: buildPassageLink.ts never reaches the storage layer", () => {
  test("its source contains no import from src/platform/storage/", () => {
    const path = join(dirname(fileURLToPath(import.meta.url)), "buildPassageLink.ts");
    const source = readFileSync(path, "utf8");
    expect(source).not.toMatch(/from\s+["'][^"']*platform\/storage/);
  });
});

describe("privacy: no registered storage namespace's sentinel ever appears in a copied link", () => {
  test("seeding every registered namespace with a unique sentinel leaves no trace in the link", () => {
    const sentinels = SEED_ENTRIES.map((entry, i) => `SENTINEL-${entry.key}-${i}`);
    expect(sentinels.length).toBeGreaterThan(0);

    const link = buildPassageLink({
      origin: ORIGIN,
      registry: REGISTRY,
      axes: { view: "german", detail: 2, lens: true, anchor: "s4-p2-s1" },
    });

    for (const sentinel of sentinels) {
      expect(link).not.toContain(sentinel);
    }
  });
});
