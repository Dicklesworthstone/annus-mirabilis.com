/** Server-only composition of the longer tours from the edition's published records. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load as loadYaml } from "js-yaml";
import type { PaperPayload } from "../../content/compiler/compile.ts";
import {
  loadContentIndex,
  loadFoundationPayload,
  loadPaperPayload,
} from "../../content/compiler/serverLoaders.ts";
import { loadRegistry } from "../../content/foundations/registry.ts";
import { loadEssays } from "../../content/essays/load.ts";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { validateJourney } from "../../content/schemas/journey.ts";
import type { Argument, Block, Foundation } from "../../content/schemas/reading.ts";
import { REGISTERED_IDS } from "../../experiments/catalogue.ts";
import { loadPaperMargins } from "../../reader/marginRecords.ts";
import { CONNECTION_EXERCISE_LINKS } from "../connections/links.ts";
import { localTourUrl } from "./navigation.ts";
import { readingMinutes } from "./readingTime.ts";
import { isStudyBudget, type StudySession, type StudyStep, type StudyTour } from "./studyTypes.ts";
import { buildSyllabus, type Syllabus } from "./syllabus.ts";

export type { StudySession, StudyStep, StudyTour } from "./studyTypes.ts";

const PAPERS = ["brownian-motion", "mass-energy", "special-relativity", "light-quanta"] as const;
const PREFIX: Readonly<Record<string, string>> = {
  "brownian-motion": "bm-",
  "mass-energy": "me-",
  "special-relativity": "sr-",
  "light-quanta": "lq-",
};
const EMPTY_SYLLABUS: Syllabus = { sessions: [], furtherStudy: [], lessonCount: 0 };

export class StudyTourError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "StudyTourError";
    this.code = code;
  }
}
function invalid(message: string): never {
  throw new StudyTourError("study-tour-invalid", message);
}
function object(value: unknown, where: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid(`${where}: expected a record.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, where: string): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 10000 ||
    /<[!/?a-z]/i.test(value)
  )
    return invalid(`${where}: expected bounded plain text.`);
  return value;
}
function id(value: unknown, where: string): string {
  const result = text(value, where);
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(result) || result.length > 100)
    return invalid(`${where}: invalid stable id.`);
  return result;
}
function list(value: unknown, where: string): readonly unknown[] {
  if (!Array.isArray(value) || value.length > 256)
    return invalid(`${where}: expected a bounded list.`);
  return value;
}
function strings(value: unknown, where: string): string[] {
  return list(value, where).map((item) => text(item, where));
}
function record(root: string, name: string): Record<string, unknown> {
  return object(parseYaml(readFileSync(join(root, "content/tours", `${name}.yaml`), "utf8")), name);
}

/** Only these two declared budgets are dispatched here; the timed loader refuses unknown ones. */
export function studyTourIds(root: string): readonly string[] {
  const directory = join(root, "content/tours");
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(".yaml"))
    .map((name) => name.slice(0, -5))
    .filter((name) => isStudyBudget(record(root, name).budget))
    .sort();
}

function header(raw: Record<string, unknown>, name: string) {
  if (raw.schemaVersion !== 1 || raw.requiresEquations !== true || !isStudyBudget(raw.budget))
    return invalid(`${name}: expected a version-one study tour with equations and a known budget.`);
  if (id(raw.id, name) !== name || !Number.isSafeInteger(raw.revision) || Number(raw.revision) < 1)
    return invalid(`${name}: mismatched identity or invalid revision.`);
  return {
    id: name,
    revision: Number(raw.revision),
    budget: raw.budget,
    requiresEquations: true as const,
    title: text(raw.title, `${name}.title`),
    introduction: text(raw.introduction, `${name}.introduction`),
    paper: text(raw.paper, `${name}.paper`),
  };
}

export function studyReadingText(blocks: readonly Block[]): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case "paragraph":
          return block.text;
        case "formula":
          return block.spoken;
        case "steps":
          return block.items.join(" ");
        case "foundation":
          return block.returnCaption;
      }
      return invalid("An unsupported reading block cannot produce a reading-time estimate.");
    })
    .join(" ");
}

