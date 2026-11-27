import type { Metadata } from "next";
import { loadFirstPages } from "../../components/home/firstPages.ts";
import { formatSize, OfflineChapterLinks } from "../../platform/offline/OfflineChapterLinks.tsx";
import { loadOfflineManifest } from "../../platform/offline/server.ts";
import { offlineFacts } from "./offlineFacts.ts";
import "../../components/home/wideProse.css";

export const metadata: Metadata = {
  title: "Chapters to read offline",
  description:
    "Each explained section as one HTML file that opens without a connection, with available German source text, English translation, mathematics and linked lessons.",
};

export default async function OfflinePage() {
  const manifest = await loadOfflineManifest();
  const facts = offlineFacts(manifest);
  // In the order the journal received the papers, and under the names the rest of the site uses.
  const titles = new Map(loadFirstPages().map((p) => [p.slug, p.title]));
  const offered = new Set(manifest?.chapters.map((entry) => entry.paper) ?? []);
  const papers = [
    ...[...titles.keys()].filter((slug) => offered.has(slug)),
    ...[...offered].filter((slug) => !titles.has(slug)).sort(),
  ];
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Read without a connection</p>
        <h1>Take a chapter with you</h1>
        <p className="lead">
          Each chapter is one HTML file. It opens in any browser without an app or a connection, and
          carries its mathematics and the lessons it links to. Downloads can also carry the section’s
          German text and English translation, with passage links that work inside the file.
        </p>
        {facts && (
          <p>
            There are {facts.chapters} of them
            {facts.contiguousSections ? ", one for every section of the four papers" : ""}. A
            chapter is between {formatSize(facts.smallestBytes)} and{" "}
            {formatSize(facts.largestBytes)}, and between {formatSize(facts.smallestGzipBytes)} and{" "}
            {formatSize(facts.largestGzipBytes)} compressed for the journey. Every chapter carries its own math fonts, so that its formulas
            render with nothing left to load. Every chapter together is{" "}
            {formatSize(facts.totalBytes)}, or {formatSize(facts.totalGzipBytes)} compressed.
          </p>
        )}
        {facts && facts.germanChapters > 0 && (
          <p>
            {facts.germanChapters} chapters include German source text; {facts.englishChapters} include
            the available English translation. The download labels identify them before you save.
          </p>
        )}
        <p>
          Each file carries the explanation at every level of detail and the numbers worked out when the site was built.
          Sections with result cards also include their conclusions, qualifications and links to the cited German passages.
        </p>
      </header>
      {papers.length > 0 ? (
        papers.map((paperId) => (
          <OfflineChapterLinks
            key={paperId}
            paperId={paperId}
            heading={titles.get(paperId) ?? paperId}
          />
        ))
      ) : (
        <section className="reading page-flush">
          <h2>No chapters are offered in this build</h2>
          <p>
            Offline downloads appear only when this build contains eligible chapter files.
            Unpublished explanation drafts are not exported in this release profile.
          </p>
        </section>
      )}
      {facts && (
        <section className="reading page-flush" id="what-is-not-here">
          <h2>What a chapter does not carry</h2>
          <p>
            Chapters labelled with German or English include those texts and their footnotes, so
            you can compare the wording with the explanation without a connection. Other chapters
            carry the explanation alone. The photographic scans of the printed pages stay online;
            a source-text download does not include the plates.
          </p>
          <p>
            The laboratories do not run in it. Where an instrument had a worked example prepared
            when the site was built, the chapter carries that example as a static result and labels
            it one; where none was prepared, it says the instrument needs a connection rather than
            showing a number nothing computed.
          </p>
          <p>
            Nothing of yours travels with it, and neither does the site's search. Each chapter
            states this in its own opening: &ldquo;No simulation, search index, notebook, or private
            settings are included. Only explicit online links need a connection.&rdquo; The German and English passage links stay inside the file when their targets are included.
            Links to other sections, scans, laboratories and DOIs need a connection.
          </p>
          <p>
            There is nothing to install and nothing is kept for you. This site registers no service
            worker and offers no application: you save the files you want, where you want them, and
            they stay readable whether or not this site does.
          </p>
        </section>
      )}
      <p className="fine">
        <a href="/papers/">Back to the papers</a>
      </p>
    </>
  );
}
