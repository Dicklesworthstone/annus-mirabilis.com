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
  const [lineage, setLineage] = useState<Readonly<{
    runId: string;
    parentRunId: string | null;
  }> | null>(null);
  const experimentId = binding.environment.experimentId;
  /*
   * BY MODE AS WELL AS BY EXPERIMENT, because `replay.ts` refuses on exactly that pair:
   * `tape.mode !== runner.environment.mode` gives `tape-mode-mismatch`. Filtering on the
   * experiment alone offered a button this component could not play.
   *
   * ME-03 is where it showed. It declares two modes, its binding covers `me-03:default`, and
   * `the-1906-box` is recorded in `me-03:box-1906`; the first press returned "This tape was
   * recorded in a different laboratory mode." No laboratory with more than one mode had mounted
   * this control before, so the filter had never been asked the question.
   */
  const mode = binding.environment.mode;
  const walkthroughs = [...TEACHING_TAPES.values()]
    .filter((tape) => tape.experimentId === experimentId && tape.mode === mode)
    /*
     * AND ONLY IF ITS CHECKPOINT NAMES AN ACTION THE TAPE REACHES. `replay.ts` refuses with
     * `tape-checkpoint-mismatch` when the replay ends at one action and the checkpoint names a
     * later one, so offering such a tape is offering a refusal.
     *
     * ME-03's `where-the-energy-went` is the case: one event at action 1 and a checkpoint at
     * action 3. Its own description names three boundary cases -- body alone, radiation alone, the
     * combined enclosure -- so two events were never authored rather than mis-numbered, and
     * renumbering the checkpoint would make an incomplete walkthrough verify. It is declined here
     * until the record is finished, and the button returns on its own when it is.
     */
    .filter((tape) => {
      const reached = tape.events.reduce((max, event) => Math.max(max, event.actionIndex), 0);
      return tape.acceptedCheckpoint.acceptedActionIndex <= reached;
    })
    .map((tape) => ({ id: tape.teachingTapeRef?.tapeId ?? "", title: tape.title ?? "" }))
    .filter((entry) => entry.id !== "");
  if (walkthroughs.length === 0) return null;

  function play(tapeId: string, asNewRun = false) {
    // Only the compatibility checker can offer recovery, and only a separate click starts it.
    if (
      asNewRun &&
      (played?.kind !== "refused" ||
        !played.offerNewRun ||
        played.tapeId !== tapeId ||
        !session.startNewRun)
    )
      return;
    const outcome = playWalkthrough(binding, session, tapeId, { asNewRun });
    setPlayed(outcome);
    const accepted = session.getSnapshot().accepted;
    setLineage(
      outcome.kind === "played" && outcome.isNewRun && accepted?.runId
        ? {
            runId: accepted.runId,
            parentRunId:
              "parentRunId" in accepted && typeof accepted.parentRunId === "string"
                ? accepted.parentRunId
                : null,
          }
        : null,
    );
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
          data-walkthrough-new-run={played.kind === "played" ? String(played.isNewRun) : undefined}
          data-walkthrough-code={played.kind === "refused" ? played.code : undefined}
        >
          <p>{played.notice}</p>
          {played.kind === "refused" && played.repair && <p className="fine">{played.repair}</p>}
          {played.kind === "refused" && played.offerNewRun && session.startNewRun && (
            <button
              type="button"
              className="secondary"
              data-walkthrough-recalculate={played.tapeId}
              onClick={() => play(played.tapeId, true)}
            >
              Calculate with the current model
            </button>
          )}
          {played.kind === "played" && (
            <p className="fine">
              {played.isNewRun ? "The original settings are described in " : "Recorded in "}
              <a href={tapePath(played.tapeId)}>
                {played.isNewRun ? "the archived walkthrough" : "its walkthrough"}
              </a>
              , which says what each step is for. Nothing here was computed by the recording: the
              label above is this laboratory&rsquo;s own.
            </p>
          )}
          {played.kind === "played" && played.isNewRun && lineage && (
            <details
              className="fine"
              data-walkthrough-lineage="new-run"
              data-run-id={lineage.runId}
              data-parent-run-id={lineage.parentRunId ?? ""}
            >
              <summary>New run lineage</summary>
              <p>
                Run <code>{lineage.runId}</code>.
              </p>
              {lineage.parentRunId && (
                <p>
                  Parent run <code>{lineage.parentRunId}</code>.
                </p>
              )}
            </details>
          )}
        </div>
      )}
    </>
  );
}
