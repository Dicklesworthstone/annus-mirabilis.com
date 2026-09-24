import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadRegistry } from "../content/foundations/registry.ts";

/**
 * am-found-linear-geometry-7w15: five records registered under their canonical ids with this bead as
 * owner; typed prerequisites; a return caption for every existing caller; and the later aids
 * (the matrix view, rapidity) labelled as later, with their dates.
 */

const OWNER = "am-found-linear-geometry-7w15";
const CLUSTER = [
  "vectors-components",
  "matrices-linear-maps",
  "hyperbolic-functions-rapidity",
  "dot-cross-products",
  "conservation-symmetry",
] as const;
const ROOT = process.cwd();
const record = (id: string) =>
  JSON.parse(readFileSync(join(ROOT, "content/foundations", `${id}.json`), "utf8"));
const entries = loadRegistry().entries;

describe("registered, authored and owned", () => {
  for (const id of CLUSTER)
    test(id, () => {
      expect(entries.find((e) => e.id === `foundation:${id}`)).toMatchObject({
        kind: "node",
        ownerBead: OWNER,
        status: "authored",
      });
      expect(record(id).stoppingPoint.trim().length).toBeGreaterThan(40);
    });

  test("this bead owns exactly these five", () => {
    expect(
      entries
        .filter((e) => e.ownerBead === OWNER)
        .map((e) => e.id)
        .sort(),
    ).toEqual(CLUSTER.map((id) => `foundation:${id}`).sort());
  });
});

describe("every prerequisite is typed and points at a registered lesson", () => {
  const registered = new Set(entries.map((e) => e.id));
  for (const id of CLUSTER)
    test(id, () => {
      const prerequisites = record(id).prerequisites as unknown[];
      expect(prerequisites.length).toBeGreaterThan(0);
      for (const p of prerequisites) {
        expect(typeof p).toBe("object");
        const { foundationId, kind } = p as { foundationId: string; kind: string };
        expect(["proof-edge", "cross-link"]).toContain(kind);
        expect(registered.has(foundationId), foundationId).toBe(true);
      }
    });
});

describe("every existing caller links with a return caption", () => {
  const links: { path: string; id: string; caption: unknown }[] = [];
  const walk = (path: string, value: unknown): void => {
    if (Array.isArray(value)) {
      for (const v of value) walk(path, v);
    } else if (value && typeof value === "object") {
      const o = value as Record<string, unknown>;
      if (o.kind === "foundation" && typeof o.id === "string")
        links.push({ path, id: o.id, caption: o.returnCaption });
      for (const v of Object.values(o)) walk(path, v);
    }
  };
  const visit = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) visit(full);
      else if (e.name.endsWith(".json")) walk(full, JSON.parse(readFileSync(full, "utf8")));
    }
  };
  visit(join(ROOT, "content/arguments"));

  for (const id of CLUSTER)
    test(`${id} is called, and every call carries a caption`, () => {
      const calls = links.filter((l) => l.id === id || l.id === `foundation:${id}`);
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls)
        expect(typeof call.caption === "string" && call.caption.trim().length > 0, call.path).toBe(
          true,
        );
    });
});

describe("the later aids say they are later, with a date", () => {
  for (const [id, date] of [
    ["matrices-linear-maps", "1908"],
    ["hyperbolic-functions-rapidity", "1910"],
  ] as const)
    test(`${id}: "later aid", dated ${date}`, () => {
      const text = JSON.stringify(record(id));
      expect(text).toMatch(/later aid/);
      expect(text).toContain(date);
    });
});
