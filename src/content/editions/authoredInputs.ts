/**
 * THE THREE POPULATIONS THE EDITION TOOLING JUDGES, READ FROM DISK (am-edn-alignment-tooling-do1).
 *
 * One implementation, two consumers: `scripts/align-editions.ts` and the edition pipeline, which
 * also feeds them to `assertEditionContract`. Both previously judged whatever their caller supplied,
 * and no production caller supplied anything -- so the aligner and check 8 validated an EMPTY edge
 * set for every paper and reported `empty-alignment` while 821 authored edges sat in
 * content/alignments/. That is the same shape the contract's own note records about check 1 and
 * `options.declaration`: a validator reading an argument nothing passes cannot fail, and cannot pass
 * either.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";
import type { RouteSlug } from "../ids.ts";
import { validateAlignment } from "../schemas/source.ts";
import { isPermanentGermanId } from "./alignableIds.ts";
import { type AlignmentIssue, type ExplicitEdge, edgesFromAlignment } from "./alignment.ts";

/**
 * THE THREE POPULATIONS THE ALIGNMENT VALIDATOR JUDGES, READ FROM DISK.
 *
 * Before this, `edges` and `englishIds` came only from `options.edges` and `options.englishIds`,
 * objects no CLI or pipeline caller passed -- so the aligner validated an EMPTY edge set for every
 * paper and reported `empty-alignment` while 821 authored edges sat in content/alignments/. That is
 * the same shape the edition contract's own note records about check 1 and `options.declaration`:
 * a validator reading an argument nothing supplies cannot fail, and cannot pass either.
 *
 * Each loader states where its authority is and why:
 *
 *  - EDGES come from `content/alignments/<slug>.yaml`, validated by the schema and converted by
 *    `edgesFromAlignment`, which already existed for this purpose. A record that is absent leaves
 *    the edge set empty, so `empty-alignment` fires and says something true. A record that is
 *    present and unreadable is NOT that, and gets its own code.
 *  - GERMAN IDS come from the FROZEN MANIFEST, which is the published addressing, and fall back to
 *    the ledger proposal only where no manifest exists. Measured 2026-10-05: against the manifest,
 *    `unknown-source` and `unaligned-source` are zero for all four papers; against the ledger
 *    proposal they were 11 to 94 and 9 to 91 per paper, because a proposal that has not been
 *    reconciled is not an addressing scheme. The reconcile stage is where that difference belongs,
 *    and reporting it here as well made the alignment verdict unreadable.
 *  - ENGLISH IDS come from the translation units' own `id` field. Measured: 821 unit files, all 821
 *    carry an id, and NONE equals its filename stem -- so a filename-derived id would have matched
 *    nothing and every edge would have reported `unknown-target`.
 */
export function loadAuthoredEdges(
  slug: RouteSlug,
  root: string,
): { edges: readonly ExplicitEdge[]; issues: readonly AlignmentIssue[] } {
  const path = join(root, `content/alignments/${slug}.yaml`);
  if (!existsSync(path)) return { edges: [], issues: [] };
  try {
    const alignment = validateAlignment(parseYaml(readFileSync(path, "utf8")), path);
    return { edges: edgesFromAlignment(alignment), issues: [] };
  } catch (err: unknown) {
    return {
      edges: [],
      issues: [
        {
          code: "alignment-record-unreadable",
          message:
            `${path} is on disk and could not be loaded: ` +
            `${err instanceof Error ? err.message : String(err)}. ` +
            "This is not an absence of authored edges.",
        },
      ],
    };
  }
}

/**
 * The frozen manifest's ALIGNABLE unit ids, in manifest order. Empty when the paper has no manifest.
 *
 * Filtered, because C.1 requires every German unit in this set to carry an edge, and a manifest
 * holds units that are not alignment sources: a paragraph aligns through its sentences rather than
 * as itself, so passing every unit id reported each paragraph as `unaligned-source` -- 19 of them in
 * mass-energy alone, on an alignment that is in fact complete.
 */
export function manifestUnitIds(slug: RouteSlug, root: string): readonly string[] {
  const path = join(root, `content/source-blocks/${slug}/manifest.yaml`);
  if (!existsSync(path)) return [];
  try {
    const manifest = parseYaml(readFileSync(path, "utf8")) as {
      units?: { id?: unknown }[] | undefined;
    };
    return Object.freeze(
      (manifest.units ?? [])
        .map((unit) => (typeof unit.id === "string" ? unit.id : ""))
        .filter((id): id is string => id !== "" && isPermanentGermanId(id)),
    );
  } catch {
    return [];
  }
}

/** Translation-unit ids, read from each record's own `id`, never from its filename. */
export function translationUnitIds(slug: RouteSlug, root: string): readonly string[] {
  const dir = join(root, `content/translation-units/${slug}`);
  if (!existsSync(dir)) return [];
  const ids: string[] = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".yaml")) continue;
    try {
      const record = parseYaml(readFileSync(join(dir, file), "utf8")) as {
        kind?: unknown;
        id?: unknown;
      } | null;
      if (record?.kind !== "translation-unit") continue;
      if (typeof record.id === "string" && record.id !== "") ids.push(record.id);
    } catch {
      // A single unreadable unit is reported by the translation validator that owns these records,
      // not re-reported here as an alignment issue about a different population.
    }
  }
  return Object.freeze(ids);
}
