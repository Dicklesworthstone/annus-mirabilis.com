import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadRegistry } from "../content/foundations/registry.ts";
import type { FoundationExtensionSection } from "../content/schemas/reading.ts";
import { foundationLinks, lesson, lessonExists } from "./foundInference.shared.ts";

/**
 * am-found-statistics-inference-pzqv, foundInference.records: "compiler checks for the registry
 * entries, extension-section attachment to authored nodes, link-record captions, and typed
 * prerequisites", with the planned callers the bead names. The per-lesson checks of the second
 * node live in foundTwoMeasurements.records.test.ts; this file holds what spans the bead.
 */

const ROOT = process.cwd();
const OWNER = "am-found-statistics-inference-pzqv";
const NODES = ["error-and-inference", "two-measurements-two-unknowns"] as const;
const PAPERS = [
  "light-quanta",
  "brownian-motion",
  "special-relativity",
  "mass-energy",
  "molecular-dimensions",
];
const entries = loadRegistry().entries;
const entry = (slug: string) => entries.find((e) => e.id === `foundation:${slug}`);

const sections = (): FoundationExtensionSection[] =>
  readdirSync(join(ROOT, "content/foundations/extensions"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(ROOT, "content/foundations/extensions", f), "utf8")))
    .filter((r) => r.ownerBead === OWNER);

/** A planned caller names a paper (or one of its sections), or a laboratory route that exists. */
export function plannedCallerResolves(caller: string): boolean {
  const lab = caller.match(/^lab:([a-z0-9-]+)(?::([a-z-]+))?$/);
  if (lab) return existsSync(join(ROOT, "src/app/lab", lab[1] as string, lab[2] ?? "", "page.tsx"));
  const paper = caller.match(/^([a-z-]+)(?::s(\d+))?$/);
  return paper !== null && PAPERS.includes(paper[1] as string);
}

describe("registry", () => {
  for (const slug of NODES)
    test(`${slug}: a node, authored, owned by this bead, under the record's own id`, () => {
      expect(entry(slug)).toMatchObject({
        kind: "node",
        cluster: "statistics-inference",
        ownerBead: OWNER,
        status: "authored",
      });
      expect((lesson(slug) as { id: string }).id).toBe(slug);
    });

  test("this bead owns exactly these two", () => {
    expect(
      entries
        .filter((e) => e.ownerBead === OWNER)
        .map((e) => e.id)
        .sort(),
    ).toEqual(NODES.map((s) => `foundation:${s}`).sort());
  });

  test("error-and-inference records every planned caller the bead names, and each resolves", () => {
    // BM-07, BM-08, the kitchen mode, the Avogadro lab, the companion record, and the
    // what-can-you-infer workbench.
    expect([...(entry("error-and-inference")?.plannedCallers ?? [])].sort()).toEqual(
      [
        "lab:bm-07",
        "lab:bm-08",
        "lab:bm-07:kitchen",
        "lab:avogadro-lab",
        "molecular-dimensions",
        "lab:what-can-you-infer",
      ].sort(),
    );
    for (const slug of NODES)
      for (const caller of entry(slug)?.plannedCallers ?? [])
        expect(plannedCallerResolves(caller), `${slug}: ${caller}`).toBe(true);
  });

  test("the resolver refuses what does not exist", () => {
    expect(plannedCallerResolves("lab:bm-07:kitchen")).toBe(true);
    expect(plannedCallerResolves("brownian-motion:s5")).toBe(true);
    expect(plannedCallerResolves("lab:no-such-lab")).toBe(false);
    expect(plannedCallerResolves("lab:bm-07:bakery")).toBe(false);
    expect(plannedCallerResolves("brownian-motions")).toBe(false);
  });
});

describe("extension sections attach to authored lessons", () => {
  const owned = sections();

  test("this bead's sections exist, and each extends an authored lesson of the slice", () => {
    expect(owned.length).toBeGreaterThan(0);
    for (const s of owned) {
      const target = s.targetFoundation.replace(/^foundation:/, "");
      expect(entry(target)?.status, s.id).toBe("authored");
      expect(entry(target)?.ownerBead, s.id).toBe("am-bm-slice-foundations-f5z9");
      expect(lessonExists(target), s.id).toBe(true);
    }
  });

  test("each lesson link inside a section carries a caption and names a lesson that exists", () => {
    const links = owned.flatMap((s) =>
      s.body.flatMap((b) => (b.kind === "foundation" ? [{ section: s.id, ...b }] : [])),
    );
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) {
      expect(l.returnCaption.trim().length, l.section).toBeGreaterThan(0);
      expect(lessonExists(l.id), `${l.section} → ${l.id}`).toBe(true);
    }
  });
});

describe("prerequisites and callers", () => {
  test("every prerequisite is typed and resolves, with the kinds the bead names", () => {
    for (const slug of NODES)
      for (const p of (lesson(slug) as { prerequisites: { foundationId: string; kind: string }[] })
        .prerequisites) {
        expect(["proof-edge", "cross-link"], `${slug} ${p.foundationId}`).toContain(p.kind);
        expect(lessonExists(p.foundationId), `${slug} ${p.foundationId}`).toBe(true);
      }
    const has = (slug: string, id: string, kind: string) =>
      (
        lesson(slug) as { prerequisites: { foundationId: string; kind: string }[] }
      ).prerequisites.some((p) => p.foundationId === `foundation:${id}` && p.kind === kind);
    for (const id of [
      "distributions",
      "mean-variance-rms",
      "gaussian-distributions",
      "bridge-squaring-square-roots",
      "bridge-probability-notation",
    ])
      expect(has("error-and-inference", id, "proof-edge"), id).toBe(true);
    expect(has("two-measurements-two-unknowns", "ratios-scaling", "proof-edge")).toBe(true);
    expect(has("two-measurements-two-unknowns", "error-and-inference", "proof-edge")).toBe(true);
    expect(has("two-measurements-two-unknowns", "functions-graphs", "cross-link")).toBe(true);
  });

  test("every caller of either lesson links with a return caption", () => {
    for (const slug of NODES) {
      const calls = foundationLinks().filter((l) => l.id === slug);
      expect(calls.length, slug).toBeGreaterThan(0);
      for (const call of calls)
        expect(typeof call.caption === "string" && call.caption.trim().length > 0, call.path).toBe(
          true,
        );
    }
  });
});
