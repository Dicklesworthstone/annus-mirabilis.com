/**
 * EVERY ID A HISTORIAN'S MARGIN NAMES RESOLVES TO A RECORD (am-rc1001-bridge-plan-pcjk.30).
 *
 * An r3 is prose, so nothing validated the ids inside it, and the margins name a great many: a
 * receipt's watch items and typographical records, editorial notes, shelf cards, bibliography
 * records and constant sets. A misspelling is a dangling reference the reader meets as prose that
 * points nowhere, and the compiler cannot see it because the field is free text.
 *
 * Measured when this was written, over the 200 margins completed on 2026-10-14: 51 distinct ids
 * named, 51 of them resolving. The check is cheap and the population is real, so it is worth
 * holding.
 *
 * TWO FALSE POSITIVES SHAPED THE PREDICATE, and both are recorded because they are the ways this
 * check can lie rather than fail:
 *
 * - A naive `[a-z]+-\d{4}-...` token starts matching INSIDE a hyphenated name:
 *   `vant-hoff-1887-osmotic-gas-law` was reported as the unresolved `hoff-1887-osmotic-gas-law`.
 *   The token is therefore anchored on a non-hyphen boundary rather than on `\b`.
 * - A population left out reads exactly like a broken reference:
 *   `einstein-1905-light-quanta-printed` is a CONSTANT SET, and omitting
 *   content/quantities/constant-sets from the known ids made two correct margins look wrong.
 */

import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/** Ids a margin may name, gathered from the records that define them. */
export function knownIds(root: string): ReadonlySet<string> {
  const ids = new Set<string>();
  const add = (value: string) => {
    if (value.trim()) ids.add(value.trim());
  };

  const receiptsDir = resolve(root, "docs/provenance");
  if (existsSync(receiptsDir)) {
    for (const file of readdirSync(receiptsDir).filter((f) => f.endsWith(".md"))) {
      const text = readFileSync(join(receiptsDir, file), "utf8");
      for (const m of text.matchAll(/^\s*- id: ((?:watch|typo|err)-[a-z0-9-]+)/gm)) add(m[1] ?? "");
    }
  }
  for (const [dir, suffix] of [
    ["content/editorial-notes", ".json"],
    ["content/bibliography", ".json"],
    ["content/quantities/constant-sets", ".yaml"],
  ] as const) {
    const base = resolve(root, dir);
    if (!existsSync(base)) continue;
    const entries = readdirSync(base, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        for (const f of readdirSync(join(base, entry.name)).filter((f) => f.endsWith(suffix))) {
          add(f.slice(0, -suffix.length));
        }
      } else if (entry.name.endsWith(suffix)) {
        add(entry.name.slice(0, -suffix.length));
      }
    }
  }
  const shelves = resolve(root, "src/content");
  if (existsSync(shelves)) {
    for (const file of readdirSync(shelves).filter((f) => f.endsWith("Shelf.ts"))) {
      const text = readFileSync(join(shelves, file), "utf8");
      for (const m of text.matchAll(/id: "([a-z0-9-]+)"/g)) add(m[1] ?? "");
    }
  }
  return ids;
}

/**
 * The ids a margin names. Anchored on a non-hyphen boundary at both ends, so a token cannot start
 * in the middle of `vant-hoff-1887-...`, and a trailing full stop is not part of an id.
 */
const TOKEN =
  /(?<![a-z0-9-])(?:(?:watch|typo|err|note|cit)-[a-z0-9-]+|[a-z]+(?:-[a-z]+)*-\d{4}-[a-z0-9-]+)(?![a-z0-9-])/g;

export function marginReferences(root: string): ReadonlyMap<string, readonly string[]> {
  const found = new Map<string, string[]>();
  const base = resolve(root, "content/equation-explanations");
  if (!existsSync(base)) return found;
  for (const paper of readdirSync(base, { withFileTypes: true })) {
    if (!paper.isDirectory()) continue;
    for (const file of readdirSync(join(base, paper.name)).filter((f) => f.endsWith(".yaml"))) {
      const text = readFileSync(join(base, paper.name, file), "utf8");
      const r3 = /^r3: "(.*)"$/m.exec(text);
      if (!r3) continue;
      for (const match of new Set((r3[1] ?? "").match(TOKEN) ?? [])) {
        const at = `${paper.name}/${file.slice(0, -5)}`;
        found.set(match, [...(found.get(match) ?? []), at]);
      }
    }
  }
  return found;
}

