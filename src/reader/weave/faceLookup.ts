/**
 * The single place a face asks "is the content I am about to render lit?" (am-read-result-
 * weave-jex). A face passes the id it is ACTUALLY rendering on this element -- the German
 * source id, or, when English split that sentence, one specific split half -- and gets back an
 * answer addressed purely by content id. No caller ever compares array indices, list positions,
 * or render order between faces: two faces asking about the same content (by id, including
 * across a German/English split) always get the same answer from the same WeaveDerived.
 */

import type { WeaveDerived, WeaveFlag } from "../../experiments/weave/types.ts";
import { canonicalContentId, contentIdVariants } from "./contentIds.ts";

/** Every currently-lit flag that targets the sentence `faceRenderedId` belongs to (after
 * canonicalizing both the query and each predicate's declared targets), in stable predicate-id
 * order. Usually zero or one; more than one is possible when two predicates share a sentence. */
export function litFlagsForContentId(
  derived: WeaveDerived,
  faceRenderedId: string,
): readonly WeaveFlag[] {
  const canonical = canonicalContentId(faceRenderedId);
  return Object.values(derived.flags)
    .filter(
      (flag) => flag.lit && flag.targets.some((target) => canonicalContentId(target) === canonical),
    )
    .sort((a, b) => a.predicateId.localeCompare(b.predicateId));
}

/** Whether any predicate currently lights the content `faceRenderedId` addresses. */
export function isContentIdLit(derived: WeaveDerived, faceRenderedId: string): boolean {
  return litFlagsForContentId(derived, faceRenderedId).length > 0;
}

/** The one flag a `WeaveHighlighter` at `faceRenderedId` should render, or undefined when dark.
 * Ties (two predicates lighting the same sentence at once) resolve to the first by predicate id,
 * matching announce.ts's tie-break so a single sentence never carries two prefixes at once. */
export function primaryFlagForContentId(
  derived: WeaveDerived,
  faceRenderedId: string,
): WeaveFlag | undefined {
  return litFlagsForContentId(derived, faceRenderedId)[0];
}

/** Every rendered id (across every face's own splitting choices) that is lit right now, for a
 * "what the instrument shows now" list or a coverage check -- never used to decide what to
 * render on a specific element, which always goes through `faceRenderedId` above instead. */
export function allLitContentIds(derived: WeaveDerived): ReadonlySet<string> {
  const lit = new Set<string>();
  for (const flag of Object.values(derived.flags)) {
    if (!flag.lit) continue;
    for (const target of flag.targets) {
      for (const variant of contentIdVariants(target)) lit.add(variant);
    }
  }
  return lit;
}
