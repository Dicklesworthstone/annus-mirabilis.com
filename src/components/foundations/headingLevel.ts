/**
 * Heading depth for a foundation lesson and the construction inside it.
 *
 * One lesson renders at three depths: on its own page under the h1 (its parts are h2), in a
 * paper's clarification panel under the panel's h2 (h3), and inline in a paper's "every step"
 * reading under the aside's h4 (h5). The constructions used to hard-code h3 and h4, so on the
 * lesson's own page the construction sat inside the worked example in the heading outline, and
 * inline it outranked the aside that contains it. Every part now takes its depth from the page.
 */
export type HeadingLevel = 2 | 3 | 4 | 5;

const TAGS = ["h2", "h3", "h4", "h5", "h6"] as const;
export type HeadingTag = (typeof TAGS)[number];

/** The heading element `depth` levels below `level`, never deeper than h6. */
export function headingTag(level: HeadingLevel, depth = 0): HeadingTag {
  return TAGS[Math.min(level - 2 + depth, TAGS.length - 1)] as HeadingTag;
}
