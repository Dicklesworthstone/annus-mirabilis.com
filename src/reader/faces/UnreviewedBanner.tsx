export interface UnreviewedBannerProps {
  readonly title?: string | undefined;
  readonly message?: string | undefined;
  /** The layer the banner reports on, as its accessible name: the gloss face's is its gloss. */
  readonly label?: string | undefined;
  /** "agent-checked" when AI agents, not a person, checked the translation (D-2026-09-25). */
  readonly kind?: "unreviewed" | "agent-checked" | undefined;
}

/**
 * The banner rendered on the English, parallel and gloss faces while translation units are unreviewed.
 */
export function UnreviewedBanner({
  title = "Draft translation, not yet reviewed",
  message = "This translation has not been reviewed against the German.",
  label = "Translation review status",
  kind = "unreviewed",
}: UnreviewedBannerProps) {
  // Static content, so no role="status": a live region is for announcements, and a screen reader
  // should meet this once, in reading order. The faces pass the text translationReviewSummary
  // computes from their units; the defaults claim only what every draft is.
  return (
    <aside
      className="unreviewed-translation-banner"
      aria-label={label}
      data-unreviewed-banner={kind === "unreviewed" ? "true" : undefined}
      data-agent-checked-banner={kind === "agent-checked" ? "true" : undefined}
    >
      <p className="banner-heading">
        <strong>{title}</strong>
      </p>
      <p className="banner-text">{message}</p>
    </aside>
  );
}
