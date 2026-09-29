"use client";

import { useState } from "react";
import {
  playWalkthrough,
  type WalkthroughPlay,
} from "../../experiments/permalink/playWalkthrough.ts";
import type { LabTapeBinding, TapeSession } from "../../experiments/permalink/sessionTape.ts";
import { TEACHING_TAPES } from "../../experiments/permalink/teachingTapeCatalogue.ts";
import { tapePath } from "../../reader/sitePaths.ts";

/*
 * PLAY THIS LABORATORY'S RECORDED WALKTHROUGH, HERE (am-2rl9, dispatch 436).
 *
 * ME-01 had this inline from 00ac4861 and five more laboratories can honour the same contract, so it
 * is one component rather than five copies of sixty lines. THE COST, said plainly because the
 * dispatch asked: this is a shared file under src/components/lab/ that any pane may later touch,
 * where a copy per laboratory would have been five files each owned by one. Five copies of a control
 * that applies a record to a session is the shape that drifts - one laboratory gains a refusal
 * branch the others lack - and the contract here is identical per laboratory, so the sharing is
 * about the contract and not about saving lines.
 *
 * WHICH LABORATORIES GET A BUTTON IS DERIVED, NOT LISTED. The walkthroughs come from the published
 * catalogue by this laboratory's own experimentId, so a laboratory that gains a walkthrough gains a
 * button with it and one whose records cannot be carried in a link never shows one. That matters for
 * the refusals left standing on purpose: a form-only laboratory has no live session to mount this at
 * all, and me-02 and me-03's records do not convert, so neither can present a button that does
 * nothing. A walkthrough that resolves but refuses on identity renders the refusal instead, in the
 * words checkTapeCompatibility already writes for a reader.
 *
 * WHAT THE LABORATORY STILL OWNS. Its own form: `onPlayed` receives the accepted parameters, because
 * a form left showing old numbers over new results is a defect this repository has paid for twelve
 * times, and each laboratory keeps its fields differently - ME-01, LQ-05 and LQ-07 hold a full draft,
 * LQ-06 and LQ-09 a map of typed overrides that has to be cleared instead. And its execution label:
 * this component applies parameters and has no opinion about labels, which is the only way to keep
 * "a replayed snapshot is labelled by whoever computed it" true.
 *
 * WITHOUT JAVASCRIPT the button is hidden by the root layout's noscript rule
 * (button:enabled{display:none}), and the walkthrough's own page stays reachable from the link
 * LabTapes renders on every laboratory page. No text sits inside the button, because that rule hides
 * what a button wraps.
 */
export function WalkthroughControl({
  binding,
  session,
  onPlayed,
}: {
  readonly binding: LabTapeBinding;
  readonly session: TapeSession;
  /** The accepted parameters a play reached, so the laboratory's own fields can follow them. */
  readonly onPlayed?: ((parameters: object) => void) | undefined;
}) {
  const [played, setPlayed] = useState<WalkthroughPlay | null>(null);
  const experimentId = binding.environment.experimentId;
  const walkthroughs = [...TEACHING_TAPES.values()]
    .filter((tape) => tape.experimentId === experimentId)
    .map((tape) => ({ id: tape.teachingTapeRef?.tapeId ?? "", title: tape.title ?? "" }))
    .filter((entry) => entry.id !== "");
  if (walkthroughs.length === 0) return null;

  function play(tapeId: string) {
    const outcome = playWalkthrough(binding, session, tapeId);
    setPlayed(outcome);
    if (outcome.kind === "played") onPlayed?.(session.acceptedParameters());
  }

  return (
    <>
      {walkthroughs.map((walkthrough) => (
        <button
          key={walkthrough.id}
          type="button"
          className="secondary"
          onClick={() => play(walkthrough.id)}
          data-walkthrough={walkthrough.id}
        >
          {walkthroughs.length === 1
            ? "Play the recorded walkthrough"
            : `Play: ${walkthrough.title}`}
        </button>
      ))}
      {played && (
        <div
          className={played.kind === "played" ? "notice" : "notice error"}
          role={played.kind === "played" ? undefined : "alert"}
          data-walkthrough-result={played.kind}
          data-walkthrough-code={played.kind === "refused" ? played.code : undefined}
        >
          <p>{played.notice}</p>
          {played.kind === "refused" && played.repair && <p className="fine">{played.repair}</p>}
          {played.kind === "played" && (
            <p className="fine">
              Recorded in <a href={tapePath(played.tapeId)}>its walkthrough</a>, which says what
              each step is for. Nothing here was computed by the recording: the label above is this
              laboratory&rsquo;s own.
            </p>
          )}
        </div>
      )}
    </>
  );
}
