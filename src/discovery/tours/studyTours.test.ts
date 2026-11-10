import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load as loadYaml } from "js-yaml";
import {
  loadContentIndex,
  loadFoundationPayload,
  loadPaperPayload,
} from "../../content/compiler/serverLoaders.ts";
import { validateJourney } from "../../content/schemas/journey.ts";
import { REGISTERED_IDS } from "../../experiments/catalogue.ts";
import {
  adjacentTourPosition,
  decodeTourPosition,
  tourDestination,
  tourOutline,
  tourPosition,
} from "./navigation.ts";
import { readingMinutes } from "./readingTime.ts";
import { getAnyGuidedTour } from "./studyGuideCatalogue.ts";
import {
  companionReadingIsPublished,
  loadStudyTour,
  loadStudyTours,
  StudyTourError,
  splitStudySessions,
  studyReadingText,
} from "./studyTours.ts";
import { isStudyBudget, type StudyTour, studyGuide } from "./studyTypes.ts";

const root = process.cwd();
let tours: readonly StudyTour[];
let course: StudyTour;
beforeAll(async () => {
  tours = await loadStudyTours(root);
  const found = tours.find((tour) => tour.budget === "full-course");
  expect(found).toBeDefined();
  if (!found) throw new Error("Course fixture was not loaded.");
  course = found;
});

