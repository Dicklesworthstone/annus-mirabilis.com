import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { strictParse } from "../content/schemas/strictParse.ts";
import { blankCommentText } from "./refusals/refusalScanner.ts";

/**
 * ONE SOURCE FOR WHAT A MODEL LEAVES OUT (am-rc1001-bridge-plan-pcjk.26).
 *
 * src/testing/notModeledVisible.test.tsx proves every lab PAGE shows its manifest's whole list
 * (33 manifests, 210 items, 210 shown outside a closed disclosure). That is the reader-facing
 * half, and it was already true. This is the other half the bead asks for: "every lab renders
 * notModeled from its manifest through one shared component", which until 2026-10-10 was false
 * for 23 sites -- 21 `src/experiments/<id>/definition.ts` constants, the inline lists inside
 * LQ05_MODEL and LQ07_MODEL, and the arrays in OsmoticPartitionLab and ModeAllocationLab -- each
 * keeping its own copy of the sentences, agreeing with the manifest only because a test made them.
 *
 * THE DRIFT WAS PRICED BEFORE THE MIGRATION, by importing each module rather than grepping it:
 * 21 constants, 18 byte-identical to their manifest, 2 differing only in letter case (lq-03 and
 * sr-04), 1 differing only by a trailing full stop on each item (lq-09), and 0 differing in
 * content or order. Two regex attempts at the same count gave 15 and then 6, which is the reason
 * the number was taken by import: a source pattern measures its own syntax assumptions, not the
 * population.
 *
 * SO THIS ASSERTS ABSENCE, not agreement. Agreement is now true by construction -- every site
 * reads `notModeledFor(labId)` from the generated module -- and what can regress is somebody
 * pasting a literal list back in. An array literal of notModeled sentences is what this forbids,
 * with comments blanked first so a docblock EXPLAINING the old copies does not count as one.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MANIFESTS = join(ROOT, "content/experiments");

/** Every sentence any manifest declares, so a pasted copy is recognised wherever it lands. */
function manifestSentences(): {
  sentences: Set<string>;
  labs: number;
  items: number;
  /** Every item, including the short ones the scan below will not look for. */
  allItems: number;
} {
  const sentences = new Set<string>();
  let labs = 0;
  let items = 0;
  let allItems = 0;
  for (const file of readdirSync(MANIFESTS).filter((f) => f.endsWith(".yaml"))) {
    const manifest = strictParse(readFileSync(join(MANIFESTS, file), "utf8"), "yaml") as {
      notModeled?: unknown;
    } | null;
    const list = manifest?.notModeled;
    if (!Array.isArray(list) || list.length === 0) continue;
    labs += 1;
    allItems += list.length;
    // The scan only looks for items long enough that a literal match means something: "gravity" is
    // seven characters and appears in ordinary prose. The short ones are counted but not hunted, and
    // allItems keeps them in the denominator so the two numbers can be reconciled.
    for (const entry of list)
      if (typeof entry === "string" && entry.trim().length >= 12) {
        items += 1;
        // Keyed without the trailing stop, because that is the one difference the old copies had.
        sentences.add(entry.trim().replace(/\.$/, "").toLowerCase());
      }
  }
  return { sentences, labs, items, allItems };
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "generated" || entry.name === "node_modules") continue;
      sourceFiles(p, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

describe("a laboratory's notModeled list is written in exactly one place", () => {
  test("no non-test source outside src/generated restates a manifest's notModeled sentence", () => {
    const { sentences, labs, items, allItems } = manifestSentences();
    const files = [...sourceFiles(join(ROOT, "src")), ...sourceFiles(join(ROOT, "scripts"))];
    const findings: string[] = [];
    for (const file of files) {
      const rel = file.slice(ROOT.length + 1);
      const text = blankCommentText(readFileSync(file, "utf8"), rel);
      for (const m of text.matchAll(/"((?:[^"\\]|\\.){12,})"/g)) {
        const literal = (m[1] ?? "").replace(/\\"/g, '"').trim().replace(/\.$/, "").toLowerCase();
        if (sentences.has(literal)) findings.push(`${rel}: "${(m[1] ?? "").slice(0, 60)}"`);
      }
    }
    console.log(
      `[not modeled one source] ${labs} manifests, ${allItems} items (${items} hunted), ${files.length} non-test sources scanned ` +
        `(comments blanked); ${findings.length} restatement(s)${findings.length ? `: ${findings.join("; ")}` : ""}`,
    );
    // The denominators first: a scan with no sentences to look for, or no files to look in, would
    // report zero restatements and read exactly like a clean tree.
    expect(items).toBeGreaterThan(150);
    expect(items).toBeLessThanOrEqual(allItems);
    expect(files.length).toBeGreaterThan(500);
    expect(findings).toEqual([]);
  });

  test("the generated module is the one place, and it holds every manifest's list", async () => {
    const { labs, items, allItems } = manifestSentences();
    const { NOT_MODELED, notModeledFor } = await import("../generated/not-modeled.ts");
    console.log(
      `[not modeled one source] generated module: ${Object.keys(NOT_MODELED).length} labs, ` +
        `${Object.values(NOT_MODELED).reduce((n, l) => n + l.length, 0)} items; manifests: ${labs} labs, ` +
        `${allItems} items (${items} long enough for the literal scan)`,
    );
    expect(Object.keys(NOT_MODELED).length).toBe(labs);
    expect(Object.values(NOT_MODELED).reduce((n, l) => n + l.length, 0)).toBe(allItems);
    // An unknown id refuses rather than returning an empty list, which a component would render as
    // a laboratory that leaves nothing out.
    expect(() => notModeledFor("not-a-lab")).toThrow(/unknown-laboratory-id/);
  });
});
