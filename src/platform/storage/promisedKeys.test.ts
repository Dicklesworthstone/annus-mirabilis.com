/**
 * Every kind of data `/your-data/` promises a reader can actually be written (am-oj0e).
 *
 * WHY THIS EXISTS, against AGENTS.md's creation gate.
 *
 * Concrete consumer: this test. The gate it enforces: a registered document namespace must have a
 * writer the reader can reach from a page, or be named in `DECLARED_RESERVED` with its reason. A
 * new key with neither fails at the first occurrence.
 *
 * The observed defect class, measured 2026-10-27: `DataPanel.tsx` lists `registry.all()`, so EVERY
 * registered key gets a row on `/your-data/` whether or not anything can ever write it, and the
 * page prints "N of the M kinds of data listed below". `am:tours:v1` is listed as "Progress on
 * guided reading paths" while the guided-tour design keeps none and tells the reader so in those
 * words; `am:journeys:v1` is listed as "Your choices and progress in Discover" while its only
 * writer, `src/discovery/journeyStorage.ts`, has no importer. That page is where this site's
 * privacy promise is made concrete, so a category that can never hold anything is the one kind of
 * inaccuracy it cannot afford.
 *
 * Deletion condition: delete this file when `DECLARED_RESERVED` is empty, because then the
 * property holds with no exceptions and `DataPanel`'s own rows are the census.
 *
 * WHAT IT DOES NOT CLAIM. "Reachable from a page and containing a write call" is weaker than "this
 * key is written when a reader presses a button": a module could hold a write that no code path
 * takes. It is strictly stronger than the condition that was failing here, which is that no module
 * reachable from any page mentions the key at all. Each declaration below carries the reason it is
 * reserved, so the list is a RECORD OF A DEBT and not an override: a key may sit here only with a
 * statement of what is missing, and the census prints how many there are.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAPSTONE_WORKSHEET_KEYS,
  DISCOVERY_NOTE_KEYS,
  INVESTIGATION_KEYS,
  storageKeyRegistry,
} from "./keys.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const WRITE = /\b(writeRaw|writeDocument|writeSetting|removeRaw|quarantine)\s*\(|\.setItem\s*\(/;
const IMPORT =
  /(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/gs;

/**
 * A key written through its family constant rather than its own literal: `storedNotebook.ts` names
 * `DISCOVERY_NOTE_KEYS[...]`, so searching for the literal alone would report every per-paper key
 * as unwritable even where a writer exists.
 */
const FAMILY: ReadonlyMap<string, string> = new Map([
  ...Object.values(DISCOVERY_NOTE_KEYS).map((key) => [key, "DISCOVERY_NOTE_KEYS"] as const),
  ...Object.values(CAPSTONE_WORKSHEET_KEYS).map((key) => [key, "CAPSTONE_WORKSHEET_KEYS"] as const),
  ...Object.values(INVESTIGATION_KEYS).map((key) => [key, "INVESTIGATION_KEYS"] as const),
]);

/**
 * Keys with no reachable writer today, each with what is actually missing. A reason naming the
 * owning bead is the point: this list is where an unmet promise is recorded, not hidden.
 */
const DECLARED_RESERVED: ReadonlyMap<string, string> = new Map([
  [
    "am:tours:v1",
    "am-oj0e: the guided-tour design keeps no progress record and says so to the reader " +
      "(ActiveTourGuide.tsx); a reading position lives in ?tour=&tourStop=&tourRevision=. Either " +
      "the entry goes or /your-data/ says why it is reserved, and that is am-tours-infra-g518's call.",
  ],
  [
    "am:journeys:v1",
    "am-disc-journey-framework-umbg: journeyStorage.ts can write it and has no importer, because " +
      "Fork.tsx and Branch.tsx show every branch side by side with no reader choice to keep.",
  ],
  [
    "am:clarity:v1",
    "D-2026-10-02-withdraw-clarity-signal: the owner withdrew the clarity control, so nothing will " +
      "ever write this. /your-data/ already carries a sentence saying so.",
  ],
  ...Object.values(DISCOVERY_NOTE_KEYS).map(
    (key) =>
      [
        key,
        "am-read-notebook-tde: storedNotebook.ts can write it and has no importer, because " +
          "noteManifest(journey) reads journey.stages and all four real journeys declare stages: [] " +
          "(am-4k0m), so there is nothing to attach a note to.",
      ] as const,
  ),
]);

function blank(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

function read(rel: string): string {
  return blank(readFileSync(join(ROOT, rel), "utf8"));
}

function resolveLocal(from: string, spec: string): string | undefined {
  if (!spec.startsWith(".")) return undefined;
  const base = normalize(join(dirname(from), spec));
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    const full = join(ROOT, candidate);
    if (existsSync(full) && statSync(full).isFile()) return candidate;
  }
  return undefined;
}

