import type { ReactNode } from "react";
import "../../components/lab/labShell.css";

/**
 * Connect the instruments to the shared reasoning laboratories without changing their state.
 *
 * Each label names a method and the paper it is worked on, because none of the three is
 * general: the comparison runs on the Brownian tracer, the model-elimination case is special
 * relativity, and the inference workbench takes Brownian displacements. On the nine
 * light-quanta and three mass-energy instruments, all three lead to another paper's physics,
 * so a reader is told where a link goes before taking it.
 *
 * The links come AFTER the page, not before it. Above the page they were the first thing on
 * every laboratory, ahead of the instrument's own question, and at 390px they stacked into a
 * block that pushed the instrument below the first screen (measured on 2026-09-22: the
 * instrument began 808 to 1008px down on 7 of 8 sampled pages, on an 844px screen). They are
 * a way onward from an instrument, so they sit where a reader finishes with one.
 */
export default function LaboratoryLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <nav className="actions no-print" aria-label="Ways to test a model">
        <span className="eyebrow">Ways to test a model</span>
        <a className="button secondary" href="/lab/bm-01/compare/">
          Change one input at a time · Brownian
        </a>
        <a className="button secondary" href="/lab/countermodels/">
          Tell two models apart · Relativity
        </a>
        <a className="button secondary" href="/lab/what-can-you-infer/">
          What the data cannot settle · Brownian
        </a>
      </nav>
    </>
  );
}
