import { beforeAll, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StudySyllabus } from "./StudySyllabus.tsx";
import { StudyTourPage } from "./StudyTourPage.tsx";
import { loadStudyTours } from "./studyTours.ts";
import type { StudyTour } from "./studyTypes.ts";

let tours: readonly StudyTour[];
beforeAll(async () => {
  tours = await loadStudyTours(process.cwd());
});

test("each long route exposes all stops, questions and return anchors in server-rendered HTML", () => {
  expect(tours.length).toBeGreaterThan(0);
  for (const tour of tours) {
    const html = renderToStaticMarkup(<StudyTourPage tour={tour} />);
    for (const session of tour.sessions) {
      expect(html).toContain(`id="session-${session.id}"`);
      for (const stop of session.steps) {
        expect(html).toContain(`id="tour-stop-${stop.id}"`);
        expect(html).toContain(`tourStop=${stop.id}`);
        expect(html).toContain("Read the explanation at any time");
      }
    }
    expect(html).toContain('id="tour-finish"');
    expect(html).toContain("Without it, every destination below remains a working link.");
  }
});

test("the printable syllabus includes every actual stop, its address and incomplete scope", () => {
  const course = tours.find((tour) => tour.budget === "full-course");
  expect(course).toBeDefined();
  if (!course) return;
  const html = renderToStaticMarkup(<StudySyllabus tour={course} />);
  for (const session of course.sessions) {
    expect(html).toContain(`id="syllabus-${session.id}"`);
    for (const stop of session.steps) {
      expect(html).toContain(`href="${stop.href.replaceAll("&", "&amp;")}"`);
    }
  }
  expect(html).toContain("study-print-address");
  expect(html).toContain("A4 or Letter");
  expect(html).toContain("Planned material still in preparation");
  expect(html).toContain("Available from earlier sessions:");
});
