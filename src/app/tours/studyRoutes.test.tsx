import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadStudyTours } from "../../discovery/tours/studyTours.ts";
import TourPage, { generateMetadata, generateStaticParams } from "./[tour]/page.tsx";
import SyllabusPage from "./full-course/syllabus/page.tsx";
import ToursIndex from "./page.tsx";

test("all study routes resolve from the public index and static route parameters", async () => {
  const tours = await loadStudyTours(process.cwd());
  const params = generateStaticParams();
  expect(new Set(params.map((entry) => entry.tour)).size).toBe(params.length);
  const html = renderToStaticMarkup(await ToursIndex());
  expect(tours.length).toBeGreaterThan(0);
  for (const tour of tours) {
    expect(params.filter((entry) => entry.tour === tour.id)).toHaveLength(1);
    expect(html).toContain(`href="/tours/${tour.id}/"`);
    const props = { params: Promise.resolve({ tour: tour.id }) };
    const page = renderToStaticMarkup(await TourPage(props));
    expect(page).toContain(`data-study-tour="${tour.id}"`);
    expect((await generateMetadata(props)).alternates?.canonical).toBe(`/tours/${tour.id}/`);
    expect(page).not.toMatch(
      /no (?:person|one) has reviewed|machine[- ]draft|(?:source|editorial|physics) review/i,
    );
  }
  expect(html).toContain('href="/tours/full-course/syllabus/"');
});

test("the printable public route renders the real course without JavaScript", async () => {
  const html = renderToStaticMarkup(await SyllabusPage());
  expect(html).toContain("data-study-syllabus");
  expect(html).toContain("study-print-address");
  expect(html).toContain('href="/tours/full-course/"');
  expect(html).toContain('href="/foundations/');
});
