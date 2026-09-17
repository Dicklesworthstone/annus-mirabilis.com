export type PinnedEquation = Readonly<{
  equationId: string;
  formId: string;
  selection: string;
}>;

let pinned: PinnedEquation | null = null;

export function pinEquation(next: PinnedEquation): PinnedEquation {
  if (!next.equationId.trim() || !next.formId.trim()) {
    throw new Error("Pinning requires an equation id and a displayed form id.");
  }
  pinned = Object.freeze({ ...next });
  return pinned;
}

export function unpinEquation(): void {
  pinned = null;
}

export function getPinnedEquation(): PinnedEquation | null {
  return pinned;
}
