/**
 * The explicit failure state for an id outside the catalogue entirely
 * (am-inst-registry-dispatcher-66l0). This is the rule the donor's
 * Wright-default visual dispatch broke and this project replaces: "Unknown
 * experiment ids fail explicitly instead of showing a plausible wrong
 * model" (AGENTS.md). There is no substitute instrument here, ever.
 */

export interface UnknownExperimentNoticeProps {
  readonly requestedId: string;
  readonly refusalCode?: string | undefined;
  readonly sourceHref?: string | undefined;
}

export function UnknownExperimentNotice({
  requestedId,
  refusalCode,
  sourceHref,
}: UnknownExperimentNoticeProps) {
  return (
    <div data-testid="unknown-experiment-notice" data-refusal-code={refusalCode} role="alert">
      <p>This experiment is not available here.</p>
      <p>
        Requested id: <code>{requestedId}</code>
      </p>
      {sourceHref ? <a href={sourceHref}>Return to the paper passage</a> : null}
    </div>
  );
}
