"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { selectAnnouncement, selectExpandedOutsideDomain } from "../../experiments/weave/announce.ts";
import type { createSessionWeave } from "../../experiments/weave/sessionSource.ts";
import type { WeaveDerived, WeavePredicate } from "../../experiments/weave/types.ts";
import { type WeavePassage, weavePassageHref } from "./brownianPassages.ts";
import { unlitExplanation, weaveEvidence } from "./evidence.ts";
import { allLitContentIds, primaryFlagForContentId } from "./faceLookup.ts";
import { connectSourceHighlights, type SourceWeavePointer } from "./sourceHighlights.ts";
import { WeaveHighlighter, weaveAccessiblePrefix } from "./WeaveHighlighter.tsx";
import "./resultWeave.css";

export function ResultWeavePanel({ source, predicates, passages, paper, highlightPaper = false }: Readonly<{
  source: ReturnType<typeof createSessionWeave>;
  predicates: readonly WeavePredicate[];
  passages: Readonly<Record<string, WeavePassage>>;
  paper: string;
  /** Only the primary embedded lab may annotate the surrounding paper. */
  highlightPaper?: boolean;
}>) {
  const id = useId();
  const host = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const state = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getServerSnapshot);
  const previous = useRef<WeaveDerived | undefined>(undefined);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (!open || state.kind !== "ready") {
      setAnnouncement("");
      return;
    }
    const next = state.derived;
    // No announcement on initial hydration of a static worked example.
    if (!state.prepared) {
      const before = previous.current?.runId === next.runId ? previous.current : undefined;
      const flag = selectAnnouncement(before, next);
      setAnnouncement(flag ? `${weaveAccessiblePrefix(flag.meaning)} ${flag.pointerText}` : "");
    }
    previous.current = next;
  }, [state, open]);
  useEffect(() => {
    if (!highlightPaper || !open || state.kind !== "ready") return;
    const root = host.current?.closest("main");
    const paperPath = `/papers/${paper}`;
    const path = window.location.pathname;
    if (!root || (path !== paperPath && !path.startsWith(`${paperPath}/`))) return;
    const pointers: SourceWeavePointer[] = [];
    for (const contentId of allLitContentIds(state.derived)) {
      const flag = primaryFlagForContentId(state.derived, contentId);
      if (!flag || !passages[flag.predicateId]) continue;
      pointers.push({ contentId, meaning: flag.meaning, descriptionId: `${id}-${flag.predicateId}` });
    }
    const connection = connectSourceHighlights(root, id, pointers);
    return () => connection.dispose();
  }, [highlightPaper, open, state, paper, id, passages]);
  const flags = state.kind === "ready" ? Object.values(state.derived.flags) : [];
  const expanded = selectExpandedOutsideDomain(flags);
  return (
    <details ref={host} className="result-weave" data-result-weave={paper}
      onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary id={`${id}-title`}>What this trial points to in the paper</summary>
      <p>
        These pointers connect the accepted calculation to the source argument. An agreement with
        a model is not empirical evidence, and a highlighted sentence is not a proof.
      </p>
      <p role="status" aria-live="polite" aria-atomic="true" className="visually-hidden">{announcement}</p>
      {state.kind === "inactive" ? (
        <p data-weave-inactive={state.reason}>
          {state.reason === "pending" ? "Waiting for the requested trial. Previous pointers are hidden." :
            state.reason === "refused" ? "No pointers are shown for a refused request. The laboratory explains the refusal above." :
            "No current accepted comparison is available. The source links remain readable."}
        </p>
      ) : (
        <p className="fine" data-weave-snapshot={state.derived.snapshotVersion}>
          {state.prepared ? "Prepared worked example" : "Accepted trial"}. Sample size: {String(state.accepted.parameters.M ?? "not recorded")};
          {" "}seed: {String(state.accepted.parameters.seed ?? "not recorded")}. These are the accepted settings, not unapplied form edits.
        </p>
      )}
      <ul className="result-weave-pointers">
        {predicates.map((predicate) => {
          const passage = passages[predicate.id];
          if (!passage) return null;
          const flag = state.kind === "ready" ? state.derived.flags[predicate.id] : undefined;
          return (
            <li key={predicate.id} data-weave-row={predicate.id}>
              <div id={`${id}-${predicate.id}`}><WeaveHighlighter flag={flag} expanded={expanded === predicate.id} reducedMotion>
                <strong>{passage.title}</strong>
              </WeaveHighlighter></div>
              {flag && !flag.lit && <p>{unlitExplanation(flag)}</p>}
              <p className="result-weave-links">
                <a href={weavePassageHref(paper, passage.sentenceId, "german")}>German source</a>
                {" · "}<a href={weavePassageHref(paper, passage.sentenceId, "english")}>English translation</a>
              </p>
              {state.kind === "ready" && (
                <details>
                  <summary>Inspect the comparison inputs</summary>
                  {predicate.conditions.map((condition) => (
                    <p key={`${predicate.id}:${JSON.stringify(condition)}`} className="fine">
                      {condition.kind === "agreement" ?
                        `${condition.boundFamily === "dkw" ? "DKW sampling bound" : "Published owner band"}; at least ${condition.minimumSampleSize} samples. Enter significance: ${condition.enterAlpha}; exit significance: ${condition.exitAlpha}.` :
                        condition.kind === "threshold" ? `${condition.quantityId}: ${condition.direction}; enter ${condition.enter}, exit ${condition.exit}.` :
                        condition.kind === "regime" ? `${condition.on}: ${condition.equals}.` : `${condition.quantityId}: ${condition.equals}.`}
                    </p>
                  ))}
                  <dl>
                    {weaveEvidence(predicate, state.accepted).map((row) => (
                      <div key={row.id}><dt>{row.id}</dt><dd>{row.value}{row.owner && <small> — {row.owner}</small>}</dd></div>
                    ))}
                  </dl>
                  <p className="fine">Read directly from the accepted outputs. No sample statistic is recomputed here.</p>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
