import { NextResponse } from "next/server";
import {
  listFragmentReferences,
  lookupFragment,
  readFragmentManifest,
} from "../../../../../../reader/detail/fragments.ts";

/**
 * am-read-detail-axis-sfc. Static route handler for a reading's over-budget R2/R3 fragment,
 * content-addressed by hash. `dynamic = "force-static"` and `generateStaticParams` make this a
 * build-time-enumerated set of static files, never a live lookup: a fragment's URL either exists
 * at build time or it never exists, so a rebuild can never leave a page pointing at a hash the
 * server will not serve.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

const MANIFEST_ROOT = "src/generated/reading-fragments";

export async function generateStaticParams(): Promise<
  { paper: string; section: string; hash: string }[]
> {
  const manifest = await readFragmentManifest(MANIFEST_ROOT);
  const refs = listFragmentReferences(manifest);
  if (refs.length === 0) {
    return [{ paper: "_none", section: "_none", hash: "_none" }];
  }
  return [...refs];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paper: string; section: string; hash: string }> },
): Promise<NextResponse> {
  const { paper, section, hash } = await params;
  const manifest = await readFragmentManifest(MANIFEST_ROOT);
  const fragment = lookupFragment(manifest, paper, section, hash);
  if (!fragment) {
    return NextResponse.json(
      { error: "fragment-not-found", paper, section, hash },
      { status: 404 },
    );
  }
  return NextResponse.json({
    unitId: fragment.unitId,
    reading: fragment.reading,
    html: fragment.html,
  });
}