function step(value: StudyStep): StudyStep {
  localTourUrl(value.href);
  if (!Number.isFinite(value.minutes) || value.minutes <= 0 || value.minutes > 120)
    return invalid(`${value.id}: an individual stop must fit a two-hour session.`);
  return value;
}
function session(
  id: string,
  title: string,
  summary: string,
  steps: readonly StudyStep[],
): StudySession {
  return { id, title, summary, steps, minutes: steps.reduce((sum, item) => sum + item.minutes, 0) };
}

/** Split at stop boundaries without discarding time or moving a prerequisite after its use. */
export function splitStudySessions(sessions: readonly StudySession[], limit = 120): StudySession[] {
  if (!Number.isFinite(limit) || limit <= 0) return invalid("Session limit must be positive.");
  return sessions.flatMap((source) => {
    const chunks: StudyStep[][] = [];
    let current: StudyStep[] = [];
    let minutes = 0;
    for (const item of source.steps) {
      if (item.minutes <= 0 || !Number.isFinite(item.minutes) || item.minutes > limit)
        return invalid(`${item.id}: stop exceeds the session budget.`);
      if (minutes + item.minutes > limit) {
        chunks.push(current);
        current = [];
        minutes = 0;
      }
      current.push(item);
      minutes += item.minutes;
    }
    if (current.length) chunks.push(current);
    return chunks.map((steps, index) =>
      session(
        chunks.length === 1 ? source.id : `${source.id}-part-${index + 1}`,
        chunks.length === 1
          ? source.title
          : `${source.title} · Part ${index + 1} of ${chunks.length}`,
        source.summary,
        steps,
      ),
    );
  });
}

