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
