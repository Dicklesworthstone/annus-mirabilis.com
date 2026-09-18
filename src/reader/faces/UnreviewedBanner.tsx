export interface UnreviewedBannerProps {
  readonly title?: string | undefined;
  readonly message?: string | undefined;
}

/**
 * Non-alarming banner rendered on English and Parallel faces when translation units are in draft state.
 */
export function UnreviewedBanner({
  title = "Draft Translation",
  message = "This English translation is an in-progress draft and has not yet completed full human review. It is provided for study alongside the original German source.",
}: UnreviewedBannerProps) {
  return (
    <aside
      className="unreviewed-translation-banner"
      role="status"
      aria-label="Translation review status"
      data-unreviewed-banner="true"
    >
      <p className="banner-heading">
        <strong>{title}</strong>
      </p>
      <p className="banner-text">{message}</p>
    </aside>
  );
}