function readerHref(paper: string, section?: string, anchor?: string): string {
  return `/papers/${paper}/${section ? `${section}/` : ""}?view=reading&detail=1${anchor ? `#${anchor}` : ""}`;
}
function detailOne(href: string): string {
  const url = localTourUrl(href);
  if (url.pathname.startsWith("/papers/")) {
    url.searchParams.set("view", "reading");
    url.searchParams.set("detail", "1");
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function readingStep(paper: PaperPayload, argument: Argument): StudyStep {
  const section = paper.paper.sections.find((part) => part.id === argument.section);
  if (!section) return invalid(`${argument.id}: missing paper section.`);
  return step({
    id: argument.id,
    title: argument.title,
    kind: "reading",
    activity: "read",
    paper: paper.paper.id,
    section: argument.section,
    argumentId: argument.id,
    href: readerHref(paper.paper.id, argument.section, argument.id),
    minutes: Math.max(5, readingMinutes(studyReadingText(argument.readings.full))),
    task: `Read ${section.title} at detail 1, focusing on this passage. Follow an unfamiliar step into its foundation lesson and use the return link to resume.`,
    question: argument.question,
    explanation: argument.recap,
  });
}

function laboratory(root: string, paper: string, labId: string, afterArgument: string): StudyStep {
  if (
    !(REGISTERED_IDS as readonly string[]).includes(labId) ||
    !labId.startsWith(PREFIX[paper] ?? "!")
  )
    return invalid(`${labId}: expected a registered core laboratory for ${paper}.`);
  const raw = object(
    parseYaml(readFileSync(join(root, "content/experiments", `${labId}.yaml`), "utf8")),
    labId,
  );
  if (!strings(raw.argumentIds, `${labId}.argumentIds`).includes(afterArgument))
    return invalid(
      `${labId}: the chosen preceding argument is not in the laboratory's source mapping.`,
    );
  return step({
    id: `lab-${labId}`,
    title: text(raw.title, `${labId}.title`),
    activity: "experiment",
    kind: "instrument",
    paper,
    instrumentId: labId,
    href: `/lab/${labId}/`,
    minutes: 5,
    task: "Make a prediction before changing one control. Compare the result with the worked example, then state which assumptions you kept fixed.",
    question: text(raw.explanatoryQuestion, `${labId}.explanatoryQuestion`),
    explanation:
      "The instrument computes consequences of its stated model. Its numerical result and any synthetic observations keep the provenance shown on that page; running it supplies no new historical observation.",
  });
}

function journeySteps(root: string, paper: string, course: boolean): StudyStep[] {
  const path = join(root, "content/journeys", `${paper}.yaml`);
  const journey = validateJourney(loadYaml(readFileSync(path, "utf8")), path);
  if (journey.paper !== paper) return invalid(`${paper}: mismatched discovery journey.`);
  const result: StudyStep[] = [
    step({
      id: `journey-${paper}`,
      title: "Reconstruct the route from its premises",
      kind: "journey",
      activity: "reconstruct",
      paper,
      href: `/discover/${paper}/`,
      minutes: 15,
      task: "Follow the discovery route through its forks. Name the move that makes the conclusion possible before opening its explanation.",
      question: journey.firstHonestQuestion,
      explanation: journey.move.r0Summary.text,
    }),
  ];
  const doors = [journey.doors.frontDoor, ...(course ? journey.doors.sideDoors : [])];
  for (const door of doors) {
    if (!door.href) return invalid(`${door.id}: a course door needs a published destination.`);
    result.push(
      step({
        id: door.id,
        title: door.title,
        kind: "door",
        activity: "reconstruct",
        doorId: door.id,
        paper,
        href: detailOne(door.href),
        minutes: 5,
        task:
          door.summary ?? "Follow this route and compare its assumptions with the paper's route.",
        question: "What does this route assume, and which result does it reach?",
        explanation: `The journey identifies the common arrival as ${door.arrivesAtLabel ?? door.arrivesAtEquationId}. Read its provenance before treating a later construction as part of 1905.`,
      }),
    );
  }
  if (course)
    for (const [index, exercise] of journey.exercises.entries()) {
      result.push(
        step({
          id: `exercise-${exercise.id}`,
          title: `Discovery exercise ${index + 1}`,
          kind: "exercise",
          activity: "reconstruct",
          paper,
          href: `/discover/${paper}/`,
          minutes: 5,
          task: "Find this exercise in the discovery route. Try the question, then open the worked explanation whenever it helps.",
          question: text(exercise.prompt, `${exercise.id}.prompt`),
          explanation:
            "The exercise's own explanation supplies its assumptions and comparison. A numerical check tests the submitted expression within its declared domain; an explanation in your own words remains for a reader to judge.",
        }),
      );
    }
  return result;
}

function reviewSteps(root: string, raw: Record<string, unknown>, paper: string): StudyStep[] {
  const margins = loadPaperMargins(paper, root);
  if (!margins.misconceptions.length)
    return invalid(`${paper}: the misconception ledger is empty.`);
  const result: StudyStep[] = [
    step({
      id: `results-${paper}`,
      title: "Put the results back beside their conditions",
      kind: "results",
      activity: "read",
      paper,
      href: `/papers/${paper}/view/results/`,
      minutes: 5,
      task: "Review the results face. For each result, name its assumptions, the argument that supplies it and the limit of its use.",
      question:
        "Which conclusions are exact within the stated model, and which depend on an approximation or heuristic?",
      explanation:
        "The results cards distinguish the printed relation, its modern notation and the scope of the claim. The supporting argument remains part of the result.",
    }),
    step({
      id: `misconceptions-${paper}`,
      title: "Work through the common wrong turns",
      kind: "misconceptions",
      activity: "read",
      paper,
      href: readerHref(paper, undefined, "common-wrong-turns"),
      minutes: Math.max(8, margins.misconceptions.length * 2),
      task: "Read each tempting claim and its correction in the collected ledger. Explain why the tempting version can seem plausible.",
      question: "Under which narrower conditions could a tempting claim be true?",
      explanation:
        "Each correction gives a boundary and, where available, an instrument comparison. Keep the correction attached to those conditions when returning to the results.",
    }),
  ];
  for (const value of list(raw.margins, `${paper}.margins`)) {
    const note = object(value, `${paper}.margin`);
    const noteId = id(note.id, `${paper}.margin.id`);
    const source = margins.notes.find((item) => item.id === noteId);
    if (!source) return invalid(`${paper}: missing editorial note ${noteId}.`);
    result.push(
      step({
        id: noteId,
        title: text(note.title, `${noteId}.title`),
        kind: "margin",
        activity: "read",
        paper,
        href: readerHref(paper, undefined, `note-${noteId}`),
        minutes: Math.max(3, readingMinutes(source.claim)),
        task: "Read the historian's margin and the sources attached to this note. Distinguish the original statement from the later commentary.",
        question: text(note.question, `${noteId}.question`),
        explanation:
          "This is editorial commentary with its own source support. Its claim remains separate from the original author's words when placed beside the paper.",
      }),
    );
  }
  const capstone = object(
    parseYaml(readFileSync(join(root, "content/arguments/capstones", `${paper}.yaml`), "utf8")),
    paper,
  );
  result.push(
    step({
      id: `capstone-${paper}`,
      title: text(capstone.title, `${paper}.capstone.title`),
      kind: "capstone",
      activity: "reconstruct",
      paper,
      href: `/capstones/${paper}/`,
      minutes: 12,
      task: "Rebuild the argument from its claims, then compare the order you chose with the available explanation. You may read the explanation at any time.",
      question: "Which conclusion needs each premise, and what fails if that premise is removed?",
      explanation:
        "Reconstruction tests the dependency of the argument. Reaching the end of the route records no score or certification of understanding.",
    }),
  );
  return result;
}

async function evening(
  root: string,
  name: string,
  raw: Record<string, unknown>,
  course: boolean,
): Promise<StudyTour> {
  const meta = header(raw, name);
  if (meta.budget !== "one-evening" || !PAPERS.includes(meta.paper as (typeof PAPERS)[number]))
    return invalid(`${name}: an evening needs one of the four papers.`);
  const payload = await loadPaperPayload(meta.paper, root);
  const labs = list(raw.laboratories, `${name}.laboratories`).map((value) => {
    const source = object(value, `${name}.laboratory`);
    const afterArgument = id(source.afterArgument, `${name}.afterArgument`);
    const labId = id(source.id, `${name}.laboratory.id`);
    return { afterArgument, value: laboratory(root, meta.paper, labId, afterArgument) };
  });
  const allLabIds = labs.map((lab) => lab.value.instrumentId);
  const expected = REGISTERED_IDS.filter((labId) => labId.startsWith(PREFIX[meta.paper] ?? "!"));
  if (
    new Set(allLabIds).size !== allLabIds.length ||
    expected.some((labId) => !allLabIds.includes(labId))
  )
    return invalid(`${name}: every core instrument must occur exactly once.`);
  const seenSections: string[] = [];
  const seenArguments = new Set<string>();
  const sessions = list(raw.sessions, `${name}.sessions`).map((value) => {
    const source = object(value, `${name}.session`);
    const steps: StudyStep[] = [];
    for (const sectionId of strings(source.sections, `${name}.sections`)) {
      const section = payload.paper.sections.find((part) => part.id === sectionId);
      if (!section || seenSections.includes(sectionId))
        return invalid(`${name}: missing or repeated section ${sectionId}.`);
      seenSections.push(sectionId);
      for (const argumentId of section.arguments) {
        const argument = payload.arguments.find((item) => item.id === argumentId);
        if (!argument) return invalid(`${name}: missing argument ${argumentId}.`);
        seenArguments.add(argumentId);
        steps.push(readingStep(payload, argument));
        steps.push(
          ...labs.filter((lab) => lab.afterArgument === argumentId).map((lab) => lab.value),
        );
      }
    }
    return session(
      id(source.id, `${name}.session.id`),
      text(source.title, `${name}.session.title`),
      text(source.summary, `${name}.session.summary`),
      steps,
    );
  });
  if (
    seenSections.join("|") !== payload.paper.sections.map((part) => part.id).join("|") ||
    labs.some((lab) => !seenArguments.has(lab.afterArgument))
  )
    return invalid(
      `${name}: sections must cover the whole paper in order, with all lab stops placed.`,
    );
  const last = sessions.at(-1);
  if (!last) return invalid(`${name}: the tour needs a session.`);
  sessions[sessions.length - 1] = session(last.id, last.title, last.summary, [
    ...last.steps,
    ...journeySteps(root, meta.paper, course),
    ...reviewSteps(root, raw, meta.paper),
  ]);
  if (!course && sessions.some((part) => part.minutes < 60 || part.minutes > 240))
    return invalid(`${name}: split an evening into honest parts of one to four hours.`);
  return {
    ...meta,
    sessions,
    preparation: EMPTY_SYLLABUS,
    totalMinutes: sessions.reduce((sum, part) => sum + part.minutes, 0),
    sourceNotices: [{ paper: meta.paper, text: payload.paper.sourceNotice }],
    inPreparation: strings(raw.inPreparation, `${name}.inPreparation`),
  };
}

function lessonStep(lesson: Foundation): StudyStep {
  return step({
    id: `foundation-${lesson.id}`,
    title: lesson.title,
    kind: "foundation",
    activity: "read",
    foundationId: lesson.id,
    href: `/foundations/${lesson.id}/`,
    minutes: Math.max(
      5,
      readingMinutes(studyReadingText([...lesson.explanation, ...lesson.example])),
    ),
    task: lesson.summary,
    question: lesson.question,
    explanation: lesson.stoppingPoint,
  });
}

function orientation(): StudySession {
  return session(
    "course-entry",
    "Find your way through an argument",
    "Choose a face, open a missing step and return to the passage that called it.",
    [
      step({
        id: "course-orientation",
        title: "The paper, the explanation and the return path",
        kind: "orientation",
        activity: "read",
        href: readerHref("brownian-motion", undefined, "entry-brownian-motion"),
        minutes: 10,
        task: "Begin with the first encounter. Use the face chooser to compare the explanation with the source or translation. Set detail 1, open one foundation link and return to the calling passage.",
        question: "Which voice are you reading, and where can you check the source of a claim?",
        explanation:
          "The explanation, translation, German transcription and facsimile have separate roles. Detail changes the amount of explanation. A foundation lesson supplies a missing step, and its return link takes you back to the passage that opened it.",
      }),
    ],
  );
}

function connections(): StudySession {
  const rows = [
    {
      id: "connections",
      title: "What crosses the paper boundary?",
      href: "/connections/",
      minutes: 15,
      question: "Which connections are explicit imports, shared methods or later comparisons?",
    },
    {
      id: "molecular-number",
      title: "Compare the routes to a molecular number",
      href: "/lab/avogadro-lab/",
      minutes: 10,
      question: "Which independent measurements does each determination require?",
    },
    {
      id: "light-thread",
      title: "One pulse, three questions",
      href: "/lab/light-thread/",
      minutes: 10,
      question:
        "What changes when light acts as a clock signal, an energy carrier or an absorbed quantum?",
    },
  ];
  return session(
    "course-connections",
    "Connect the arguments without merging their premises",
    "Compare the four papers, then try the transfer exercises or read their worked explanations.",
    [
      ...rows.map((row) =>
        step({
          ...row,
          kind: "connection",
          activity: "reconstruct",
          task: "Follow the comparison and write down the inputs each route assumes. Keep an imported result separate from a resemblance noticed afterward.",
          explanation:
            "The comparison names which relation is being transferred and which assumptions stay with its original derivation. The molecular-dimensions instrument is a companion preview; illustrative settings are not historical observations.",
        }),
      ),
      ...CONNECTION_EXERCISE_LINKS.map((exercise) =>
        step({
          ...exercise,
          kind: "exercise",
          activity: "reconstruct",
        }),
      ),
    ],
  );
}

/** An option describing possible shipment is not a recorded shipment decision. */
export function companionReadingIsPublished(decisions: string): boolean {
  const decision = decisions
    .split(/^## /m)
    .find((section) => section.startsWith("D-2026-09-15-companion-at-launch\n"));
  return (
    decision !== undefined &&
    /^- \*\*(?:Status|Outcome|Launch outcome)(?::\*\*|\*\*:)\s*(?:\*\*)?Shipped\b/im.test(decision)
  );
}

function rootsFromSteps(
  steps: readonly StudyStep[],
  argumentsById: ReadonlyMap<string, Argument>,
): string[] {
  const needed = new Set<string>();
  for (const stop of steps) {
    if (stop.foundationId) needed.add(stop.foundationId);
    const argument = stop.argumentId ? argumentsById.get(stop.argumentId) : undefined;
    if (!argument) continue;
    for (const foundation of Object.values(argument.help)) needed.add(foundation);
    for (const blocks of Object.values(argument.readings))
      for (const block of blocks) if (block.kind === "foundation") needed.add(block.id);
  }
  return [...needed];
}

async function course(
  root: string,
  raw: Record<string, unknown>,
  records: ReadonlyMap<string, Record<string, unknown>>,
): Promise<StudyTour> {
  const meta = header(raw, "full-course");
  if (meta.budget !== "full-course" || meta.paper !== "all")
    return invalid("full-course: expected all four papers.");
  const sequence = strings(raw.sequence, "full-course.sequence");
  if (sequence.join("|") !== PAPERS.map((paper) => `one-evening-${paper}`).join("|"))
    return invalid(
      "full-course: expected Brownian motion, mass-energy, relativity, then light quanta.",
    );
  const tours = await Promise.all(
    sequence.map((name) => {
      const source = records.get(name);
      if (!source) return invalid(`full-course: missing evening route ${name}.`);
      return evening(root, name, source, true);
    }),
  );
  const index = await loadContentIndex(root);
  const lessons = await Promise.all(
    index.payloads
      .filter((entry) => entry.kind === "foundation")
      .map((entry) => loadFoundationPayload(entry.id, root)),
  );
  if (!lessons.length) return invalid("full-course: no published foundation graph.");
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const payloads = await Promise.all(PAPERS.map((paper) => loadPaperPayload(paper, root)));
  const companionEntry = index.payloads.find(
    (entry) => entry.kind === "paper" && entry.id === "molecular-dimensions",
  );
  const companion =
    companionEntry &&
    companionReadingIsPublished(readFileSync(join(root, "docs/DECISIONS.md"), "utf8"))
      ? await loadPaperPayload(companionEntry.id, root)
      : null;
  if (companion) payloads.push(companion);
  const argumentsById = new Map(
    payloads.flatMap((payload) =>
      payload.arguments.map((argument) => [argument.id, argument] as const),
    ),
  );
  const entry = orientation();
  const bridges = session(
    "course-bridges",
    "The notation bridges",
    "Read the short bridges in prerequisite order. Revisit any of them from a later lesson.",
    [],
  );
  const remaining = session(
    "course-further-foundations",
    "Complete the foundation library",
    "These published lessons extend the tools used in the papers. Their prerequisite chains stay visible in the syllabus.",
    [],
  );
  const companionSteps = companion
    ? companion.paper.sections.flatMap((section) =>
        section.arguments.map((argumentId) => {
          const argument = companion.arguments.find((item) => item.id === argumentId);
          if (!argument) return invalid(`Companion argument ${argumentId} is absent.`);
          return readingStep(companion, argument);
        }),
      )
    : [];
  const companionSessions = companion
    ? [
        session(
          "course-companion",
          companion.paper.title,
          companion.paper.description,
          companionSteps,
        ),
      ]
    : [];
  const publishedEssays = loadEssays(root);
  const essaySlugs = strings(raw.essays ?? [], "full-course.essays");
  const essaySteps = essaySlugs.map((slug) => {
    const essay = publishedEssays.find((item) => item.slug === slug);
    if (!essay) return invalid("full-course: missing published essay " + slug + ".");
    return step({
      id: "essay-" + essay.slug, kind: "essay", activity: "read", title: essay.title,
      href: "/essays/" + essay.slug + "/",
      minutes: readingMinutes(essay.searchText) + 5,
      task: "Read the paper examples, try one linked instrument, then examine a transfer and its stated limit.",
      question: "Which part of the reasoning transfers, and which assumptions remain specific to its source?",
      explanation: essay.r0Summary,
    });
  });
  const planned = [
    entry,
    bridges,
    ...tours.flatMap((tour) => tour.sessions),
    ...companionSessions,
    remaining,
    connections(),
    ...(essaySteps.length ? [session("course-essays", "Read the reasoning across the papers", "Contemporary methodological readings with source passages, instruments and bounded examples from other fields.", essaySteps)] : []),
  ];
  const roots = planned.map((part) => {
    if (part.id === bridges.id)
      return {
        id: part.id,
        foundations: lessons
          .filter((lesson) => lesson.id.startsWith("bridge-"))
          .map((lesson) => lesson.id),
      };
    if (part.id === remaining.id)
      return { id: part.id, foundations: lessons.map((lesson) => lesson.id) };
    return { id: part.id, foundations: rootsFromSteps(part.steps, argumentsById) };
  });
  // Root choices come from the real arguments. Only Foundation.prerequisites orders lessons.
  const preparation = buildSyllabus(lessons, roots);
  const withLessons = planned.map((part) => {
    const introduction = preparation.sessions.find((item) => item.sessionId === part.id);
    const before = (introduction?.introduce ?? []).map((lesson) => {
      const full = byId.get(lesson.id);
      if (!full) return invalid(`Missing compiled lesson ${lesson.id}.`);
      return lessonStep(full);
    });
    return session(part.id, part.title, part.summary, [...before, ...part.steps]);
  });
  const sessions = splitStudySessions(withLessons);
  // Recompute presentation groups after splitting. The same graph remains the only dependency source.
  const finalPreparation = buildSyllabus(
    lessons,
    sessions.map((part) => ({
      id: part.id,
      foundations: rootsFromSteps(part.steps, argumentsById),
    })),
  );
  const missingLessons = loadRegistry(join(root, "content/foundations/registry.yaml"))
    .entries.map((item) => item.id.replace(/^foundation:/, ""))
    .filter((lesson) => !byId.has(lesson));
  const inPreparation = [
    ...tours.flatMap((tour) => tour.inPreparation),
    ...missingLessons.map(
      (lesson) =>
        `The planned foundation lesson “${lesson.replace(/-/g, " ")}” has no published reading yet.`,
    ),
    ...strings(raw.essaysInPreparation, "full-course.essaysInPreparation").map(
      (title) => `Reasoning essay: ${title}.`,
    ),
  ];
  if (!companion) {
    inPreparation.push(
      "The full molecular-dimensions companion reading is in preparation. Its three-way molecular-number instrument is available as a preview in the connections session.",
    );
  }
  return {
    ...meta,
    sessions,
    preparation: finalPreparation,
    totalMinutes: sessions.reduce((sum, part) => sum + part.minutes, 0),
    sourceNotices: payloads.map((payload) => ({
      paper: payload.paper.id,
      text: payload.paper.sourceNotice,
    })),
    inPreparation,
  };
}

export async function loadStudyTours(root: string): Promise<readonly StudyTour[]> {
  const records = new Map(studyTourIds(root).map((name) => [name, record(root, name)]));
  const tours: StudyTour[] = [];
  for (const [name, raw] of records) {
    if (raw.budget === "one-evening") tours.push(await evening(root, name, raw, false));
    else if (name === "full-course") tours.push(await course(root, raw, records));
    else return invalid(`${name}: full-course has one canonical route.`);
  }
  for (const tour of tours) {
    const ids = tour.sessions.flatMap((part) => part.steps.map((stop) => stop.id));
    if (!ids.length || new Set(ids).size !== ids.length)
      return invalid(`${tour.id}: stop ids must be unique and nonempty.`);
  }
  return tours;
}

export async function loadStudyTour(root: string, name: string): Promise<StudyTour | null> {
  if (!studyTourIds(root).includes(name)) return null;
  return (await loadStudyTours(root)).find((tour) => tour.id === name) ?? null;
}
