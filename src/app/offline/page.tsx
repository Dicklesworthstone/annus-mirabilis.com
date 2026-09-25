import type { Metadata } from "next";
import { loadFirstPages } from "../../components/home/firstPages.ts";
import { OfflineChapterLinks } from "../../platform/offline/OfflineChapterLinks.tsx";
import { loadOfflineManifest } from "../../platform/offline/server.ts";
import "../../components/home/wideProse.css";

export const metadata: Metadata = {
  title: "Chapters to read offline",
  description:
    "Each explained section as one HTML file that opens without a connection, with the lessons it links to and its source references.",
};

export default async function OfflinePage() {
  const manifest = await loadOfflineManifest();
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
          carries its mathematics and the lessons it links to.
        </p>
        <p>
          A file holds the explanation at every level of detail, its source references and the
          numbers worked out when the site was built. It is an explanation, not an edition of the
          paper: the German text and the translation are separate work, and not in it. Nothing from
          your notebook is read or included. Links to online sources still need a connection, and
          the interactive plots are not included.
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
      <p className="fine">
        <a href="/papers/">Back to the papers</a>
      </p>
    </>
  );
}
