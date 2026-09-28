/**
 * Renders one Misconception as a "common wrong turn" callout (am-read-misconception-callouts-a3o).
 * Reads the real `Misconception` entity (src/content/schemas/argument.ts) only -- it never
 * authors content, never recomputes physics, and never touches the review-record gate itself
 * (that is `interventionGate.ts`'s job; this component only renders whatever status it is given).
 *
 * Its texts may carry `\( … \)` mathematics, typeset by InlineMathText (dispatch 163).
 *
 * Static structure only: a native <details> disclosure, so the callout works without JavaScript
 * and the collapsed/expanded state survives print. Both tempting opposites, when present, render
 * with equal prominence -- neither is listed first as "the" claim.
 */
import type { Misconception } from "../../content/schemas/argument.ts";
import { InlineMathText } from "../InlineMathText.tsx";
import { parseWhatIsTrue, textForDetail } from "./types.ts";

export type InterventionStatus =
  | Readonly<{ state: "reviewed" }>
  | Readonly<{ state: "not-yet-reviewed" }>;

/**
 * The accessible name of a callout's "See it in the instrument" link.
 *
 * THE SAME DEFECT HAS NOW BEEN FIXED TWICE, ONE STEP APART, and the second step is why the first is
 * no longer sufficient. Two callouts once linked to /lab/bm-06/ and /lab/bm-01/ under the one name
 * "See it in the instrument", which a screen reader cannot tell apart (WCAG 2.4.4) and the
 * link-name gate refuses (am-jmma); naming the INSTRUMENT separated them. Then 359778ca gave each
 * link the preset that demonstrates its own misconception, and brownian-motion had two callouts
 * pointing at two different settings of ONE instrument: "See it in the instrument: Tracer ensemble"
 * twice, two destinations. Naming the instrument is exactly as ambiguous as naming nothing once the
 * instrument is shared.
 *
 * So the name carries the SETTING, and the setting is named by the misconception the link is set up
 * for, in the reader's own words. Not by the preset id: an id in an accessible name is the same
 * defect as an id in visible prose, which this repository spent the morning removing from three
 * pages.
 *
 * The visible words stay "See it in the instrument" and the accessible name still begins with them,
 * so WCAG 2.5.3 Label in Name holds: a voice-control user saying the words they can see still
 * matches the link.
 */
export function instrumentLinkName(
  instrumentName: string | undefined,
  temptingClaim: string | undefined,
): string | undefined {
  const where = instrumentName ? `: ${instrumentName}` : "";
  const forWhat = temptingClaim ? `, set up for \u201c${temptingClaim}\u201d` : "";
  if (!where && !forWhat) return undefined;
  return `See it in the instrument${where}${forWhat}`;
}

export function MisconceptionCallout({
  misconception,
  detail,
  modernLens,
  expanded = false,
  interventionStatus,
  instrumentHref,
  instrumentName,
}: {
  misconception: Misconception;
  detail: 0 | 1 | 2;
  modernLens: boolean;
  expanded?: boolean;
  interventionStatus: InterventionStatus;
  /** Supplied by the caller, which owns instrument-address resolution
   * (src/experiments/catalogue.ts) -- this component never resolves a route itself. */
  instrumentHref?: string | undefined;
  /**
   * What the linked instrument is called (reader/actions/labNames.ts), so the link says where it
   * goes. Two callouts on one page linked to /lab/bm-06/ and /lab/bm-01/ under the one name "See it
   * in the instrument", which the link-name gate (am-jmma) refuses and a screen reader cannot tell
   * apart (WCAG 2.4.4). The visible words stay short, as "Try it" does beside a passage.
   */
  instrumentName?: string | undefined;
}) {
  const whatIsTrue = parseWhatIsTrue(misconception.whatIsTrue, misconception.id);
  const { text: whatIsTrueText, margin } = textForDetail(whatIsTrue, detail, modernLens);

  return (
    <aside
      className="misconception-callout"
      id={`misconception-${misconception.id}`}
      data-misconception-id={misconception.id}
      data-detail={detail}
      data-lens={modernLens ? "modern" : "printed"}
    >
      <details open={expanded}>
        <summary>
          A common wrong turn: <InlineMathText text={misconception.temptingClaims[0] ?? ""} />
        </summary>

        <div className="misconception-body">
          <h4 className="sr-only">Tempting claims</h4>
          <ul
            className="misconception-tempting-claims"
            data-claim-count={misconception.temptingClaims.length}
          >
            {misconception.temptingClaims.map((claim) => (
              <li key={claim}>
                <InlineMathText text={claim} />
              </li>
            ))}
          </ul>

          <p className="misconception-why-tempting" data-section="why-tempting">
            <InlineMathText text={misconception.whyTempting} />
          </p>

          <p className="misconception-where-true" data-section="where-it-is-true">
            {misconception.whereItIsTrue === "none" ? (
              <em>There is no reading under which this is a correct thing to say.</em>
            ) : (
              <InlineMathText text={misconception.whereItIsTrue} />
            )}
          </p>

          <p className="misconception-what-is-true" data-section="what-is-true">
            <InlineMathText text={whatIsTrueText} />
            {margin && (
              <span className="misconception-margin" data-margin="r3">
                {" "}
                <InlineMathText text={margin} />
              </span>
            )}
          </p>

          {misconception.instrumentIds &&
            misconception.instrumentIds.length > 0 &&
            instrumentHref && (
              // The gate's verdict stays on the link as data; its words ("this instrument's default
              // view is not yet reviewed against this misconception") are review copy and are not
              // shown (D-2026-09-25-no-review-status-banners).
              <p
                className="misconception-instrument-link"
                data-intervention-status={
                  interventionStatus.state === "not-yet-reviewed" ? "not-yet-reviewed" : undefined
                }
              >
                <a
                  href={instrumentHref}
                  aria-label={instrumentLinkName(instrumentName, misconception.temptingClaims[0])}
                >
                  See it in the instrument
                </a>
              </p>
            )}

          {misconception.staticTreatment && (
            <p className="misconception-static-treatment">
              <InlineMathText text={misconception.staticTreatment.reason} />
            </p>
          )}

          {misconception.sources.length > 0 && (
            <p className="misconception-sources">Sources: {misconception.sources.join("; ")}</p>
          )}
        </div>
      </details>
    </aside>
  );
}
