/** A syllabus orders the edition's actual prerequisite edges, not a second curriculum graph. */
export type SyllabusLesson = Readonly<{
  id: string;
  title: string;
  summary: string;
  prerequisites: readonly (
    | string
    | Readonly<{ foundationId: string; kind: "proof-edge" | "cross-link" }>
  )[];
}>;
export type SyllabusSession = Readonly<{ id: string; foundations: readonly string[] }>;
export type LessonPreparation = Readonly<{
  sessionId: string;
  /** Prerequisites precede the lessons that need them; each is introduced only once. */
  introduce: readonly SyllabusLesson[];
  /** Earlier sessions introduced these; this is a reading suggestion, not a completion claim. */
  revisit: readonly SyllabusLesson[];
}>;
export type Syllabus = Readonly<{
  sessions: readonly LessonPreparation[];
  /** Every remaining lesson, also prerequisite-ordered; none silently disappears from the course. */
  furtherStudy: readonly SyllabusLesson[];
  lessonCount: number;
}>;
export class SyllabusError extends Error {
  readonly code:
    | "syllabus-duplicate-id"
    | "syllabus-missing-lesson"
    | "syllabus-prerequisite-cycle"
    | "syllabus-invalid-id";
  constructor(code: SyllabusError["code"], message: string) {
    super(message);
    this.name = "SyllabusError";
    this.code = code;
  }
}
const idOf = (id: string) => id.replace(/^foundation:/, "");
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function validId(id: string): void {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id))
    throw new SyllabusError("syllabus-invalid-id", `Invalid syllabus identity: ${id}.`);
}

/**
 * Only proof prerequisites affect order. A related reading can point back without forming a
 * proof cycle. Legacy string prerequisites are proof edges; typed cross-links are not.
 * All references are checked, including unused lessons and cross-links, so an incomplete graph
 * cannot produce a reassuring-looking partial syllabus. Neither input arrays nor records mutate.
 */
export function buildSyllabus(
  lessons: readonly SyllabusLesson[],
  sessions: readonly SyllabusSession[],
): Syllabus {
  const byId = new Map<string, SyllabusLesson>();
  for (const lesson of lessons) {
    validId(lesson.id);
    if (byId.has(lesson.id))
      throw new SyllabusError("syllabus-duplicate-id", `Duplicate lesson: ${lesson.id}.`);
    byId.set(
      lesson.id,
      Object.freeze({
        ...lesson,
        prerequisites: Object.freeze(
          lesson.prerequisites.map((p) => (typeof p === "string" ? p : Object.freeze({ ...p }))),
        ),
      }),
    );
  }
  const requireLesson = (input: string): SyllabusLesson => {
    const id = idOf(input);
    const lesson = byId.get(id);
    if (!lesson)
      throw new SyllabusError(
        "syllabus-missing-lesson",
        `No published foundation lesson named ${id}.`,
      );
    return lesson;
  };
  const dependencies = new Map<string, readonly string[]>();
  for (const lesson of byId.values()) {
    for (const ref of lesson.prerequisites)
      requireLesson(typeof ref === "string" ? ref : ref.foundationId);
    dependencies.set(
      lesson.id,
      [
        ...new Set(
          lesson.prerequisites
            .filter((ref) => typeof ref === "string" || ref.kind === "proof-edge")
            .map((ref) => idOf(typeof ref === "string" ? ref : ref.foundationId)),
        ),
      ].sort(compare),
    );
  }
  function ordered(roots: readonly string[]): SyllabusLesson[] {
    const out: SyllabusLesson[] = [];
    const done = new Set<string>();
    const visiting = new Set<string>();
    const path: string[] = [];
    function visit(input: string) {
      const lesson = requireLesson(input);
      if (done.has(lesson.id)) return;
      if (visiting.has(lesson.id)) {
        const cycle = [...path.slice(path.indexOf(lesson.id)), lesson.id].join(" → ");
        throw new SyllabusError(
          "syllabus-prerequisite-cycle",
          `Foundation prerequisites contain a cycle: ${cycle}.`,
        );
      }
      visiting.add(lesson.id);
      path.push(lesson.id);
      for (const id of dependencies.get(lesson.id) ?? []) visit(id);
      path.pop();
      visiting.delete(lesson.id);
      done.add(lesson.id);
      out.push(lesson);
    }
    for (const root of [...new Set(roots.map(idOf))].sort(compare)) visit(root);
    return out;
  }
  // Validate the whole graph before assigning lessons to sessions.
  const all = ordered([...byId.keys()]);
  const introduced = new Set<string>();
  const sessionIds = new Set<string>();
  const prepared = sessions.map((session): LessonPreparation => {
    validId(session.id);
    if (sessionIds.has(session.id))
      throw new SyllabusError(
        "syllabus-duplicate-id",
        `Duplicate syllabus session: ${session.id}.`,
      );
    sessionIds.add(session.id);
    const sequence = ordered(session.foundations);
    const introduce = sequence.filter((lesson) => !introduced.has(lesson.id));
    const revisit = sequence.filter((lesson) => introduced.has(lesson.id));
    for (const lesson of introduce) introduced.add(lesson.id);
    return Object.freeze({
      sessionId: session.id,
      introduce: Object.freeze(introduce),
      revisit: Object.freeze(revisit),
    });
  });
  return Object.freeze({
    sessions: Object.freeze(prepared),
    furtherStudy: Object.freeze(all.filter((lesson) => !introduced.has(lesson.id))),
    lessonCount: all.length,
  });
}
