import type { ReactNode } from "react";
import type { WeaveFlag, WeaveMeaning } from "../../experiments/weave/types.ts";

/**
 * The presentational island for am-read-result-weave-jex: an instrument's lit sentence. It reads
 * a computed WeaveFlag and renders a pointer, never a claim -- "the highlight is a pointer, not a
 * claim that truth has been achieved" (src/experiments/weave/types.ts). Treatment is never color
 * alone: every meaning also carries a visually-hidden accessible-name prefix and a distinct
 * border style, so the distinction survives grayscale rendering and screen readers alike.
 */

const MEANING_PREFIX: Readonly<Record<WeaveMeaning, string>> = {
  "assumption-active": "This assumption is currently active:",
  "quantity-compared": "This is the quantity being compared:",
  "agreement-within-stated-bound": "These agree within the stated bound:",
  "outside-selected-domain": "This conclusion is outside the model's domain here:",
};

const MEANING_TREATMENT: Readonly<Record<WeaveMeaning, string>> = {
  "assumption-active": "weave-assumption-active",
  "quantity-compared": "weave-quantity-compared",
  "agreement-within-stated-bound": "weave-agreement-within-bound",
  "outside-selected-domain": "weave-outside-domain",
};

export function weaveAccessiblePrefix(meaning: WeaveMeaning): string {
  return MEANING_PREFIX[meaning];
}

export function weaveTreatmentClass(meaning: WeaveMeaning): string {
  return MEANING_TREATMENT[meaning];
}

export function WeaveHighlighter({
  flag,
  expanded,
  reducedMotion,
  children,
}: {
  flag: WeaveFlag | undefined;
  /** Only meaningful when flag.meaning is "outside-selected-domain": whether this is the one
   * predicate on the face selected to show its pointerText expanded (announce.ts's
   * selectExpandedOutsideDomain enforces the "at most one per face" invariant at the caller). */
  expanded?: boolean;
  reducedMotion?: boolean;
  children: ReactNode;
}) {
  if (!flag || !flag.lit) {
    return <span data-weave-lit="false">{children}</span>;
  }
  const treatment = weaveTreatmentClass(flag.meaning);
  const showExpanded = flag.meaning === "outside-selected-domain" ? Boolean(expanded) : true;
  return (
    <mark
      data-weave-lit="true"
      data-weave-predicate={flag.predicateId}
      data-weave-meaning={flag.meaning}
      data-weave-state={flag.state}
      data-weave-reduced-motion={reducedMotion ? "true" : "false"}
      className={`weave-highlight ${treatment}`}
    >
      <span className="visually-hidden">{weaveAccessiblePrefix(flag.meaning)}</span>
      {children}
      {showExpanded ? (
        <span className="weave-pointer" data-weave-pointer-text>
          {flag.pointerText}
        </span>
      ) : null}
    </mark>
  );
}
