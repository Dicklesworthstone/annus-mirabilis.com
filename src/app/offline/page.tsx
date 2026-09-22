import type { Metadata } from "next";
import { OfflineChapterLinks } from "../../platform/offline/OfflineChapterLinks.tsx";
import { loadOfflineManifest } from "../../platform/offline/server.ts";

export const metadata: Metadata = {
  title: "Chapters to read offline",
  description:
    "Download a self-contained explanation chapter with its foundations and source references.",
};

export default async function OfflinePage() {
  const manifest = await loadOfflineManifest();
  const papers = [...new Set(manifest?.chapters.map((entry) => entry.paper) ?? [])].sort();
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Read without a connection</p>
        <h1>Keep a chapter, including the tools for its argument.</h1>
        <p className="lead">
          A single HTML file opens in your browser without installing an app. Its mathematics and
          linked foundation explanations travel with it.
        </p>
        <p>
          The downloads contain the available authored explanations only. Source transcription,
          translation, and review remain separate work. No private notebook data is read or
          included.
        </p>
        <a href="/papers/">Return to the papers</a>
      </header>
      {papers.length > 0 ? (
        papers.map((paperId) => <OfflineChapterLinks key={paperId} paperId={paperId} />)
      ) : (
        <section className="reading">
          <h2>No chapters are offered in this build</h2>
          <p>
            Offline downloads appear only when this build contains eligible chapter files.
            Unpublished explanation drafts are not exported in a reviewed release profile.
          </p>
        </section>
      )}
    </>
  );
}