function reachable(starts: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...starts];
  while (stack.length > 0) {
    const file = stack.pop() as string;
    if (seen.has(file) || !/\.(ts|tsx)$/.test(file)) continue;
    seen.add(file);
    for (const match of read(file).matchAll(IMPORT)) {
      if (/^import\s+type\b/.test(match[0])) continue;
      const target = resolveLocal(file, match[1] ?? match[2] ?? match[3] ?? "");
      if (target) stack.push(target);
    }
  }
  return seen;
}

/** Every route entry point: a reader reaches a writer through one of these or not at all. */
function routeEntries(dir = "src/app"): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) return routeEntries(rel);
    return /^(page|layout|template|default)\.tsx$/.test(name) ? [rel] : [];
  });
}

/** The modules a reader can reach, minus the registry itself and anything named as a test. */
function readerModules(): string[] {
  return [...reachable(routeEntries())]
    .filter((file) => !/\.(test|spec)\.|__fixtures__|\/fixtures\//.test(file))
    .filter((file) => relative("src/platform/storage", file) !== "keys.ts")
    .sort();
}

function writersFor(key: string, modules: readonly string[]): string[] {
  const family = FAMILY.get(key);
  return modules.filter((file) => {
    const source = read(file);
    if (!source.includes(key) && !(family !== undefined && source.includes(family))) return false;
    return WRITE.test(source);
  });
}

describe("every kind of data /your-data lists can actually be written", () => {
  const modules = readerModules();

  test("the walk reaches the real module graph, not a handful of entry points", () => {
    expect(routeEntries().length).toBeGreaterThan(50);
    expect(modules.length).toBeGreaterThan(200);
    // Named modules a reader certainly reaches, so a walk that silently stopped early fails here.
    expect(modules).toContain("src/platform/storage/store.ts");
    expect(modules).toContain("src/platform/storage/DataPanel.tsx");
  });

  test("the writer detector is proved in both directions", () => {
    expect(WRITE.test("writeDocument(ctx, NAMESPACE, doc)")).toBe(true);
    expect(WRITE.test("storage.setItem(key, value)")).toBe(true);
    expect(WRITE.test(blank("// this module never calls writeRaw(ctx, key, raw)"))).toBe(false);
    expect(WRITE.test("const written = read(key);")).toBe(false);
  });

  test("a key with a real writer is found, and one with none is not", () => {
    // Positive control first: without it, a detector that found nothing would pass the census.
    expect(writersFor("am:notebook:v1", modules).length).toBeGreaterThan(0);
    expect(writersFor("am:quarantine:v1", modules).length).toBeGreaterThan(0);
    expect(writersFor("am:investigations:v1:brownian-motion", modules).length).toBeGreaterThan(0);
    // Negative control: a key nothing in the tree mentions has no writer.
    expect(writersFor("am:not-a-registered-key:v9", modules)).toEqual([]);
  });

  test("no registered document namespace is unwritable without being declared, with its reason", () => {
    const documents = storageKeyRegistry.documents();
    const withWriter: string[] = [];
    const undeclared: string[] = [];
    for (const entry of documents) {
      if (writersFor(entry.key, modules).length > 0) withWriter.push(entry.key);
      else if (!DECLARED_RESERVED.has(entry.key)) undeclared.push(entry.key);
    }
    console.log(
      `[promised keys] ${documents.length} document namespace(s) listed on /your-data/: ` +
        `${withWriter.length} with a writer a reader can reach, ` +
        `${DECLARED_RESERVED.size} declared reserved with a reason, ` +
        `${undeclared.length} promised and unwritable. ${modules.length} reader-reachable module(s) examined.`,
    );
    expect(undeclared).toEqual([]);
    // Every declaration states what is missing, so the list cannot become a silent allowlist.
    for (const [key, reason] of DECLARED_RESERVED) {
      expect(reason.length).toBeGreaterThan(80);
      expect(storageKeyRegistry.has(key)).toBe(true);
    }
  });

  test("a declaration for a key that now has a writer is stale and fails", () => {
    // The other direction of the ratchet: a debt paid down must leave the list, or the list
    // becomes pre-authorised headroom. This is the clause that will fail when journeyStorage.ts
    // or storedNotebook.ts is finally wired, which is exactly when it should.
    const stale = [...DECLARED_RESERVED.keys()].filter(
      (key) => writersFor(key, modules).length > 0,
    );
    expect(stale).toEqual([]);
  });
});
