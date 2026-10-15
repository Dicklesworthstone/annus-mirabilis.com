import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

/**
 * EVERY `argumentIds` A MANIFEST DECLARES NAMES A REAL ARGUMENT RECORD (am-3a8u).
 *
 * AGENTS.md has an instrument manifest declare "linked source and argument ids", and the result
 * weave light "the exact premise or conclusion an instrument currently demonstrates". An
 * instrument whose declared argument does not exist demonstrates nothing the site can point at.
 *
 * On 2026-09-28 the sweep that filed am-3a8u found 29 of 62 declared ids naming no record, across
 * 15 instruments: the manifests had been written against a planned set of ids and the authored
 * records used different, longer ones. Re-measured 2026-10-14 the corpus is CLEAN -- 55 ids across
 * 33 manifests, all resolving -- so this is the guard arriving while the family is clean, not a
 * repair.
 *
 * NOTHING CHECKED THEM, WHICH IS WHY 29 COULD SIT THERE. `src/content/schemas/experiment.ts` types
 * the field `readonly string[]` and validates no element, and its one consumer,
 * `src/content/kernel/check.ts`, compares a record's `argument` AGAINST this list -- so a manifest
 * naming ids that exist nowhere can both accept an id that does not exist and reject one that does.
 * A schema that accepts any string is not a reference check.
 *
 * THE TARGET POPULATION IS KEYED ON KIND, NOT ON THE DIRECTORY. content/arguments holds 52 JSON
 * records and only 48 are arguments; the other four are the papers' first-encounter records
 * (`entrance-<paper>`, no `kind`). Resolving against every file in the directory would let a
 * dangling id be "fixed" by pointing at an entrance record, so the third case below plants exactly
 * that and requires it to stay reported.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** The ids of the records that ARE arguments, by their own `kind` field. */
function argumentRecordIds(root: string): ReadonlySet<string> {
  const ids = new Set<string>();
  const dir = join(root, "content/arguments");
  const walk = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".json")) {
        const record = JSON.parse(readFileSync(path, "utf8")) as {
          id?: string;
          kind?: string;
        };
        if (record.kind === "argument" && typeof record.id === "string") ids.add(record.id);
      }
    }
  };
  walk(dir);
  return ids;
}

type Reference = Readonly<{ instrument: string; argumentId: string }>;

function manifestReferences(root: string): readonly Reference[] {
  const dir = join(root, "content/experiments");
  const out: Reference[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith(".yaml")) continue;
    const manifest = yaml.load(readFileSync(join(dir, name), "utf8")) as {
      argumentIds?: unknown;
    } | null;
    const declared = manifest?.argumentIds;
    if (!Array.isArray(declared)) continue;
    for (const id of declared) {
      out.push({ instrument: name.replace(/\.yaml$/, ""), argumentId: String(id) });
    }
  }
  return out;
}

/** The references whose argumentId names no argument record. */
function dangling(root: string): readonly Reference[] {
  const ids = argumentRecordIds(root);
  return manifestReferences(root).filter((r) => !ids.has(r.argumentId));
}

function rootWith(manifests: Record<string, string>, records: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "am-argument-ids-"));
  mkdirSync(join(root, "content/experiments"), { recursive: true });
  mkdirSync(join(root, "content/arguments/brownian-motion"), { recursive: true });
  for (const [id, body] of Object.entries(manifests)) {
    writeFileSync(join(root, "content/experiments", `${id}.yaml`), body);
  }
  for (const [id, body] of Object.entries(records)) {
    writeFileSync(join(root, "content/arguments/brownian-motion", `${id}.json`), body);
  }
  return root;
}

const ARGUMENT = (id: string) => JSON.stringify({ kind: "argument", id, title: id });
const ENTRANCE = (id: string) => JSON.stringify({ id, title: id });

describe("the reference check can fail, and on the right thing (am-3a8u)", () => {
  test("a declared id that names no record is reported, and a real one is not", () => {
    const root = rootWith(
      { "bm-01": "argumentIds:\n  - arg-bm-gaussian\n  - arg-bm-variance-of-sum\n" },
      { "arg-bm-gaussian": ARGUMENT("arg-bm-gaussian") },
    );
    // `arg-bm-variance-of-sum` is one of the 29 real dangling ids am-3a8u measured on bm-05.
    expect(dangling(root).map((r) => r.argumentId)).toEqual(["arg-bm-variance-of-sum"]);
  });

  test("an entrance record does not satisfy an argumentId, because it is not an argument", () => {
    const root = rootWith(
      { "bm-01": "argumentIds:\n  - entrance-brownian-motion\n" },
      { "entrance-brownian-motion": ENTRANCE("entrance-brownian-motion") },
    );
    // The file exists and its id matches. It is still not an argument, and a check keyed on the
    // directory rather than on `kind` would call this resolved.
    expect(dangling(root).map((r) => r.argumentId)).toEqual(["entrance-brownian-motion"]);
  });

  test("a manifest declaring no argumentIds contributes nothing rather than throwing", () => {
    const root = rootWith({ "bm-01": "id: bm-01\n" }, {});
    expect(manifestReferences(root)).toEqual([]);
    expect(dangling(root)).toEqual([]);
  });
});

describe("every argumentId the live manifests declare resolves", () => {
  const records = argumentRecordIds(ROOT);
  const references = manifestReferences(ROOT);
  const manifests = new Set(references.map((r) => r.instrument));

  test("the populations are the corpus's, not an empty read", () => {
    // Measured 2026-10-14: 48 argument records, 55 references from 33 manifests. Floors, not
    // equalities: a count used as evidence is anchored, and a census frozen into an assertion
    // breaks on correct work. What must never happen is this check running over nothing.
    expect(records.size).toBeGreaterThanOrEqual(40);
    expect(references.length).toBeGreaterThanOrEqual(40);
    expect(manifests.size).toBeGreaterThanOrEqual(30);
  });

  test("none of them names a record that does not exist", () => {
    const unresolved = dangling(ROOT);
    console.log(
      `[argument references] ${references.length} argumentIds from ${manifests.size} manifests ` +
        `resolved against ${records.size} argument records: ${unresolved.length} unresolved`,
    );
    expect(unresolved.map((r) => `${r.instrument} -> ${r.argumentId}`)).toEqual([]);
  });
});
