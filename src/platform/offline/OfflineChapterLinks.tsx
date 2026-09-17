import { loadOfflineChapter, loadOfflineManifest } from "./server.ts";

/** Server-rendered links only. A missing artifact is never advertised to the reader. */
export async function OfflineChapterLinks({ paperId, section }: {
  paperId: string;
  section?: string;
}) {
  const manifest = await loadOfflineManifest();
  const chapters = manifest?.chapters.filter((entry) =>
    entry.paper === paperId && (section === undefined || entry.section === section),
  ) ?? [];
  if (chapters.length === 0) return null;
  // Integrity-check before showing the size or the download, not just when the route is read.
  for (const entry of chapters) {
    const file = entry.path.slice(`/offline/${entry.paper}/`.length);
    if (!await loadOfflineChapter(entry.paper, file))
      throw new Error("An advertised offline chapter is absent from the current build.");
  }
  return (
    <section className="reading" aria-label="Offline chapter downloads">
      <h2>Keep the explanation for offline reading</h2>
      <p>Each HTML file contains the available explanation at every detail level, linked foundations,
        source references, and available build-time scalar results. It includes no private notes
        or running simulations. This remains an explanation preview, not a reviewed source edition.</p>
      <ul>
        {chapters.map((entry) => (
          <li key={entry.path}>
            <a href={entry.path} download={`${entry.paper}-${entry.section}.html`}
              data-offline-chapter data-offline-bytes={entry.bytes}>
              Save this chapter for offline reading: {entry.title}
            </a>{" "}
            <span className="fine">({entry.bytes} bytes · HTML)</span>
          </li>
        ))}
      </ul>
      <p className="fine">Open the downloaded file in a browser. Online source links still need a
        connection. Interactive plots are not included. <a href="/offline/">Browse saved-chapter downloads</a>.</p>
    </section>
  );
}
