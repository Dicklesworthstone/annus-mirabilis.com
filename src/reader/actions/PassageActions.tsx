"use client";

/**
 * The local passage action bar (am-read-passage-actions-vbe): "Why?", "Show
 * the missing step", "Show me one example first", "Try it", "Read the
 * original", and "Copy a link to this passage". An action renders only when
 * its content exists -- a missing action is a coverage gap, never filled
 * with generated text.
 *
 * "Why?"/"Show the missing step"/"Show me one example first" open their
 * authored content inline via `<details>`, the bead's own "inline fallback
 * first" contract: this is real, working behavior today, and the exact
 * content contract `am-read-return-stack-oxa` replaces this fallback with
 * later, without changing what a reader sees.
 */

import { useId, useState } from "react";
import type { ReaderRegistry } from "../navigation/state.ts";
import { buildPassageLink, type PassageLinkAxes } from "./buildPassageLink.ts";
import { ObstacleMenu } from "./ObstacleMenu.tsx";
import type { PassageActions as PassageActionsData } from "./passageActions.schema.ts";

export interface PassageActionsProps {
  readonly actions: PassageActionsData;
  /** For accessible names, e.g. "section 4, paragraph 2, sentence 1". */
  readonly passageLabel: string;
  readonly origin: string;
  readonly registry: ReaderRegistry;
  readonly axes: PassageLinkAxes;
  /** The source face route for "Read the original", when known. */
  readonly originalHref?: string | undefined;
  /** The laboratory route (with preset) or static-example route for "Try it", when known. */
  readonly tryItHref?: string | undefined;
}

type CopyStatus = "idle" | "announced" | "fallback";

export function PassageActions({
  actions,
  passageLabel,
  origin,
  registry,
  axes,
  originalHref,
  tryItHref,
}: PassageActionsProps) {
  const id = useId();
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [announcement, setAnnouncement] = useState("");

  const link = buildPassageLink({ origin, registry, axes });
  const noScriptHref = buildPassageLink({
    origin,
    registry,
    axes: { view: "reading", detail: 1, lens: false, anchor: axes.anchor },
  });

  async function copyLink() {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(link);
      setCopyStatus("announced");
      setAnnouncement(`Link to ${passageLabel} copied.`);
    } catch {
      setCopyStatus("fallback");
      setAnnouncement("");
    }
  }

  return (
    <div className="passage-actions" data-passage-actions data-passage-label={passageLabel}>
      {actions.why && (
        <details className="passage-action" data-action="why">
          <summary aria-label={`Why?: ${passageLabel}`}>Why?</summary>
          <p>{actions.why}</p>
        </details>
      )}

      {actions.missingStep && (
        <details className="passage-action" data-action="missing-step">
          <summary aria-label={`Show the missing step: ${passageLabel}`}>
            Show the missing step
          </summary>
          <p>{actions.missingStep}</p>
        </details>
      )}

      {actions.example && (
        <details className="passage-action" data-action="example">
          <summary aria-label={`Show me one example first: ${passageLabel}`}>
            Show me one example first
          </summary>
          <p>{actions.example}</p>
        </details>
      )}

      {actions.tryIt && tryItHref && (
        <a className="passage-action" data-action="try-it" href={tryItHref}>
          Try it
        </a>
      )}

      {actions.original && originalHref && (
        <a className="passage-action" data-action="read-original" href={originalHref}>
          Read the original
        </a>
      )}

      <span className="passage-action" data-action="copy-link">
        <a href={noScriptHref} data-copy-link-noscript-href={noScriptHref}>
          Copy a link to this passage
        </a>
        <button
          type="button"
          aria-label={`Copy a link to this passage: ${passageLabel}`}
          onClick={copyLink}
        >
          Copy link
        </button>
        {copyStatus === "fallback" && (
          <label>
            Copy this link:
            <input
              type="text"
              readOnly
              value={link}
              ref={(el) => el?.focus()}
              aria-label={`Link to ${passageLabel}`}
            />
          </label>
        )}
        <p aria-live="polite" data-copy-announcement id={`copy-announce-${id}`}>
          {announcement}
        </p>
      </span>

      <ObstacleMenu responses={actions.obstacleResponses} passageLabel={passageLabel} />
    </div>
  );
}
