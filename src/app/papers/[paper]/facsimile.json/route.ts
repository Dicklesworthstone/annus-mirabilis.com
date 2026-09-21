import { loadPaper } from "../../../../content/server.ts";
import { loadFacsimileDocument } from "../../../../reader/facsimile/server.ts";
import { FACSIMILE_WIRE_VERSION } from "../../../../reader/facsimile/wire.ts";
import { listReadablePapers } from "../../../../reader/paperRoutes.ts";

// A GET-only, build-time static file: no source bytes or filesystem paths reach the browser.
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await listReadablePapers()).map((paper) => ({ paper }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ paper: string }> }) {
  const { paper } = await params;
  const payload = await loadPaper(paper);
  const availability = await loadFacsimileDocument(paper, payload.paper.citation);
  return Response.json({ schemaVersion: FACSIMILE_WIRE_VERSION, ...availability });
}
