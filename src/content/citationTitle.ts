/**
 * A reference line closes its title with a full stop, unless the title already ends a sentence.
 * The mass-energy paper's English title is a question, so both reference lists printed "Does the
 * inertia of a body depend upon its energy content?." (the paper page and the offline chapters).
 */
export function citationTitleClose(title: string): "" | "." {
  return /[.?!…]["”’)]?$/u.test(title.trim()) ? "" : ".";
}
