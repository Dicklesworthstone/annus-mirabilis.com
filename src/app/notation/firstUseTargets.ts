import { loadGermanSourceFace } from "../../content/editions/germanSourceFace.ts";
import type { RouteSlug } from "../../content/ids.ts";
import { germanFaceHasContent } from "../../reader/faceAvailability.ts";
import { loadBilingualEdition } from "../../reader/faces/bilingualLoader.ts";
import { listReadablePapers, sectionStaticParams } from "../../reader/paperRoutes.ts";

/**
 * WHERE A SYMBOL'S FIRST USE CAN BE OPENED (/notation/'s "first used on p. 289").
 *
 * The concordance records each first use as a paper and a source anchor, "bm-s1-p1". The links
 * built from them, /papers/<paper>?view=reading#bm-s1-p1, named an id that no page carries: the
 * reading face has no paragraph anchors and no page uses the paper prefix. On live 211e9af4, 36
 * such links landed at the top of the paper, and 4 more named the dissertation, which has no page.
 *
 * So each first use goes to the first of these that exists:
 *   1. the paragraph on the paper's German face, where that face has text: the printed words
 *      the page number refers to (ids are the source block ids, "s1-p1");
 *   2. the section's own page, /papers/<paper>/<section>/;
 *   3. the paper's page;
 *   4. nothing, for a paper with no page yet, whose first use is then named but not linked.
 * The German face's blocks are chosen exactly as PaperPage chooses them: the compiled edition's
 * blocks, else the transcription draft's, gated by the same germanFaceHasContent.
 */
export interface FirstUseTargets {
  readonly readable: ReadonlySet<string>;
  /** "paper/section" for every section page that is generated. */
  readonly sections: ReadonlySet<string>;
  /** Source block ids on each paper's German face, for papers whose face has text. */
  readonly german: ReadonlyMap<string, ReadonlySet<string>>;
}

export async function loadFirstUseTargets(): Promise<FirstUseTargets> {
  const papers = await listReadablePapers();
  const sections = new Set((await sectionStaticParams()).map((s) => `${s.paper}/${s.section}`));
  const german = new Map<string, ReadonlySet<string>>();
  for (const slug of papers) {
    const edition = await loadBilingualEdition(slug);
    const editionBlocks = edition?.blocks.length ?? 0;
    const draft = editionBlocks === 0 ? loadGermanSourceFace(slug as RouteSlug) : null;
    if (!germanFaceHasContent(editionBlocks, draft?.blocks.length ?? 0)) continue;
    const blocks: readonly { id: string }[] =
      editionBlocks > 0 ? (edition?.blocks ?? []) : (draft?.blocks ?? []);
    german.set(slug, new Set(blocks.map((b) => b.id)));
  }
  return { readable: new Set(papers), sections, german };
}

export function resolveFirstUse(
  paper: string,
  anchor: string,
  targets: FirstUseTargets,
): string | null {
  if (!targets.readable.has(paper)) return null;
  const bare = anchor.replace(/^[a-z]{2}-/, "");
  if (targets.german.get(paper)?.has(bare)) return `/papers/${paper}/view/german/#${bare}`;
  const section = /^(s\d+)-/.exec(bare)?.[1];
  if (section && targets.sections.has(`${paper}/${section}`)) return `/papers/${paper}/${section}/`;
  return `/papers/${paper}/`;
}
