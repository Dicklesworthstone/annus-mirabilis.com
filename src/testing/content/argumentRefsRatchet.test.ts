/**
 * AN INSTRUMENT'S DECLARED ARGUMENT EXISTS (am-3a8u).
 *
 * Measured 2026-09-28: 29 of the 62 `argumentIds` declared by the 33 instrument manifests name no
 * argument record, across 15 instruments. Nothing checked them. The field is typed
 * `readonly string[]` in src/content/schemas/experiment.ts and read by
 * src/content/kernel/check.ts, which compares a record's `argument` against the list, so a
 * manifest naming ids that do not exist can accept an argument that was never written and reject
 * one that was.
 *
 * WHY A RATCHET AND NOT A FLAT ASSERTION. Twenty-nine is inherited debt and resolving each one is
 * an editorial judgement about what its instrument demonstrates, not a rename. A gate that fails
 * on all of them from the first day is a gate that gets read as scenery, which is exactly what
 * happened to the revision check earlier tonight. So the baseline holds what was already broken
 * and this refuses anything new.
 *
 * THE BASELINE CANNOT DRIFT INTO PERMISSION. A baseline entry whose reference now resolves is
 * itself a failure, so the file shrinks as the debt is paid and never quietly grows a licence for
 * something that was fixed and broke again.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../../content/provenance/yaml.ts";
import baseline from "./argumentRefsBaseline.json";

const ROOT = process.cwd();

function argumentRecordIds(): Set<string> {
  const ids = new Set<string>();
  const dir = join(ROOT, "content", "arguments");
  for (const paper of readdirSync(dir, { withFileTypes: true })) {
    if (!paper.isDirectory()) continue;
    for (const file of readdirSync(join(dir, paper.name))) {
      if (!file.endsWith(".json")) continue;
      const record = JSON.parse(readFileSync(join(dir, paper.name, file), "utf8")) as {
        id?: unknown;
      };
      if (typeof record.id === "string") ids.add(record.id);
    }
  }
  return ids;
}

function declaredRefs(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const dir = join(ROOT, "content", "experiments");
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".yaml")) continue;
    const manifest = parseYaml(readFileSync(join(dir, file), "utf8")) as {
      argumentIds?: unknown;
    };
    const ids = Array.isArray(manifest.argumentIds)
      ? manifest.argumentIds.filter((x): x is string => typeof x === "string")
      : [];
    if (ids.length > 0) out.set(file.replace(/\.yaml$/, ""), ids);
  }
  return out;
}

describe("an instrument's declared argument exists", () => {
  const records = argumentRecordIds();
  const declared = declaredRefs();
  const allowed = baseline.instruments as Record<string, string[] | undefined>;

  test("the sweep reads a real population on both sides", () => {
    // Not vacuous: an empty record set would make every reference dangle, and an empty manifest
    // set would make the whole check pass over nothing. Reported, not frozen.
    const total = [...declared.values()].reduce((n, ids) => n + ids.length, 0);
    console.log(
      `[argument refs] ${records.size} argument records; ${total} references from ${declared.size} manifests`,
    );
    expect(records.size).toBeGreaterThan(40);
    expect(total).toBeGreaterThan(50);
  });

  test("no manifest gains a reference to an argument that does not exist", () => {
    const unexpected: string[] = [];
    for (const [lab, ids] of declared) {
      const permitted = new Set(allowed[lab] ?? []);
      for (const id of ids)
        if (!records.has(id) && !permitted.has(id)) unexpected.push(`${lab}: ${id}`);
    }
    expect(unexpected).toEqual([]);
  });

  test("a baseline entry that now resolves is removed from the baseline", () => {
    const stale: string[] = [];
    for (const [lab, ids] of Object.entries(allowed)) {
      for (const id of ids ?? []) {
        if (records.has(id)) stale.push(`${lab}: ${id} resolves now`);
        else if (!(declared.get(lab) ?? []).includes(id))
          stale.push(`${lab}: ${id} is no longer declared`);
      }
    }
    expect(stale).toEqual([]);
  });

  test("the debt the baseline records is reported, and can only shrink", () => {
    const carried = Object.values(allowed).reduce((n, ids) => n + (ids?.length ?? 0), 0);
    console.log(
      `[argument refs] ${carried} references in ${Object.keys(allowed).length} instruments still name no record (am-3a8u)`,
    );
    // 29 on 2026-09-28. Asserted as a ceiling rather than an equality: paying the debt must not
    // turn this red, and adding to it must.
    expect(carried).toBeLessThanOrEqual(29);
  });
});
