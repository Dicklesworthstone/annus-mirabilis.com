/*
 * WITHOUT JAVASCRIPT, A BUTTON THAT ONLY JAVASCRIPT CAN WORK IS NOT SHOWN (am-nojs-dead-controls-3agt).
 *
 * With JavaScript off, 267 enabled buttons on 41 of the 197 pages in the live sitemap looked usable
 * and did nothing (measured 2026-09-24, Playwright, every enabled and laid-out button): lab presets,
 * view switches, the lessons' constructions. Every one is wired by React, and no form on the site
 * has an action, so none of them could ever work without it. Each page already says in its own
 * words that JavaScript is off and what the static page shows instead.
 *
 * The root layout puts this rule in a <noscript> in the head, so it applies only when scripts do not
 * run and costs a JavaScript reader nothing. It hides ENABLED buttons only: a button a component
 * already disables until hydration (the equations' term chips, a lab form's Apply) stays, greyed, as
 * the component meant, and so does everything that is not a button: text, links, <details>, and the
 * input fields that show the worked example's values.
 *
 * A wrapper that disables everything was tried first and measured wrong. A fieldset with
 * display: contents collapsed the paper pages' reading grid to height 0 in Chromium (a container
 * query inside it), and its inherited font turned every page's text sans; as a block it moved
 * headings by up to 70px, because a fieldset is its own formatting context. This rule adds no
 * element, so it cannot move anything.
 */
export const NOSCRIPT_CONTROLS_CSS = "button:enabled{display:none!important}";

/*
 * WITHOUT JAVASCRIPT, EVERY READING OF THE DETAIL AXIS IS STILL REACHABLE (am-b7jy).
 *
 * The Detail axis is served by rendering all of a unit's readings into the page and revealing one
 * with CSS keyed on `data-detail`, which the pre-paint script sets on <html>. R1 is the default and
 * needs no attribute, so it survives; the others are revealed only under an attribute no script means
 * no one sets. Measured 2026-09-27:
 *
 * - THE PAPER FACES rendered R0 as `<div data-reading="0" hidden>` (PaperPage, PaperReader), and
 *   reader.css turns `hidden` into display:none. 8 such blocks on mass-energy's explanation face and
 *   15 on light quanta's, none reachable. R2 and R3 there are native <details> a reader can open, so
 *   R0 alone was lost - the reading written to say in one or two sentences what a paragraph claims,
 *   which is the one the no-algebra route leans on.
 * - THE LABORATORY CAPTIONS are the larger half. labShell.css hides every `p[data-detail]` under a
 *   lab root and reveals `p[data-detail="1"]` alone; R0, R2 and R3 are revealed only under
 *   `html[data-detail]` or `html[data-lens]`. These are <p>, not disclosures, so a reader without
 *   script could not reach them by any action. 63 of 63 caption targets carry all four authored
 *   readings - the one population in the repository where the four-reading promise is complete.
 *
 * The R0 selector carries no [hidden]: with scripts off EVERY R0 is meant to be reachable, and a
 * rule that required the attribute would miss one rendered without it and would also be harder to
 * check, since a selector can only be matched against an element that carries what it asks for.
 *
 * So this reveals R0 and R2 wherever a script alone could have. It is the Detail axis only: R3 is the
 * Perspective axis, and on the paper faces it is already a disclosure a reader can open. On a lab page
 * R3 stays unreachable without script, which is a stated gap rather than an oversight - there is no
 * lens control without script either, so revealing it would show modern-lens material to a reader who
 * cannot turn it off, and the honest fix is the disclosure the paper faces use.
 *
 * THE NAMES ARE GENERATED CONTENT, DELIBERATELY. Three readings in sequence with nothing to tell them
 * apart is two paragraphs of apparent repetition. A real element would be better, and the 44 lab pages
 * each hand-emit their own `<p data-detail="N">` with no shared component, so a markup label costs 44
 * files of churn across pages other panes are editing, for a label only this stylesheet ever shows.
 * The trade is stated rather than hidden: `content` is announced by current screen readers, and
 * without it a reader with scripts off gets the readings unlabelled, which is what they get today
 * minus the readings.
 */
export const NOSCRIPT_READINGS_CSS = [
  '[data-reading="0"],',
  ':is(.laboratory,.laboratory-shell,.lab-readings)>p[data-detail="0"],',
  ':is(.laboratory,.laboratory-shell,.lab-readings)>p[data-detail="2"]',
  "{display:block!important}",
  // The label itself is REAL TEXT in a <noscript>, rendered by the paper faces and by every
  // laboratory caption, and styled by .reading-label in globals.css rather than here: an element
  // that exists only when scripting is off needs no rule that exists only when scripting is off,
  // and a class declared in a stylesheet is one the declared-class ratchet can see (am-b7jy).
].join("");
