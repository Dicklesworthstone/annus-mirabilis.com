import { loadOfflineChapter, loadOfflineManifest } from "./server.ts";
import "./offline.css";

/**
 * Where a chapter is served: its manifest path without ".html", as a directory. The export writes
 * each chapter as a directory index (src/app/offline/[paper]/[file]/index.html/route.ts), because a
 * static host serves an exported "name.html" only at "name/" and answers 404 to the .html form.
 */
export function chapterHref(path: string): string {
  return `${path.replace(/\.html$/, "")}/`;
}

/** "558 KB" rather than "571730 bytes": a reader decides by size, not by count. */
function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Server-rendered links only. A missing artifact is never advertised to the reader.
 *
 * On a paper page the list explains itself once. On /offline/, which lists every paper, the page
 * says what a chapter file holds, so each paper's list is its title and its chapters: that page
 * used to repeat one heading, "Keep the explanation for offline reading", and one paragraph per
 * paper without naming the paper, and to link to itself under each.
 */
export async function OfflineChapterLinks({
  paperId,
  section,
  heading,
}: {
  paperId: string;
  section?: string;
  /** The paper's title on /offline/; when given, the explanation and the index link are left out. */
  heading?: string;
}) {
  const manifest = await loadOfflineManifest();
  const chapters =
    manifest?.chapters.filter(
      (entry) => entry.paper === paperId && (section === undefined || entry.section === section),
    ) ?? [];
  if (chapters.length === 0) return null;
  // Integrity-check before showing the size or the download, not just when the route is read.
  for (const entry of chapters) {
    const file = entry.path.slice(`/offline/${entry.paper}/`.length);
    if (!(await loadOfflineChapter(entry.paper, file)))
      throw new Error("An advertised offline chapter is absent from the current build.");
  }
  const onIndex = heading !== undefined;
  // On /offline/ each list sits under the page's own introduction, so it takes the page's left
  // edge (page-flush, globals.css). Centred, the lists started 280px right of the introduction at
  // 1440 and 393px right at 1920, and read as a second page below the first.
  return (
    <section
      className={
        onIndex ? "reading page-flush offline-chapters" : "reading reading-column offline-chapters"
      }
      aria-label={heading ?? "Read offline"}
    >
      <h2>{heading ?? "Read this offline"}</h2>
      {!onIndex && (
        <p>
          Each chapter is one HTML file that opens in any browser without a connection. It holds the
          explanation at every level of detail, the lessons it links to, its source references and
          the numbers worked out when the site was built. It has no notes of yours and no running
          simulations. It is an explanation, not an edition of the paper.
        </p>
      )}
      <ul className="offline-chapter-list">
        {chapters.map((entry) => (
          <li key={entry.path}>
            <a
              href={chapterHref(entry.path)}
              download={`${entry.paper}-${entry.section}.html`}
              data-offline-chapter
              data-offline-bytes={entry.bytes}
            >
              <span className="visually-hidden">Download </span>
              {entry.title}
            </a>{" "}
            <span className="fine">HTML, {formatSize(entry.bytes)}</span>
          </li>
        ))}
      </ul>
      {!onIndex && (
        <p className="fine">
          Links to online sources still need a connection, and the interactive plots are not
          included. <a href="/offline/">Every chapter you can keep</a>
        </p>
      )}
    </section>
  );
}
