import type { ReactNode } from "react";

/**
 * AN INSTRUMENT'S HISTORIAN'S MARGIN, AS A DISCLOSURE A READER CAN OPEN (am-4ms3).
 *
 * The four readings of a laboratory's caption were four paragraphs, and R3 was
 * `<p data-detail="3" hidden>` revealed only by `html[data-lens="modern"]`. Measured 2026-09-27:
 * laboratory pages mount no ReaderController and carry no `[data-lens-control]`, and the pre-paint
 * script sets `data-lens="paper"` on every page. So the only way to reach the historian's margin of
 * any of the 43 instruments was to type `?lens=modern` into the address bar. Thirty-six of those
 * captions carry a substantial authored R3. None of it reached a reader.
 *
 * WHY A DISCLOSURE RATHER THAN A LENS RULE. This is what the reading pages already do, and
 * reader.css:550 states the reasoning at the rule: with no script the lens attribute is absent and
 * the margin stays a closed disclosure a reader can open. A closed disclosure labelled "Modern
 * qualifications" does not SHOW modern material to a reader who has not asked for it; it offers it.
 * That is the whole of the objection the hidden paragraph was answering, and a laboratory has no
 * lens control to answer it any other way.
 *
 * The heading is the reading pages' own words, so the same material is called the same thing on
 * both faces.
 */
export function LabMargin({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <details className="lab-margin callout-limit" data-detail="3">
      <summary>Modern qualifications</summary>
      <p>{children}</p>
    </details>
  );
}
