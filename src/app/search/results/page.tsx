import type { Metadata } from "next";
import { SearchResults } from "../../../search/SearchResults.tsx";

export const metadata: Metadata = {
  title: "Search the edition",
  description:
    "Find passages, equations, instruments and lessons, with filters and shareable searches.",
  robots: { index: false, follow: true },
};

export default function SearchResultsPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">The edition, at passage level</p>
        <h1>Search the edition</h1>
        <p className="lead">
          Find the passage you remember, compare its context, and return to its source.
        </p>
      </header>
      <SearchResults />
      <nav aria-label="Search alternatives">
        <p>
          <a href="/search/">Browse the complete index without interactive search</a>
        </p>
        <p>
          <a href="/papers/">Return to the papers</a>
        </p>
      </nav>
      <noscript>
        <p>
          Interactive search needs JavaScript. The complete index linked above remains readable and
          searchable with your browser’s own Find command.
        </p>
      </noscript>
    </>
  );
}
