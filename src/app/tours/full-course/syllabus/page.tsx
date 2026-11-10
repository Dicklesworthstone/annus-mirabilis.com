import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudySyllabus } from "../../../../discovery/tours/StudySyllabus.tsx";
import { loadStudyTour } from "../../../../discovery/tours/studyTours.ts";
import "../../../../discovery/tours/tours.css";

export const metadata: Metadata = {
  title: "Course syllabus",
  description:
    "A printable, prerequisite-ordered course through the four papers, their foundations, instruments and discovery routes.",
  alternates: { canonical: "/tours/full-course/syllabus/" },
};

export default async function CourseSyllabusPage() {
  const tour = await loadStudyTour(process.cwd(), "full-course");
  if (!tour) notFound();
  return <StudySyllabus tour={tour} />;
}
