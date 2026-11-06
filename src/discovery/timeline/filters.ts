/** Only the two supplementary groups can be hidden; the paper dates and boundary stay visible. */
export type TimelineVisibility = Readonly<{ post1904: boolean; laterEvidence: boolean }>;

export function applyTimelineVisibility(root: HTMLElement, visible: TimelineVisibility): void {
  const post = root.querySelector<HTMLElement>("#timeline-post-1904");
  const later = root.querySelector<HTMLElement>("#timeline-later-confirmations");
  if (post) post.hidden = !visible.post1904;
  if (later) later.hidden = !visible.laterEvidence;
}

/** A followed fragment must not land in a group the reader previously hid. */
export function revealTimelineTarget(
  root: HTMLElement,
  hash: string,
): "post1904" | "laterEvidence" | null {
  let id: string;
  try {
    id = decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return null;
  }
  if (!id) return null;
  const target = root.ownerDocument.getElementById(id);
  if (!target || !root.contains(target)) return null;
  const group = target.closest<HTMLElement>("#timeline-post-1904, #timeline-later-confirmations");
  if (!group) return null;
  group.hidden = false;
  target.scrollIntoView?.({ block: "start" });
  return group.id === "timeline-post-1904" ? "post1904" : "laterEvidence";
}
