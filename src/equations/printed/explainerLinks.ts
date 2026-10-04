/**
 * WHERE AN EQUATION'S EXPLANATION LIVES (dispatch 292). Two addresses, derived from one identity so
 * the page, the fragment and the no-script link can never name different things:
 *
 * - the FRAGMENT, a static JSON file holding the levels, fetched on first expansion;
 * - the PAGE, which holds every level in its own markup, for a reader without JavaScript and for a
 *   fetch that fails.
 *
 * An explanation is identified by the printed display it explains, or, for a model equation
 * explained from its own record, by the equation's id. No payload is imported here, so a client
 * component may take these without the explanations reaching its bundle.
 */
export type ExplainerIdentity = Readonly<{
  paper: string;
  display?: string | undefined;
  equation?: string | undefined;
}>;

/** The display this explains, else the equation: one id, used by both addresses. */
export function explainerId(explanation: ExplainerIdentity): string {
  return explanation.display ?? explanation.equation ?? "";
}

/** The static fragment holding this explanation's levels. */
export function explainerFragmentUrl(explanation: ExplainerIdentity): string {
  return `/equation-explanations/${explanation.paper}/${explainerId(explanation)}.json`;
}

/** The page holding every level of this explanation, in its own markup. */
export function explainerHref(explanation: ExplainerIdentity): string {
  return `/equations/${explanation.paper}/${explainerId(explanation)}/`;
}

/** The visible words on every explainer link. The accessible name begins with these. */
export const EXPLAINER_LINK_TEXT = "Explain this equation";

/**
 * THE ACCESSIBLE NAME OF AN EXPLAINER LINK, which must say WHICH equation (am-enpr).
 *
 * Every link renders the same visible words, so a Results face offered a links list of 33 entries
 * all reading "Explain this equation", each going somewhere different. Measured at 320 and 1440, in
 * both themes and with script on and off: special-relativity 33 destinations under one name,
 * light-quanta 20, brownian-motion 13, mass-energy 7. A reader moving by links hears the same
 * phrase 33 times and cannot choose.
 *
 * The name is derived from the SAME id as the href, which is what makes "one name, one destination"
 * true by construction rather than by vigilance: two links share a name only when they share a
 * destination. Nothing new is invented to say it, either. The id grammar in AGENTS.md already
 * encodes the printed identity, so the name is read back out of it:
 *
 *   eq-7         a printed label            "equation 7"
 *   eq-7a        a printed label with a letter  "equation 7a"
 *   eq-s8-5      printed, section-qualified  "equation 5 in § 8"
 *   eq-s8-d4     an unnumbered display       "§ 8, display 4"
 *   eq-s0-d7     paper 4 prints no sections  "display 7"
 *
 * The phrasing follows the source links already on these pages ("Text on page 906 of the German
 * source, § 5, paragraph 2"), so the two kinds of link sound like one voice.
 *
 * WHY IT EXTENDS THE VISIBLE WORDS RATHER THAN REPLACING THEM. WCAG 2.5.3 (Label in Name) asks that
 * the visible label be contained in the accessible name, so a reader who says "Explain this
 * equation" to a voice control still reaches the link. So the name always begins with the words on
 * screen, and only adds which equation it is.
 */
export function explainerLinkName(explanation: ExplainerIdentity): string {
  const which = equationPhrase(explainerId(explanation));
  return which === undefined ? EXPLAINER_LINK_TEXT : `${EXPLAINER_LINK_TEXT}: ${which}`;
}

/** The identifying phrase for an equation id, or undefined when the id is not of a known shape. */
function equationPhrase(id: string): string | undefined {
  if (id === "") return undefined;
  // eq-s<n>-d<j>: the editorial id for a display the paper prints without a number.
  const editorial = /^eq-s(\d+)-d(\d+)$/.exec(id);
  if (editorial) {
    const section = Number(editorial[1]);
    const display = editorial[2];
    // Paper 4 has no numbered sections and uses s0 (AGENTS.md, naming conventions), so naming a
    // section there would invent one.
    return section === 0 ? `display ${display}` : `§ ${section}, display ${display}`;
  }
  // eq-s<n>-<printed>: a printed label that repeats elsewhere in the paper, so it is qualified.
  const qualified = /^eq-s(\d+)-(\d+[a-z]?)$/.exec(id);
  if (qualified) return `equation ${qualified[2]} in § ${qualified[1]}`;
  // eq-<printed>: a printed label unique within the paper.
  const printed = /^eq-(\d+[a-z]?)$/.exec(id);
  if (printed) return `equation ${printed[1]}`;
  // Any other id is still named, because an unnamed link is worse than an awkwardly named one.
  return id.startsWith("eq-") ? id.slice("eq-".length) : id;
}
