/**
 * A paper's printed sections, s0 (the introduction) then § 1, § 2, ..., in printed order, from its
 * frozen manifest (content/source-blocks/<slug>/manifest.yaml).
 *
 * The coverage notices (editionCoverage.ts) name the sections an edition does not reach yet, so
 * they need every printed section. They took the list from the explanation record
 * (content/papers/<slug>.json), which lists only the sections an explanation is filed under:
 * Brownian motion's has no § 3, so its English face could never say § 3 was untranslated, and
 * would drop its notice once §§ 1, 2, 4 and 5 were in (SapphireCastle, mail 40054).
 *
 * Only s<n> sections count; a manifest's closing units carry no printed section number. A paper
 * whose manifest carries no sections (mass-energy, which has none) keeps the explanation's list.
 *
 * Server-only: the manifest is read from disk.
 */
import { printedUnits } from "../content/editions/germanSourceFace.ts";
import type { RouteSlug } from "../content/ids.ts";

export function paperSectionIds(
  slug: string,
  fallback: readonly string[],
  root: string = process.cwd(),
): readonly string[] {
  const sections: string[] = [];
  for (const unit of printedUnits(root, slug as RouteSlug)) {
    const section = unit.section;
    if (section && /^s\d+$/.test(section) && !sections.includes(section)) sections.push(section);
  }
  return sections.length > 0 ? sections : fallback;
}
