/**
 * What the facsimile's page directory calls a source unit, in the reader's words.
 *
 * WHY. The directory listed each unit by its content id with its kind in brackets, so the first
 * links a reader met under a printed page were "masthead-title (masthead title)", "s0-p1
 * (paragraph)" and "eq-s0-d1 (display equation)": our addressing grammar (docs/CONTENT_IDS.md),
 * shown as if it were the page's contents. On BUILD 22 that was every one of the 153 units on the
 * two papers with a pinned scan. The id still addresses the unit (the link's target and the
 * element's anchor are unchanged); this only names it.
 *
 * `sectioned` says whether the paper has numbered sections. In a sectioned paper `s0` is the
 * unnumbered introduction; in mass-energy, which has no sections, `s0` is the whole paper and
 * a place name would say nothing.
 *
 * A shape this does not know keeps the old form, id and kind, rather than guessing a name.
 */
export function sourceUnitLabel(id: string, kind: string, sectioned: boolean): string {
  const fixed: Readonly<Record<string, string>> = {
    "masthead-title": "Title",
    "masthead-author": "Author line",
    "closing-dateline": "Date-line",
    "closing-received": "Date received",
  };
  const named = fixed[id];
  if (named) return named;

  const place = (section: string) =>
    section === "0" ? (sectioned ? "Introduction" : "") : `§${section}`;
  const at = (section: string, what: string) => {
    const where = place(section);
    return where ? `${where}, ${what}` : what.charAt(0).toUpperCase() + what.slice(1);
  };

  const heading = /^s(\d+)$/.exec(id);
  if (heading?.[1]) return heading[1] === "0" ? "Introduction heading" : `§${heading[1]} heading`;
  const paragraph = /^s(\d+)-p(\d+)$/.exec(id);
  if (paragraph?.[1] && paragraph[2]) return at(paragraph[1], `paragraph ${paragraph[2]}`);
  const footnote = /^s(\d+)-fn(\d+)$/.exec(id);
  if (footnote?.[1] && footnote[2]) return at(footnote[1], `footnote ${footnote[2]}`);
  const display = /^eq-s(\d+)-d(\d+)$/.exec(id);
  if (display?.[1] && display[2]) return at(display[1], `display equation ${display[2]}`);
  const sentence = /^s(\d+)-p(\d+)-s(\d+)$/.exec(id);
  if (sentence?.[1] && sentence[2] && sentence[3])
    return at(sentence[1], `paragraph ${sentence[2]}, sentence ${sentence[3]}`);
  // A printed equation number, normalised by CONTENT_IDS.md §4.2: "1p" is (1′), "1pp" is (1″).
  const printed = (label: string) => `(${label.replace(/pp$/, "″").replace(/p$/, "′")})`;
  const sectionPrinted = /^eq-s(\d+)-(\d+[a-z]?p{0,2})$/.exec(id);
  if (sectionPrinted?.[1] && sectionPrinted[2])
    return at(sectionPrinted[1], `equation ${printed(sectionPrinted[2])}`);
  const paperPrinted = /^eq-(\d+[a-z]?p{0,2})$/.exec(id);
  if (paperPrinted?.[1]) return `Equation ${printed(paperPrinted[1])}`;
  return `${id} (${kind.replaceAll("-", " ")})`;
}
