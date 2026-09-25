import { PAPER_SLUGS } from "../../content/schemas/source.pure.ts";

/**
 * Where a reference inline's link goes.
 *
 * A target that names another paper, as `<slug>` or `<slug>/<section>`, opens that paper or that
 * section. This is how Einstein's "l. c. § 8" in the mass-energy paper reaches § 8 of the
 * relativity paper it cites. Any other target is an id on the same page, as before.
 */
export function referenceHref(targetId: string): string {
  const [paper, section, ...rest] = targetId.split("/");
  if (
    rest.length === 0 &&
    paper !== undefined &&
    (PAPER_SLUGS as readonly string[]).includes(paper)
  )
    return section ? `/papers/${paper}/${section}/` : `/papers/${paper}/`;
  return `#${targetId}`;
}
