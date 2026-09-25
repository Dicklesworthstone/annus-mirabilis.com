"use client";
/**
 * "Explore the equations in this step", loaded on first opening.
 *
 * WHY. On a whole-paper page every argument carried its explorer cards in a closed disclosure:
 * each formula again, with its MathML, its term and operation buttons, its notes and its
 * assumptions, and all of it a second time as the client component's props in the page's flight
 * data. Measured on BUILD 14's /papers/special-relativity/: 29 cards, 464,754 bytes of markup
 * (45% of the page), and the page 264,373 bytes gzipped against the 250,000 budget. AGENTS.md
 * names the remedy for a page over budget: content behind an expansion loads from a static JSON
 * fragment on first expansion, with real links for no-script readers.
 *
 * HOW. The disclosure and its summary are in the HTML. The cards are not: opening it the first
 * time loads the paper's equation payload, a static JSON chunk the build already produces, and
 * mounts the same SemanticEquation cards the section pages render in place. Before that, and for a
 * reader without JavaScript, the disclosure holds a real link to the section's own page, where the
 * cards are part of the server-rendered HTML.
 */
import { type ReactNode, type SyntheticEvent, useState } from "react";
import { EquationScope } from "../equations/EquationScope.tsx";
import { SemanticEquation } from "../equations/SemanticEquation.tsx";
import type { CompiledEquation } from "../equations/viewTypes.ts";

type Payload = {
  readonly equations: readonly unknown[];
  readonly foundationTitles?: Readonly<Record<string, string>>;
};
/*
  ONE STEP'S EQUATIONS, NOT THE PAPER'S. This loaded the paper's whole payload and filtered it to
  the step: measured on live, 52 KB compressed to show two cards on special-relativity, from 710 KB
  of JSON a phone then parsed. build-equations.ts now also writes one payload per argument, and
  the template import below is how webpack splits them: one lazy chunk per file in that
  directory, so opening a step fetches that step (4.7 KB gzip for velocity composition).
*/
const ARGUMENT_ID = /^arg-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const loadArgumentEquations = (argumentId: string): Promise<Payload> =>
  import(`../generated/argument-equations/${argumentId}.json`);

export function LazyArgumentEquations({
  argumentId,
  sectionHref,
  title,
  children,
}: {
  argumentId: string;
  /** The section's own page, where these cards are server-rendered: the no-script route. */
  sectionHref: string;
  /** The argument's title, so each link's accessible name says which equations it opens. */
  title: string;
  /** Anything the inline disclosure ends with, such as mass-energy's laboratory link. */
  children?: ReactNode;
}) {
  const [equations, setEquations] = useState<readonly CompiledEquation[] | null>(null);
  const [lessonTitles, setLessonTitles] = useState<Readonly<Record<string, string>>>({});
  const [failed, setFailed] = useState(false);
  function load(event: SyntheticEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open || equations) return;
    if (!ARGUMENT_ID.test(argumentId)) {
      setFailed(true);
      return;
    }
    loadArgumentEquations(argumentId)
      .then((payload) => {
        setLessonTitles(payload.foundationTitles ?? {});
        setEquations(
          (payload.equations as readonly CompiledEquation[]).filter(
            (equation) => equation.argument === argumentId,
          ),
        );
      })
      .catch(() => setFailed(true));
  }
  return (
    <details
      className="local-steps"
      data-argument-equations={argumentId}
      data-equations-loaded={String(!!equations)}
      onToggle={load}
    >
      <summary>Explore the equations in this step</summary>
      <p>
        Read each operation, check its units and assumptions, or open the mathematical step behind
        it. These are modern teaching equations, not the equations as printed.
      </p>
      {equations ? (
        <EquationScope scope={`reader-${argumentId}`} lessonTitles={lessonTitles}>
          {equations.map((equation) => (
            <SemanticEquation key={equation.id} equation={equation} />
          ))}
        </EquationScope>
      ) : (
        <p className="fine" data-equations-fragment={argumentId}>
          {failed ? "The equations did not load here. " : null}
          <a
            href={sectionHref}
            aria-label={`Open the equations of “${title}” on its section’s page`}
          >
            Open them on this section&rsquo;s own page
          </a>
          , where they are part of the page.
        </p>
      )}
      {children}
    </details>
  );
}
