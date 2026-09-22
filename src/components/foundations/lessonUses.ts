/**
 * Where a foundation lesson leads, for the rail beside it on its own page.
 *
 * A lesson exists to get a reader past one missing step in a passage and back again. Until
 * 2026-09-22 its page named no passage at all: it was one 780px column, and the only way back
 * was the browser's Back button. The papers already say which lessons they send readers to; this
 * reads that from the compiled arguments, so the list cannot drift from the links it mirrors.
 */

/** The four papers in the order Annalen received them. */
export const PAPER_ORDER = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"];

type ArgumentLike = Readonly<{
  id: string;
  section: string;
  title: string;
  readings?: unknown;
  help?: Readonly<Record<string, unknown>> | undefined;
}>;
type PaperLike = Readonly<{
  paper: Readonly<{
    id: string;
    title: string;
    sections: readonly Readonly<{ id: string; title: string; arguments: readonly string[] }>[];
  }>;
  arguments: readonly ArgumentLike[];
}>;
type LessonLike = Readonly<{
  id: string;
  title: string;
  prerequisites: readonly (string | Readonly<{ foundationId: string }>)[];
}>;

/** `section` is the printed label ("§4", "Introduction"), or null when the paper has one section. */
export type LessonUse = Readonly<{
  href: string;
  paper: string;
  section: string | null;
  title: string;
}>;
export type LessonUseGroup = Readonly<{ paper: string; uses: readonly LessonUse[] }>;
export type LessonLink = Readonly<{ href: string; title: string }>;

function collect(value: unknown, found: Set<string>): void {
  if (Array.isArray(value)) for (const item of value) collect(item, found);
  else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.kind === "foundation" && typeof record.id === "string") found.add(record.id);
    for (const item of Object.values(record)) collect(item, found);
  }
}

/**
 * Every foundation id an argument points a reader to: the lessons set inline in its readings
 * (a node of kind "foundation") and its help links. A lesson id that only appears as text, or as
 * the id of something else, is not a link and is not counted.
 */
export function lessonsNamedBy(argument: ArgumentLike): Set<string> {
  const found = new Set<string>();
  collect(argument.readings, found);
  for (const id of Object.values(argument.help ?? {})) if (typeof id === "string") found.add(id);
  return found;
}

/** The paper's name without its subtitle: "Brownian motion", not "Brownian motion: from ...". */
export function paperName(title: string): string {
  return title.split(":")[0] ?? title;
}

/**
 * Each passage that sends a reader to `lessonId`, in reading order: papers as Annalen received
 * them, sections as printed, arguments as the section lists them. Each names its paper, and its
 * section by the printed label ("§4", "Introduction") unless the paper has only one.
 */
export function lessonUses(lessonId: string, papers: readonly PaperLike[]): LessonUse[] {
  const rank = (id: string) => (PAPER_ORDER.includes(id) ? PAPER_ORDER.indexOf(id) : 99);
  const uses: LessonUse[] = [];
  for (const { paper, arguments: args } of [...papers].sort(
    (a, b) => rank(a.paper.id) - rank(b.paper.id),
  )) {
    const byId = new Map(args.map((a) => [a.id, a]));
    for (const section of paper.sections)
      for (const argumentId of section.arguments) {
        const argument = byId.get(argumentId);
        if (!argument || !lessonsNamedBy(argument).has(lessonId)) continue;
        const label = section.title.split(" · ")[0] ?? section.title;
        uses.push({
          href: `/papers/${paper.id}/${section.id}/#${argument.id}`,
          paper: paperName(paper.title),
          section: paper.sections.length > 1 ? label : null,
          title: argument.title,
        });
      }
  }
  return uses;
}

/**
 * The passages gathered under their paper, keeping the reading order, so a paper that sends a
 * reader here five times is named once rather than five times: the energy lesson's rail repeated
 * "Mass and energy" above five consecutive links on BUILD 19.
 */
export function groupByPaper(uses: readonly LessonUse[]): LessonUseGroup[] {
  const groups: { paper: string; uses: LessonUse[] }[] = [];
  for (const use of uses) {
    const last = groups.at(-1);
    if (last?.paper === use.paper) last.uses.push(use);
    else groups.push({ paper: use.paper, uses: [use] });
  }
  return groups;
}

/** The lessons that list `lessonId` among their prerequisites, in the order given. */
export function lessonsBuildingOn(lessonId: string, lessons: readonly LessonLike[]): LessonLink[] {
  return lessons
    .filter((lesson) =>
      lesson.prerequisites.some(
        (p) =>
          (typeof p === "string" ? p : p.foundationId.replace(/^foundation:/, "")) === lessonId,
      ),
    )
    .map((lesson) => ({ href: `/foundations/${lesson.id}/`, title: lesson.title }));
}