const ROOT = process.cwd();

describe("the ids a historian's margin names", () => {
  test("every one of them resolves to a record, and the census says how many were read", () => {
    const known = knownIds(ROOT);
    const named = marginReferences(ROOT);
    const unresolved = [...named.entries()].filter(([id]) => !known.has(id));
    console.log(
      `[margin references] ${named.size} distinct ids named by the historian's margins, ` +
        `against ${known.size} ids on record; ${unresolved.length} unresolved`,
    );
    expect(
      unresolved.map(([id, where]) => `${id} (named by ${where.join(", ")})`),
      "a margin names an id that no record defines",
    ).toEqual([]);
  });

  test("the check is not vacuous: the margins really do name ids, and the records really exist", () => {
    // 51 ids named and about 400 on record when this was written. Floors, because a reader that
    // found nothing would satisfy the test above by finding nothing to resolve.
    expect(marginReferences(ROOT).size).toBeGreaterThanOrEqual(40);
    expect(knownIds(ROOT).size).toBeGreaterThanOrEqual(100);
    // And the two shapes the populations must include, named rather than counted, because leaving
    // either out is what made two correct margins look broken while this was being written.
    const known = knownIds(ROOT);
    expect(known.has("watch-viscosity-k")).toBe(true); // a receipt's watch item
    expect(known.has("einstein-1905-light-quanta-printed")).toBe(true); // a constant set
    expect(known.has("stokes-1851-sphere-drag")).toBe(true); // a shelf card
    expect(known.has("typo-phi-argument-p557")).toBe(true); // a receipt's typographical record
  });

  test("PLANTED: a margin naming an id no record defines is reported, with the record that names it", () => {
    const root = mkdtempSync(join(tmpdir(), "margin-refs-"));
    mkdirSync(join(root, "content/equation-explanations/mass-energy"), { recursive: true });
    mkdirSync(join(root, "content/bibliography"), { recursive: true });
    writeFileSync(join(root, "content/bibliography/cit-real-1905.json"), "{}\n");
    writeFileSync(
      join(root, "content/equation-explanations/mass-energy/eq-s0-d1.yaml"),
      'display: eq-s0-d1\nr3: "Grounded in cit-real-1905 and in watch-not-a-real-item."\n',
    );
    const known = knownIds(root);
    const named = marginReferences(root);
    // Print what landed before reading the verdict: a plant that did not parse proves nothing.
    expect([...named.keys()].sort()).toEqual(["cit-real-1905", "watch-not-a-real-item"]);
    const unresolved = [...named.entries()].filter(([id]) => !known.has(id));
    expect(unresolved.map(([id]) => id)).toEqual(["watch-not-a-real-item"]);
    expect(unresolved[0]?.[1]).toEqual(["mass-energy/eq-s0-d1"]);
    // The temp directory is left in place; nothing here deletes a file.
  });

  test("the anchoring the false positive taught: a token cannot start inside a hyphenated name", () => {
    const root = mkdtempSync(join(tmpdir(), "margin-refs-anchor-"));
    mkdirSync(join(root, "content/equation-explanations/brownian-motion"), { recursive: true });
    writeFileSync(
      join(root, "content/equation-explanations/brownian-motion/eq-s1-d1.yaml"),
      "display: eq-s1-d1\nr3: \"The law is van 't Hoff's (vant-hoff-1887-osmotic-gas-law), and the trailing stop is not part of cit-perrin-1909.\"\n",
    );
    const named = [...marginReferences(root).keys()].sort();
    expect(named).toEqual(["cit-perrin-1909", "vant-hoff-1887-osmotic-gas-law"]);
  });
});
