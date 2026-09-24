import { loadOfflineChapter, loadOfflineManifest } from "../../../../../platform/offline/server.ts";

/*
 * EACH OFFLINE CHAPTER IS A DIRECTORY INDEX, /offline/<paper>/<name>/index.html.
 *
 * The chapter used to be exported as /offline/<paper>/<name>.html, and on Vercel every one of the
 * 24 answered 404 at that address: the host serves an exported `.html` file at its clean URL,
 * `<name>/`, and refuses the `.html` form (measured 2026-09-23 on the live site: `.html` 404,
 * `<name>/` 200 with the stated 431,120 bytes). A plain static server serves the `.html` path, so
 * no lane saw it. A directory index is what every page of the site already is, and every host and
 * static server resolves `<name>/` to it. The manifest keeps `<name>.html` as the artifact's
 * identity; the URL segment here is that name without the extension.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const manifest = await loadOfflineManifest();
  return (manifest?.chapters ?? []).map((entry) => ({
    paper: entry.paper,
    file: entry.path.slice(`/offline/${entry.paper}/`.length).replace(/\.html$/, ""),
  }));
}

/** Enumerated, content-addressed artifacts only; no arbitrary filesystem or remote fetch. */
export async function GET(
  _request: Request,
  context: {
    params: Promise<{ paper: string; file: string }>;
  },
) {
  const { paper, file } = await context.params;
  const chapter = await loadOfflineChapter(paper, `${file}.html`);
  if (!chapter)
    return new Response("This chapter is not available in this build.", { status: 404 });
  return new Response(chapter.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": String(chapter.entry.bytes),
      "Content-Disposition": `attachment; filename="${paper}-${chapter.entry.section}.html"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
