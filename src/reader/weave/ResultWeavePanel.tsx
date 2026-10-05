"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Sci } from "../../components/lab/Sci.tsx";
import {
  selectAnnouncement,
  selectExpandedOutsideDomain,
} from "../../experiments/weave/announce.ts";
import type { createSessionWeave, SessionWeave } from "../../experiments/weave/sessionSource.ts";
import type { WeaveDerived, WeavePredicate } from "../../experiments/weave/types.ts";
import { type WeavePassage, weavePassageHref } from "./brownianPassages.ts";
import { TRACER_WEAVE_CONTEXT, type WeaveContextField, weaveContext } from "./context.ts";
import { unlitExplanation, weaveEvidence } from "./evidence.ts";
import { allLitContentIds, primaryFlagForContentId } from "./faceLookup.ts";
import { connectSourceHighlights, type SourceWeavePointer } from "./sourceHighlights.ts";
import { WeaveHighlighter, weaveAccessiblePrefix } from "./WeaveHighlighter.tsx";
import "./resultWeave.css";

const SUSPENDED_WEAVE: SessionWeave = Object.freeze({ kind: "inactive", reason: "refused" });

export function ResultWeavePanel({
  source,
  predicates,
  passages,
  paper,
  highlightPaper = false,
  contextFields = TRACER_WEAVE_CONTEXT,
  suspended = false,
  announcementsEnabled = true,
}: Readonly<{
  source: ReturnType<typeof createSessionWeave>;
  predicates: readonly WeavePredicate[];
  passages: Readonly<Record<string, WeavePassage>>;
  paper: string;
  /** Only the primary embedded lab may annotate the surrounding paper. */
  highlightPaper?: boolean;
  contextFields?: readonly WeaveContextField[];
  suspended?: boolean;
  announcementsEnabled?: boolean;
}>) {
  const id = useId();
  const host = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const observed = useSyncExternalStore(
    source.subscribe,
    source.getSnapshot,
    source.getServerSnapshot,
  );
  const state = suspended ? SUSPENDED_WEAVE : observed;
  const previous = useRef<WeaveDerived | undefined>(undefined);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (!announcementsEnabled || !open || state.kind !== "ready") {
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
  }, [state, open, announcementsEnabled]);
  useEffect(() => {
    if (!announcementsEnabled || !highlightPaper || !open || state.kind !== "ready") return;
    const root = host.current?.closest("main");
    const paperPath = `/papers/${paper}`;
    const path = window.location.pathname;
    if (!root || (path !== paperPath && !path.startsWith(`${paperPath}/`))) return;
    const pointers: SourceWeavePointer[] = [];
    for (const contentId of allLitContentIds(state.derived)) {
      const flag = primaryFlagForContentId(state.derived, contentId);
      if (!flag || !passages[flag.predicateId]) continue;
      pointers.push({
        contentId,
        meaning: flag.meaning,
        descriptionId: `${id}-${flag.predicateId}`,
      });
    }
    const connection = connectSourceHighlights(root, id, pointers);
    return () => connection.dispose();
  }, [highlightPaper, open, state, paper, id, passages, announcementsEnabled]);
  const flags = state.kind === "ready" ? Object.values(state.derived.flags) : [];
  const expanded = selectExpandedOutsideDomain(flags);
  return (
    <details
      ref={host}
      className="result-weave"
      data-result-weave={paper}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary id={`${id}-title`}>What this trial points to in the paper</summary>
      <p>
        These pointers connect the accepted calculation to the source argument. An agreement with a
        model is not empirical evidence, and a highlighted sentence is not a proof.
      </p>
      <p role="status" aria-live="polite" aria-atomic="true" className="visually-hidden">
        {announcement}
      </p>
      {state.kind === "inactive" ? (
        <p data-weave-inactive={state.reason}>
          {state.reason === "pending"
            ? "Waiting for the requested trial. Previous pointers are hidden."
            : state.reason === "refused"
              ? "No pointers are shown for a refused request. The laboratory explains the refusal above."
              : "No current accepted comparison is available. The source links remain readable."}
        </p>
      ) : (
        <p className="fine" data-weave-snapshot={state.derived.snapshotVersion}>
          {state.prepared ? "Prepared worked example" : "Accepted trial"}.
          {weaveContext(state.accepted, contextFields).map((field) => (
            <span key={field.id} data-weave-context={field.id}>
              {" "}
              {field.label}: {field.value}.
            </span>
          ))}{" "}
          These are the accepted settings, not unapplied form edits.
        </p>
      )}
      <ul className="result-weave-pointers">
        {predicates.map((predicate) => {
          const passage = passages[predicate.id];
          if (!passage) return null;
          const flag = state.kind === "ready" ? state.derived.flags[predicate.id] : undefined;
          return (
            <li key={predicate.id} data-weave-row={predicate.id}>
              <div id={`${id}-${predicate.id}`}>
                <WeaveHighlighter flag={flag} expanded={expanded === predicate.id} reducedMotion>
                  <strong>{passage.title}</strong>
                </WeaveHighlighter>
              </div>
              {flag && !flag.lit && <p>{unlitExplanation(flag)}</p>}
              <p className="result-weave-links">
                <a href={weavePassageHref(paper, passage.sentenceId, "german")}>German source</a>
                {" · "}
                <a href={weavePassageHref(paper, passage.sentenceId, "english")}>
                  English translation
                </a>
              </p>
              {state.kind === "ready" && (
                <details>
                  <summary>Inspect the comparison inputs</summary>
                  {predicate.conditions.map((condition) => (
                    <p
                      key={`${predicate.id}:${JSON.stringify(condition)}`}
                      className="fine"
                      {...(condition.kind === "regime" && condition.on === "constantSet"
                        ? { "data-constant-set": condition.equals }
                        : {})}
                    >
                      {/* A CONSTANT SET IS NAMED IN WORDS, NEVER BY ITS ID. This printed
                          `constantSet: einstein-1905-brownian-printed.` on bm-01, and AGENTS.md keeps
                          internal identity out of reader-facing text and in an expandable model note.
                          The id stays on the element as a data attribute, which is where
                          labConstantSetNames.test.tsx says identity belongs and where a browser lane
                          can still read it. Every other condition kind names a quantity, which is a
                          canonical quantity id and is the reader-facing vocabulary by design. */}
                      {condition.kind === "agreement"
                        ? `${condition.boundFamily === "dkw" ? "DKW sampling bound" : "Published owner band"}; at least ${condition.minimumSampleSize} samples. Enter significance: ${condition.enterAlpha}; exit significance: ${condition.exitAlpha}.`
                        : condition.kind === "threshold"
                          ? `${condition.quantityId}: ${condition.direction}; enter ${condition.enter}, exit ${condition.exit}.`
                          : condition.kind === "regime"
                            ? condition.on === "constantSet"
                              ? "The constant set this record names is the active one."
                              : `${condition.on}: ${condition.equals}.`
                            : `${condition.quantityId}: ${condition.equals}.`}
                    </p>
                  ))}
                  <dl>
                    {weaveEvidence(predicate, state.accepted).map((row) => (
                      <div key={row.id}>
                        <dt>{row.id}</dt>
                        <dd>
                          {/* A scalar is drawn as a power of ten, never as a double's serialization:
                              `9.722317299024293e-13` reached bm-01's readers from this line. Sci
                              carries the spoken form with it. A row that is NOT a scalar carries
                              words instead, and those are printed as they are. */}
                          {row.numeric === undefined ? (
                            row.value
                          ) : (
                            <>
                              <Sci value={row.numeric} />
                              {row.unit ? ` ${row.unit}` : ""}
                            </>
                          )}
                          {row.owner && <small> — {row.owner}</small>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="fine">
                    Read directly from the accepted outputs. No sample statistic is recomputed here.
                  </p>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
