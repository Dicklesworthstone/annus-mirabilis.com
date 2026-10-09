/** Public experiment settings only. A worksheet's private answers never enter a launch link. */
export type ExperimentSelection = Readonly<{
  instrumentId: string;
  tapeId?: string | undefined;
  presetId?: string | undefined;
}>;
export type ExperimentLaunch = Readonly<
  | { status: "ready"; instrumentId: string; href: string; kind: "session" | "form" }
  | { status: "unavailable"; instrumentId: string; reason: string }
>;
export type ExperimentLaunchIndex = Readonly<Record<string, ExperimentLaunch>>;

/** Include both the owner and the selection kind: preset and tape names are different namespaces. */
export function experimentSelectionKey(selection: ExperimentSelection): string {
  return JSON.stringify([
    selection.instrumentId,
    selection.tapeId ?? null,
    selection.presetId ?? null,
  ]);
}

export const LAUNCH_NOTICES = Object.freeze({
  session:
    "The opening settings load when JavaScript is available. This link does not replay the walkthrough.",
  form: "The opening settings are placed in the form. Apply them in the laboratory to calculate. This link does not replay the walkthrough.",
  unavailable:
    "The authored settings cannot be loaded by this link. The laboratory opens with its usual settings; use the walkthrough or the named preset instead.",
});

/** Refuse an unexpected destination rather than silently sending a capstone to a different lab. */
export function isExperimentLaunchHref(href: string, instrumentId: string): boolean {
  if (!/^[a-z][a-z0-9-]{1,79}$/.test(instrumentId) || href.length > 4096) return false;
  const base = `/lab/${instrumentId}/`;
  if (href !== base && !href.startsWith(`${base}?`)) return false;
  // Generated links have no fragments, backslashes or control characters. Do not normalize a
  // suspicious path into a seemingly valid one, and do not accept a second URL after a newline.
  return !/[\\#\u0000-\u0020\u007f]/u.test(href);
}

export function selectedExperimentLaunch(
  selection: ExperimentSelection,
  index: ExperimentLaunchIndex,
): Readonly<{ href: string; notice: string; ready: boolean }> {
  const found = index[experimentSelectionKey(selection)];
  const unambiguous = Boolean(selection.tapeId) !== Boolean(selection.presetId);
  if (
    unambiguous &&
    found?.status === "ready" &&
    found.instrumentId === selection.instrumentId &&
    (found.kind === "session" || found.kind === "form") &&
    isExperimentLaunchHref(found.href, selection.instrumentId)
  ) {
    return { href: found.href, notice: LAUNCH_NOTICES[found.kind], ready: true };
  }
  return {
    href: /^[a-z][a-z0-9-]{1,79}$/.test(selection.instrumentId)
      ? `/lab/${selection.instrumentId}/`
      : "/lab/",
    notice: LAUNCH_NOTICES.unavailable,
    ready: false,
  };
}
