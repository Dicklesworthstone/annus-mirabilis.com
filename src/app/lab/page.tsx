import type { Metadata } from "next";
import InstrumentsIndex from "../instruments/page.tsx";

export const metadata: Metadata = {
  title: "Instruments",
  description:
    "Every instrument in the edition, grouped by the paper whose argument it serves, each named by the question it answers.",
  alternates: { canonical: "/instruments/" },
};

/**
 * /lab/ had no page. Every instrument lives at /lab/<id>/, so a reader who trims a lab URL back
 * to /lab/ reached a directory listing on a local static server and a 404 on Vercel: a dead end
 * one edit away from every instrument in the edition.
 *
 * It shows the instruments catalogue, the same component /instruments/ renders, rather than a
 * second list that could drift from it. The canonical URL stays /instruments/, so the catalogue
 * has one address for search engines and this route is only the door a trimmed URL finds.
 */
export default function LabIndex() {
  return <InstrumentsIndex />;
}
