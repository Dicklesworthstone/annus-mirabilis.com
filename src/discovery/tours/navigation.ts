import { getGuidedTour, getTourStop, type GuidedTour, type TourStop } from "./catalogue.ts";

const KEYS = ["tour", "tourStop", "tourRevision"] as const;
export const TOUR_LINK_LIMIT = 4096;
export type TourPosition = Readonly<{ tourId: string; stopId: string; revision: number }>;
export type TourSelection = Readonly<{ tour: GuidedTour; stop: TourStop; index: number }>;
export type TourDecode =
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "invalid"; message: string }>
  | Readonly<{ kind: "position"; position: TourPosition }>;
const invalid = (message: string): TourDecode => ({ kind: "invalid", message });

export function resolveTourPosition(position: TourPosition): TourSelection | null {
  const tour = getGuidedTour(position.tourId);
  if (!tour || tour.revision !== position.revision) return null;
  const stop = getTourStop(tour, position.stopId);
  if (!stop) return null;
  return { tour, stop, index: tour.stops.indexOf(stop) };
}

export function tourPosition(tour: GuidedTour, stop: TourStop): TourPosition {
  const position = { tourId: tour.id, stopId: stop.id, revision: tour.revision };
  if (!resolveTourPosition(position)) throw new Error("Unknown guided tour position.");
  return position;
}

/** A URL carries only a public reading position, never progress judgments, notes or answers. */
export function decodeTourPosition(search: string): TourDecode {
  if (search.length > TOUR_LINK_LIMIT) return invalid("This guided-tour link is too long.");
  const query = new URLSearchParams(search);
  if (!KEYS.some((key) => query.has(key))) return { kind: "absent" };
  if (KEYS.some((key) => query.getAll(key).length !== 1)) {
    return invalid("The guided-tour link has missing or repeated position fields.");
  }
  const tour = getGuidedTour(query.get("tour") ?? "");
  if (!tour) return invalid("This guided tour is not in the catalogue.");
  // Exact revision comparison: do not silently put an old bookmark into a changed sequence.
  if (query.get("tourRevision") !== String(tour.revision)) {
    return invalid("This bookmark uses a different tour revision. Choose a stop from the current tour outline.");
  }
  const stop = getTourStop(tour, query.get("tourStop") ?? "");
  return stop
    ? { kind: "position", position: tourPosition(tour, stop) }
    : invalid("The bookmarked stop is not part of this tour.");
}

/** The only destinations are authored local paths. No caller-supplied redirect is accepted. */
export function tourDestination(position: TourPosition): string {
  const selected = resolveTourPosition(position);
  if (!selected) throw new Error("Unknown guided tour position.");
  const url = new URL(selected.stop.href, "https://tour.invalid");
  if (url.origin !== "https://tour.invalid" || !selected.stop.href.startsWith("/")) {
    throw new Error("A guided tour must stay in the edition.");
  }
  url.searchParams.set("tour", selected.tour.id);
  url.searchParams.set("tourStop", selected.stop.id);
  url.searchParams.set("tourRevision", String(selected.tour.revision));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function tourOutline(position: TourPosition): string {
  const selected = resolveTourPosition(position);
  if (!selected) return "/tours/";
  return `/tours/${selected.tour.id}/#tour-stop-${selected.stop.id}`;
}

export function adjacentTourPosition(position: TourPosition, direction: -1 | 1): TourPosition | null {
  const selected = resolveTourPosition(position);
  if (!selected) return null;
  const stop = selected.tour.stops[selected.index + direction];
  return stop ? tourPosition(selected.tour, stop) : null;
}

/** The guide appears only on the destination it describes. A stale query must not mislabel a lab. */
export function tourMatchesPath(position: TourPosition, pathname: string): boolean {
  const selected = resolveTourPosition(position);
  if (!selected) return false;
  const target = new URL(selected.stop.href, "https://tour.invalid").pathname;
  const normalize = (path: string) => path.replace(/\/$/, "");
  return normalize(target) === normalize(pathname);
}

/** End a tour without throwing away experiment settings, reader options, or the source anchor. */
export function leaveTourHref(pathname: string, search: string, hash: string): string {
  if (!/^\/(?!\/)/.test(pathname) || /[?#\\\r\n]/.test(pathname)) {
    throw new Error("Expected a local edition path.");
  }
  const query = new URLSearchParams(search);
  for (const key of KEYS) query.delete(key);
  const tail = query.toString();
  return `${pathname}${tail ? `?${tail}` : ""}${hash.startsWith("#") ? hash : ""}`;
}
