/**
 * WHAT A PAPER PAGE DOES NOT YET EXPLAIN (am-paper-pages-hide-missing-sections-vl4k).
 *
 * The Brownian page explained sections 4 and 5 and never said that the introduction and sections
 * 1 to 3 had no explanation at all; their section pages returned 404 and the outline simply left
 * them out, so a reader could believe the paper was covered. The parts of a paper come from its
 * frozen source manifest (every printed block carries its section), the explained ones from the
 * sections that have explanation passages, and the difference is computed here, so the line that
 * names it goes away by itself when a section's passages are written.
 */

/** The paper's parts in printed order: s0 (the introduction, where there is one), then s1, s2... */
export function paperParts(
  units: readonly Readonly<{ section?: string | undefined }>[],
): readonly string[] {
  const parts = new Set<string>();
  for (const unit of units)
    if (unit.section && /^s\d+$/.test(unit.section)) parts.add(unit.section);
  return [...parts].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

/** The parts no explanation passage covers, in printed order. */
export function unexplainedParts(
  parts: readonly string[],
  explained: ReadonlySet<string>,
): readonly string[] {
  return parts.filter((part) => !explained.has(part));
}

/** "the introduction" for s0, "§3" for s3. */
export function partLabel(part: string): string {
  return part === "s0" ? "the introduction" : `§${part.slice(1)}`;
}

/** The outline in printed order: explained sections and unexplained parts together. */
export function outlineOrder<S extends Readonly<{ id: string }>>(
  sections: readonly S[],
  missing: readonly string[],
): readonly ({ kind: "section"; section: S } | { kind: "missing"; part: string })[] {
  const n = (id: string) => Number(id.slice(1));
  return [
    ...sections.map((section) => ({ kind: "section" as const, section })),
    ...missing.map((part) => ({ kind: "missing" as const, part })),
  ].sort(
    (a, b) =>
      n(a.kind === "section" ? a.section.id : a.part) -
      n(b.kind === "section" ? b.section.id : b.part),
  );
}
