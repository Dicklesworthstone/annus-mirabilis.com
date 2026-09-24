import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadRegistry } from "../content/foundations/registry.ts";
import { foundationLinks, lesson, lessonExists } from "./foundInference.shared.ts";

/**
 * am-found-transport-thermo-smv3, foundTransport.records: the six registry entries, the planned
 * callers the bead names, typed prerequisites including the ones the bead names, no proof cycle,
 * stopping points, and a return caption on every caller that exists.
 */

const OWNER = "am-found-transport-thermo-smv3";
const SLUGS = [
  "viscosity-stokes-drag",
  "free-energy-osmotic-pressure",
  "work-energy",
  "temperature-thermal-energy",
  "entropy-multiplicity",
  "entropy-temperature",
] as const;

const ROOT = process.cwd();
const entries = loadRegistry().entries;
const entry = (slug: string) => entries.find((e) => e.id === `foundation:${slug}`);

type Prerequisite = { foundationId: string; kind: string };
const prerequisites = (slug: string) =>
  (lesson(slug) as { prerequisites?: Prerequisite[] }).prerequisites ?? [];

/**
 * Whether a planned caller names something that exists: a paper, one of its sections (a block id
 * in the paper's source manifest starts with it), an instrument with a manifest and a route, or an
 * instrument's mode with its own route.
 */
export function callerExists(caller: string): boolean {
  const lab = caller.match(/^lab:([a-z]{2}-\d{2})(?::([a-z-]+))?$/);
  if (lab) {
    const [, id, mode] = lab;
    return (
      existsSync(join(ROOT, "content/experiments", `${id}.yaml`)) &&
      existsSync(join(ROOT, "src/app/lab", id as string, mode ?? "", "page.tsx"))
    );
  }
  const paper = caller.match(/^([a-z-]+)(?::(s\d+))?$/);
  if (!paper) return false;
  const [, slug, section] = paper;
  const manifest = join(ROOT, "content/source-blocks", slug as string, "manifest.ids.snapshot.txt");
  if (!existsSync(manifest)) return false;
  if (!section) return true;
  return readFileSync(manifest, "utf8")
    .split("\n")
    .some((id) => id.startsWith(`${section}-`));
}

describe("registered, authored and owned", () => {
  for (const slug of SLUGS)
    test(slug, () => {
      expect(entry(slug)).toMatchObject({
        kind: "node",
        cluster: "transport-thermo",
        ownerBead: OWNER,
        status: "authored",
      });
      expect((lesson(slug) as { id?: string }).id).toBe(slug);
    });

  test("this bead owns exactly these six", () => {
    expect(
      entries
        .filter((e) => e.ownerBead === OWNER)
        .map((e) => e.id)
        .sort(),
    ).toEqual(SLUGS.map((s) => `foundation:${s}`).sort());
  });
});

describe("planned callers", () => {
  // The bead's list: the kitchen mode, light §1 and §§3–6, LQ-04, mass–energy's two ledgers, and
  // relativity §10's work integral. Each must be recorded on at least one of the six lessons.
  const NAMED = [
    "lab:bm-07:kitchen",
    "light-quanta:s1",
    "light-quanta:s3",
    "light-quanta:s4",
    "light-quanta:s5",
    "light-quanta:s6",
    "lab:lq-04",
    "mass-energy",
    "special-relativity:s10",
  ];

  test("every caller the bead names is recorded", () => {
    const recorded = new Set(SLUGS.flatMap((s) => entry(s)?.plannedCallers ?? []));
    expect(NAMED.filter((c) => !recorded.has(c))).toEqual([]);
  });

  test("every recorded caller names a paper, section, instrument or mode that exists", () => {
    const all = SLUGS.flatMap((s) => (entry(s)?.plannedCallers ?? []).map((c) => `${s} ${c}`));
    expect(all.length).toBeGreaterThan(0);
    expect(all.filter((line) => !callerExists(line.split(" ")[1] as string))).toEqual([]);
  });

  test("the existence check refuses what does not exist", () => {
    expect(callerExists("light-quanta:s6")).toBe(true);
    expect(callerExists("lab:bm-07:kitchen")).toBe(true);
    expect(callerExists("light-quanta:s12")).toBe(false);
    expect(callerExists("light-quanta:6")).toBe(false);
    expect(callerExists("lab:lq-99")).toBe(false);
    expect(callerExists("lab:bm-07:bakery")).toBe(false);
    expect(callerExists("brownian-motions")).toBe(false);
  });
});

describe("prerequisites", () => {
  test("every prerequisite is typed and names a lesson that exists", () => {
    for (const slug of SLUGS) {
      const list = prerequisites(slug);
      expect(list.length, slug).toBeGreaterThan(0);
      for (const p of list) {
        expect(["proof-edge", "cross-link"], `${slug} ${p.foundationId}`).toContain(p.kind);
        expect(lessonExists(p.foundationId), `${slug} ${p.foundationId}`).toBe(true);
      }
    }
  });

  test("the prerequisites the bead names are there, with the kind it names", () => {
    const has = (slug: string, id: string, kind: string) =>
      prerequisites(slug).some((p) => p.foundationId === `foundation:${id}` && p.kind === kind);
    expect(has("entropy-temperature", "partial-derivatives", "proof-edge")).toBe(true);
    expect(has("entropy-multiplicity", "logarithms", "proof-edge")).toBe(true);
    expect(has("viscosity-stokes-drag", "quantities-units", "proof-edge")).toBe(true);
    expect(has("free-energy-osmotic-pressure", "quantities-units", "proof-edge")).toBe(true);
    expect(has("viscosity-stokes-drag", "flux-continuity", "cross-link")).toBe(true);
  });

  test("no lesson reaches itself through proof edges", () => {
    const edges = (slug: string) =>
      lessonExists(slug)
        ? prerequisites(slug)
            .filter((p) => p.kind === "proof-edge")
            .map((p) => p.foundationId.replace(/^foundation:/, ""))
        : [];
    for (const start of SLUGS) {
      const seen = new Set<string>();
      const stack = [...edges(start)];
      while (stack.length > 0) {
        const next = stack.pop() as string;
        expect(next, `${start} reaches itself`).not.toBe(start);
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(...edges(next));
      }
    }
  });
});

describe("stopping points and callers that exist", () => {
  for (const slug of SLUGS)
    test(slug, () => {
      const record = lesson(slug) as { stoppingPoint?: string };
      expect((record.stoppingPoint ?? "").trim().length).toBeGreaterThan(40);
      const calls = foundationLinks().filter((l) => l.id === slug);
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls)
        expect(typeof call.caption === "string" && call.caption.trim().length > 0, call.path).toBe(
          true,
        );
    });
});
