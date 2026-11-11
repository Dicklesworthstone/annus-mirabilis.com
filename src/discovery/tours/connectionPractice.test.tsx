import { beforeAll, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CONNECTION_EXERCISE_LINKS } from "../connections/links.ts";
import { decodeTourPosition, tourDestination, tourPosition } from "./navigation.ts";
import { StudySyllabus } from "./StudySyllabus.tsx";
import { StudyTourPage } from "./StudyTourPage.tsx";
import { loadStudyTour } from "./studyTours.ts";
import { type StudyTour, studyGuide } from "./studyTypes.ts";

let course: StudyTour;
beforeAll(async () => {
  const result = await loadStudyTour(process.cwd(), "full-course");
  expect(result).not.toBeNull();
  if (result) course = result;
});

describe("transfer practice in the full course", () => {
  test("the connection exercises follow the individual journeys as real course stops", () => {
    const stops = course.sessions.flatMap((session) => session.steps);
    const journeyStops = stops.filter((stop) => stop.kind === "journey");
    expect(new Set(journeyStops.map((stop) => stop.paper)).size).toBe(4);
    for (const exercise of CONNECTION_EXERCISE_LINKS) {
      const matches = stops.filter((stop) => stop.id === exercise.id);
      expect(matches).toHaveLength(1);
      const stop = matches[0];
      if (!stop) continue;
      expect(stop?.kind).toBe("exercise");
      expect(stop?.href).toBe(exercise.href);
      expect(stop?.minutes).toBeGreaterThan(0);
      for (const journey of journeyStops)
        expect(stops.indexOf(journey)).toBeLessThan(stops.indexOf(stop));
    }
  });

  test("the static course and printable syllabus reach every exercise without JavaScript", () => {
    const page = renderToStaticMarkup(<StudyTourPage tour={course} />);
    const syllabus = renderToStaticMarkup(<StudySyllabus tour={course} />);
    for (const exercise of CONNECTION_EXERCISE_LINKS) {
      expect(page).toContain(`href="${exercise.href}"`);
      expect(syllabus).toContain(`href="${exercise.href}"`);
      expect(page).toContain(`id="tour-stop-${exercise.id}"`);
    }
  });

  test("new bookmarks round trip while a pre-exercise course revision cannot be reinterpreted", () => {
    const guide = studyGuide(course);
    const lookup = (id: string) => (id === guide.id ? guide : null);
    expect(guide.revision).toBeGreaterThan(2);
    for (const exercise of CONNECTION_EXERCISE_LINKS) {
      const stop = guide.stops.find((item) => item.id === exercise.id);
      expect(stop).toBeDefined();
      if (!stop) continue;
      const position = tourPosition(guide, stop, lookup);
      const url = new URL(tourDestination(position, lookup), "https://edition.invalid");
      expect(url.hash).toBe(`#${exercise.id}`);
      expect(decodeTourPosition(url.search, lookup)).toEqual({ kind: "position", position });
      for (const revision of ["1", "2"]) {
        url.searchParams.set("tourRevision", revision);
        expect(decodeTourPosition(url.search, lookup).kind).toBe("invalid");
      }
    }
  });
});
