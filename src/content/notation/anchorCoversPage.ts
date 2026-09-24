/**
 * A CONCORDANCE ENTRY'S FIRST USE IS WHERE ITS PAGE SAYS (TanElk's dispatch 154, part 2).
 *
 * Each entry names where a glyph is first printed twice over: `sources.facsimilePage`, the printed
 * page, and `sources.anchor`, the paragraph /notation/ links to ("first used on p. 134"). Measured
 * on live c1e80b4b, 44 of 118 first-use links named a page their target paragraph does not cover:
 * the plate check had corrected the page and left the anchor at a section's first paragraph, so
 * the link opened the wrong paragraph. Nothing compared the two.
 *
 * This compares them. The pages a paragraph covers come from the frozen source manifest, whose
 * locators give every printed page a block touches, so a paragraph running over a page break
 * covers both pages. An anchor that names a retired id covers the pages of the ids that replaced
 * it (content/aliases). Only papers whose German face renders text are checked, since that is
 * where a first-use link lands; the caller says which papers those are.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../provenance/yaml.ts";

export type AnchorPageFinding = Readonly<{
  entry: string;
  anchor: string;
  page: number;
  /** Why the anchor does not stand where the page says. */
  reason: "not-on-face" | "not-in-manifest" | "page-not-covered";
  /** The printed pages the anchored block covers, when it has any. */
  covers: readonly number[];
}>;

type EntryLike = Readonly<{
  id: string;
  sources?: Readonly<{ anchor?: unknown; facsimilePage?: unknown }> | undefined;
}>;

/** The printed pages each manifest unit spans, or null when the paper has no manifest. */
export function manifestPages(
  root: string,
  paper: string,
): ReadonlyMap<string, readonly number[]> | null {
  const file = join(root, "content", "source-blocks", paper, "manifest.yaml");
  if (!existsSync(file)) return null;
  const units = (parseYaml(readFileSync(file, "utf8")) as { units?: unknown } | null)?.units;
  const out = new Map<string, number[]>();
  for (const u of Array.isArray(units) ? units : []) {
    const { id, locators } = (u ?? {}) as { id?: unknown; locators?: unknown };
    if (typeof id !== "string") continue;
    const pages = (Array.isArray(locators) ? locators : [])
      .map((l) => (l as { page?: unknown } | null)?.page)
      .filter((p): p is number => typeof p === "number");
    out.set(
      id,
      [...new Set(pages)].sort((a, b) => a - b),
    );
  }
  return out;
}

/** Retired id to the ids that replaced it, from content/aliases/<paper>.yaml. */
export function aliasTargets(root: string, paper: string): ReadonlyMap<string, readonly string[]> {
  const file = join(root, "content", "aliases", `${paper}.yaml`);
  if (!existsSync(file)) return new Map();
  const aliases = (parseYaml(readFileSync(file, "utf8")) as { aliases?: unknown } | null)?.aliases;
  const out = new Map<string, readonly string[]>();
  for (const a of Array.isArray(aliases) ? aliases : []) {
    const { retiredId, replacementIds } = (a ?? {}) as {
      retiredId?: unknown;
      replacementIds?: unknown;
    };
    if (typeof retiredId === "string" && Array.isArray(replacementIds))
      out.set(
        retiredId,
        replacementIds.filter((r): r is string => typeof r === "string"),
      );
  }
  return out;
}

/** "lq-s2-p1" to "s2-p1": concordance anchors carry the paper's two-letter prefix. */
export const bareAnchor = (anchor: string): string => anchor.replace(/^[a-z]{2}-/, "");

/**
 * Every entry of one paper whose anchor does not cover its page, and how many entries were
 * checked: those with both an anchor and a page. `face` is the set of anchors the paper's German
 * face publishes.
 */
export function anchorPageFindings(
  entries: readonly EntryLike[],
  face: ReadonlySet<string>,
  pages: ReadonlyMap<string, readonly number[]>,
  aliases: ReadonlyMap<string, readonly string[]>,
): Readonly<{ checked: number; findings: readonly AnchorPageFinding[] }> {
  const findings: AnchorPageFinding[] = [];
  let checked = 0;
  for (const e of entries) {
    const anchor = e.sources?.anchor;
    const page = e.sources?.facsimilePage;
    if (typeof anchor !== "string" || typeof page !== "number") continue;
    checked++;
    const bare = bareAnchor(anchor);
    const units = aliases.get(bare) ?? [bare];
    const known = units.filter((u) => pages.has(u));
    const covers = [...new Set(known.flatMap((u) => pages.get(u) ?? []))].sort((a, b) => a - b);
    const finding = (reason: AnchorPageFinding["reason"]) =>
      findings.push({ entry: e.id, anchor, page, reason, covers });
    if (!face.has(bare)) finding("not-on-face");
    else if (known.length === 0) finding("not-in-manifest");
    else if (!covers.includes(page)) finding("page-not-covered");
  }
  return { checked, findings };
}