describe("the authored study routes", () => {
  test("every paper is read in section order and every core laboratory appears once", async () => {
    const evenings = tours.filter((tour) => tour.budget === "one-evening");
    expect(evenings.length).toBeGreaterThan(0);
    const allCourseSteps = course.sessions.flatMap((session) => session.steps);
    for (const tour of evenings) {
      const paper = await loadPaperPayload(tour.paper, root);
      const steps = tour.sessions.flatMap((session) => session.steps);
      const readings = steps.filter((stop) => stop.kind === "reading");
      expect(readings.length).toBeGreaterThan(0);
      expect(readings.map((stop) => stop.argumentId)).toEqual(
        paper.paper.sections.flatMap((section) => section.arguments),
      );
      expect(
        allCourseSteps
          .filter((stop) => stop.paper === tour.paper && stop.kind === "reading")
          .map((stop) => stop.argumentId),
      ).toEqual(readings.map((stop) => stop.argumentId));
      for (const stop of readings) {
        const argument = paper.arguments.find((item) => item.id === stop.argumentId);
        expect(argument).toBeDefined();
        if (!argument) continue;
        expect(stop.minutes).toBeGreaterThanOrEqual(
          readingMinutes(studyReadingText(argument.readings.full)),
        );
        const url = new URL(stop.href, "https://edition.invalid");
        expect(url.searchParams.get("view")).toBe("reading");
        expect(url.searchParams.get("detail")).toBe("1");
        expect(url.hash).toBe(`#${argument.id}`);
      }
      const labs = steps
        .filter((stop) => stop.kind === "instrument")
        .map((stop) => stop.instrumentId);
      expect(labs.length).toBeGreaterThan(0);
      expect(new Set(labs).size).toBe(labs.length);
      expect(steps.some((stop) => stop.kind === "capstone")).toBe(true);
      expect(steps.some((stop) => stop.kind === "misconceptions")).toBe(true);
      expect(steps.some((stop) => stop.kind === "margin")).toBe(true);
    }
    const expected = REGISTERED_IDS.filter((id) => /^(bm|me|sr|lq)-\d\d$/.test(id)).sort();
    expect(
      allCourseSteps
        .filter((stop) => stop.kind === "instrument")
        .map((stop) => stop.instrumentId)
        .sort(),
    ).toEqual(expected);
  });

  test("time estimates include all stops and each advertised sitting fits its bounds", () => {
    for (const tour of tours) {
      expect(tour.sessions.length).toBeGreaterThan(0);
      let total = 0;
      for (const session of tour.sessions) {
        expect(session.steps.length).toBeGreaterThan(0);
        expect(session.minutes).toBe(session.steps.reduce((sum, stop) => sum + stop.minutes, 0));
        expect(session.minutes).toBeLessThanOrEqual(tour.budget === "full-course" ? 120 : 240);
        expect(session.minutes).toBeGreaterThanOrEqual(tour.budget === "full-course" ? 0.5 : 60);
        for (const stop of session.steps.filter((item) => item.kind === "instrument"))
          expect(stop.minutes).toBeGreaterThanOrEqual(2);
        total += session.minutes;
      }
      expect(tour.totalMinutes).toBe(total);
    }
  });

  test("the actual foundation graph precedes each use, including across session splits", async () => {
    const index = await loadContentIndex(root);
    const lessons = await Promise.all(
      index.payloads
        .filter((entry) => entry.kind === "foundation")
        .map((entry) => loadFoundationPayload(entry.id, root)),
    );
    const allSteps = course.sessions.flatMap((session) => session.steps);
    const positions = new Map(allSteps.map((stop, position) => [stop.foundationId, position]));
    expect(lessons.length).toBeGreaterThan(0);
    expect(
      allSteps
        .filter((stop) => stop.kind === "foundation")
        .map((stop) => stop.foundationId)
        .sort(),
    ).toEqual(lessons.map((lesson) => lesson.id).sort());
    expect(course.preparation.lessonCount).toBe(lessons.length);
    expect(course.preparation.furtherStudy).toEqual([]);
    for (const lesson of lessons) {
      for (const ref of lesson.prerequisites) {
        if (typeof ref !== "string" && ref.kind === "cross-link") continue;
        const dependency = (typeof ref === "string" ? ref : ref.foundationId).replace(
          /^foundation:/,
          "",
        );
        expect(positions.get(dependency)).toBeLessThan(positions.get(lesson.id) ?? -1);
      }
    }
    let sawReadingOnlySession = false;
    for (const session of course.sessions) {
      const preparation = course.preparation.sessions.find((item) => item.sessionId === session.id);
      expect(preparation).toBeDefined();
      const available = new Set(
        [...(preparation?.introduce ?? []), ...(preparation?.revisit ?? [])].map(
          (lesson) => lesson.id,
        ),
      );
      for (const stop of session.steps.filter((item) => item.argumentId)) {
        const payload = await loadPaperPayload(stop.paper ?? "", root);
        const argument = payload.arguments.find((item) => item.id === stop.argumentId);
        expect(argument).toBeDefined();
        if (!argument) continue;
        const needed = new Set(Object.values(argument.help));
        for (const blocks of Object.values(argument.readings))
          for (const block of blocks) if (block.kind === "foundation") needed.add(block.id);
        for (const lessonId of needed) {
          expect(positions.get(lessonId)).toBeLessThan(allSteps.indexOf(stop));
          expect(available.has(lessonId)).toBe(true);
        }
        if (!session.steps.some((item) => item.foundationId)) {
          sawReadingOnlySession = true;
          expect(preparation?.revisit.length).toBeGreaterThan(0);
        }
      }
    }
    expect(sawReadingOnlySession).toBe(true);
  });

  test("all published discovery doors and exercises are in the course", () => {
    const steps = course.sessions.flatMap((session) => session.steps);
    for (const paper of new Set(
      tours.filter((tour) => tour.budget === "one-evening").map((tour) => tour.paper),
    )) {
      const journey = validateJourney(
        loadYaml(readFileSync(join(root, "content/journeys", `${paper}.yaml`), "utf8")),
      );
      for (const door of [journey.doors.frontDoor, ...journey.doors.sideDoors]) {
        const stop = steps.find((item) => item.doorId === door.id);
        expect(stop).toBeDefined();
        expect(new URL(stop?.href ?? "/missing", "https://edition.invalid").pathname).toBe(
          new URL(door.href ?? "/missing-door", "https://edition.invalid").pathname,
        );
      }
      expect(journey.exercises.length).toBeGreaterThan(0);
      for (const exercise of journey.exercises)
        expect(steps.some((stop) => stop.id === `exercise-${exercise.id}`)).toBe(true);
    }
    expect(steps.some((stop) => stop.href === "/lab/avogadro-lab/")).toBe(true);
    expect(steps.some((stop) => stop.href === "/lab/light-thread/")).toBe(true);
    expect(steps.some((stop) => stop.href.startsWith("/essays/"))).toBe(false);
    expect(course.inPreparation.some((item) => item.includes("Reasoning essay:"))).toBe(true);
  });

  test("the lazy guide is the exact checked outline and every bookmark round trips", () => {
    for (const tour of tours) {
      const guide = studyGuide(tour);
      expect(getAnyGuidedTour(tour.id)).toEqual(guide);
      for (const stop of guide.stops) {
        const position = tourPosition(guide, stop, getAnyGuidedTour);
        const url = new URL(tourDestination(position, getAnyGuidedTour), "https://edition.invalid");
        expect(decodeTourPosition(url.search, getAnyGuidedTour)).toEqual({
          kind: "position",
          position,
        });
        expect(tourOutline(position, getAnyGuidedTour)).toBe(
          `/tours/${tour.id}/#tour-stop-${stop.id}`,
        );
        const next = adjacentTourPosition(position, 1, getAnyGuidedTour);
        if (next) expect(adjacentTourPosition(next, -1, getAnyGuidedTour)).toEqual(position);
      }
    }
  });

  test("unknown study budgets and routes cannot produce a plausible course", async () => {
    expect(isStudyBudget("next-year")).toBe(false);
    expect(await loadStudyTour(root, "missing-course")).toBeNull();
    expect(
      decodeTourPosition(
        "?tour=full-course&tourRevision=0&tourStop=course-orientation",
        getAnyGuidedTour,
      ).kind,
    ).toBe("invalid");
    try {
      splitStudySessions(course.sessions, 0);
      throw new Error("An invalid budget was accepted.");
    } catch (error) {
      expect(error).toBeInstanceOf(StudyTourError);
      expect((error as StudyTourError).code).toBe("study-tour-invalid");
    }
  });

  test("the companion needs an explicit shipment outcome, not a listed option", () => {
    expect(companionReadingIsPublished(readFileSync(join(root, "docs/DECISIONS.md"), "utf8"))).toBe(
      false,
    );
    expect(
      companionReadingIsPublished(
        "## D-2026-09-15-companion-at-launch\n- **Outcome:** **Shipped at launch**.\n",
      ),
    ).toBe(true);
    expect(
      companionReadingIsPublished(
        "## D-2026-09-15-companion-at-launch\n- **Options:** Ship at launch.\n- **Outcome:** Deferred.\n",
      ),
    ).toBe(false);
  });
});
