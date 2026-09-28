/**
 * THE NUMBERS ON /accessibility/ COME FROM THE MAP, NOT FROM A SENTENCE SOMEONE TYPED.
 *
 * The page states how many WCAG 2.2 criteria are mapped, how many carry a rule and a check, and how
 * many are recorded not-applicable. Those are exactly the kind of figures that rot: a criterion
 * added to `docs/accessibility/wcag-22-map.yaml` would leave a page claiming the old count, and a
 * reader has no way to tell a stale number from a current one.
 *
 * So they are read from the map at build time. If the file moves the build fails loudly, which is
 * the right failure: a page that states what has been checked should not be able to keep saying it
 * after the record is gone.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type CriteriaCounts = Readonly<{
  total: number;
  levelA: number;
  levelAA: number;
  /** Criteria carrying a rule, a check and an owner. */
  withRule: number;
  /** Criteria recorded not-applicable, each with a reason and a revisit trigger. */
  notApplicable: number;
}>;

const MAP_PATH = join("docs", "accessibility", "wcag-22-map.yaml");

/**
 * Counted with anchored line patterns rather than a YAML parse, because the only question here is
 * how many entries carry each field and an anchored count cannot be fooled by the same word inside
 * a prose reason. `total` is asserted against the two dispositions by the page's own test, so a
 * criterion that is neither ruled nor excused would be caught rather than quietly uncounted.
 */
export function criteriaCounts(root: string = process.cwd()): CriteriaCounts {
  const text = readFileSync(join(root, MAP_PATH), "utf8");
  const count = (pattern: RegExp) => text.match(pattern)?.length ?? 0;
  return Object.freeze({
    total: new Set(text.match(/^\s*-\s*id:\s*"?[0-9]+\.[0-9.]+"?/gm) ?? []).size,
    levelA: count(/^\s*level:\s*"?A"?\s*$/gm),
    levelAA: count(/^\s*level:\s*"?AA"?\s*$/gm),
    withRule: count(/^\s*rule:/gm),
    notApplicable: count(/^\s*notApplicableReason:/gm),
  });
}
