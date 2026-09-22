/**
 * The printed page a section of the paper begins on, as a plate the reading's companion can show
 * beside the explanation (TanElk's dispatch 69: the companion column carried a placeholder
 * sentence, "not air" was the ask). Server-only: it reads the ledger through the German face and
 * checks public/ for the plate files.
 *
 * The page comes from the German face's page map (blockPages.ts), keyed by the section's own
 * heading block, so it is where Einstein's section starts, not the paper's first page. Offered
 * only when both plates (640 and 1280px wide) are in public/, so a srcset never names a file that
 * is not there, and only for keys whose receipt admits the plates (generate-page-plates.ts writes
 * no others).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadGermanSourceFace } from "../content/editions/germanSourceFace.ts";
import type { RouteSlug } from "../content/ids.ts";

export type SectionPlate = Readonly<{
  /** The printed page the section begins on. */
  page: number;
  /** The Annalen volume, from the key's own grammar, ap-<volume>-<first page>. */
  volume: string;
  src: string;
  srcSet: string;
  /** The section in the German face, where the plate's page is the text beside it. */
  germanHref: string;
}>;

export function sectionPlate(
  slug: RouteSlug,
  sectionId: string,
  root: string = process.cwd(),
): SectionPlate | undefined {
  const face = loadGermanSourceFace(slug, root);
  if (!face) return undefined;
  const printed = /^ap-(\d+)-\d+$/.exec(face.bibKey);
  const page = face.printedPages.pages[sectionId];
  if (!printed || page === undefined) return undefined;
  const dir = `/figures/plates/pages/${face.bibKey}`;
  const files = [`${page}.webp`, `${page}-1280.webp`];
  if (!files.every((file) => existsSync(join(root, "public", dir, file)))) return undefined;
  return {
    page,
    volume: printed[1] as string,
    src: `${dir}/${page}.webp`,
    srcSet: `${dir}/${page}.webp 640w, ${dir}/${page}-1280.webp 1280w`,
    germanHref: `/papers/${slug}/${sectionId}/view/german/`,
  };
}
