import { describe, expect, test } from "bun:test";
import { loadRegistry } from "../content/foundations/registry.ts";
import { argumentRecords, BRIDGES, bridge } from "./foundZeroAlgebra.shared.ts";

/**
 * am-found-zero-algebra-rest-oipl: four bridge records with stopping points, registered under their
 * canonical ids with this bead as owner, and a return caption for every caller that exists.
 */

const OWNER = "am-found-zero-algebra-rest-oipl";

describe("registered, authored and owned", () => {
  const entries = loadRegistry().entries;
  for (const slug of BRIDGES)
    test(slug, () => {
      const entry = entries.find((e) => e.id === `foundation:${slug}`);
      expect(entry).toMatchObject({ kind: "bridge", ownerBead: OWNER, status: "authored" });
      const record = bridge(slug);
      expect(record.id).toBe(slug);
      expect(record.kind).toBe("foundation");
      expect(record.stoppingPoint.trim().length).toBeGreaterThan(40);
    });

  test("this bead owns exactly these four", () => {
    expect(
      entries
        .filter((e) => e.ownerBead === OWNER)
        .map((e) => e.id)
        .sort(),
    ).toEqual(BRIDGES.map((s) => `foundation:${s}`).sort());
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
  for (const { path, json } of argumentRecords()) walk(path, json);

  for (const slug of BRIDGES)
    test(`${slug} is called, and every call carries a caption`, () => {
      // A reading's foundation block names the lesson by slug; the prefixed form is accepted too.
      const calls = links.filter((l) => l.id === slug || l.id === `foundation:${slug}`);
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls)
        expect(typeof call.caption === "string" && call.caption.trim().length > 0, call.path).toBe(
          true,
        );
    });
});
