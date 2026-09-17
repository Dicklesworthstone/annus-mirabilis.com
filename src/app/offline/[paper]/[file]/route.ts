import { loadOfflineChapter, loadOfflineManifest } from "../../../../platform/offline/server.ts";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const manifest = await loadOfflineManifest();
  return (manifest?.chapters ?? []).map((entry) => ({
    paper: entry.paper,
    file: entry.path.slice(`/offline/${entry.paper}/`.length),
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
  const chapter = await loadOfflineChapter(paper, file);
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
