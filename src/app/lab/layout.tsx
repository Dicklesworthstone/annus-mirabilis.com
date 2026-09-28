import type { ReactNode } from "react";
import "../../components/lab/labShell.css";
import { EmbedLauncher } from "../../components/embed/EmbedLauncher.tsx";
import { LocalPredictions } from "../../components/lab/LocalPredictions.tsx";
import { ExplainerFragments } from "../../reader/faces/ExplainerFragments.tsx";

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
      {/* The predict gate remembers answers here; an embed's never does (predictPersistence.ts). */}
      <LocalPredictions />
      {/* One island for every laboratory (dispatch 301): a press on "Explain this equation" under a
          display opens it here instead of following its link to the page holding its levels. Every
          control is a real anchor, so a laboratory without this still reaches every word; this only
          keeps the reader on the instrument. It listens and holds no state, so a page with no
          explained formula pays for a listener and nothing else. */}
      <ExplainerFragments />
      <div className="lab-route">{children}</div>
      <EmbedLauncher />
      {/* The 21 authored teaching tapes reached no reader until 2026-09-27 (am-2rl9).
          One link, not a per-laboratory list: the lab routes are one directory each rather than a
          dynamic segment, so this layout does not know which instrument it is wrapping, and a
          client component that did would ship the tape map to every laboratory page. The index
          groups by instrument, so a reader on bm-01 reaches bm-01's tape in one hop. */}
      <nav className="actions no-print" aria-label="Recorded walkthroughs">
        <span className="eyebrow">Recorded walkthroughs</span>
        <a className="button secondary" href="/tapes/">
          Teaching tapes: what to change, and what to expect
        </a>
      </nav>
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
