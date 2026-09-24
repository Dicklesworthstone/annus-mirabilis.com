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
