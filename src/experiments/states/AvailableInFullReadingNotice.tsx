/**
 * Notice rendered when an instrument cannot honor the tour presentation
 * (am-inst-registry-dispatcher-66l0).
 * "A manifest may declare that an instrument cannot honor the tour presentation
 * (for example one whose question requires an equation); the dispatcher then
 * renders the in-preparation-style notice 'This experiment is available in the
 * full reading' with a link, never a degraded instrument."
 */

export interface AvailableInFullReadingNoticeProps {
  readonly id: string;
  readonly sourceHref?: string | undefined;
}

export function AvailableInFullReadingNotice({
  id,
  sourceHref,
}: AvailableInFullReadingNoticeProps) {
  return (
    <div data-testid="available-in-full-reading-notice" data-instrument-id={id} role="status">
      <p>This experiment is available in the full reading.</p>
      {sourceHref ? <a href={sourceHref}>Return to the paper passage</a> : null}
    </div>
  );
}
