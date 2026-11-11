import type { PlaceKeeperSnapshot } from "./placeKeeper.ts";

/** A cached viewport position belongs to one address, not whichever passage is visited next. */
export function anchorFromFaceHash(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export function faceSwitchPlaceForHash(
  snapshot: PlaceKeeperSnapshot | undefined,
  hash: string,
): PlaceKeeperSnapshot | undefined {
  return snapshot &&
    snapshot.anchorId === anchorFromFaceHash(hash) &&
    Number.isFinite(snapshot.relativeOffset)
    ? snapshot
    : undefined;
}

/** Consume a transfer only on its destination, after the face has resolved any split sentence. */
export function parseFaceSwitchTransfer(
  value: unknown,
  path: string,
  hash: string,
  resolve: (anchor: string) => string | null,
): PlaceKeeperSnapshot | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const requested = anchorFromFaceHash(hash);
  if (
    record.path !== path ||
    typeof record.anchorId !== "string" ||
    !record.anchorId ||
    typeof record.relativeOffset !== "number" ||
    !Number.isFinite(record.relativeOffset) ||
    requested === null
  )
    return null;
  const destination = resolve(requested);
  if (destination === null || resolve(record.anchorId) !== destination) return null;
  return { anchorId: destination, relativeOffset: record.relativeOffset };
}
