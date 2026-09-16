export const DETAIL_STORAGE_KEY = "am:settings:v1:detail";
export const MAX_CLARIFICATION_DEPTH = 12;
export const FACES = ["reading", "results", "german", "english", "parallel", "gloss", "facsimile"] as const;
export type Face = typeof FACES[number];
export type Detail = 0 | 1 | 2;
export type Frame = Readonly<{ foundationId: string; triggerId: string; relativeY: number }>;
export type ReaderState = Readonly<{ detail: Detail; lens: boolean; view: Face; anchor: string; frames: readonly Frame[] }>;
export type ReaderRegistry = Readonly<{ paperId: string; anchors: readonly string[]; foundations: readonly string[] }>;
export function parseDetail(input: string | null): Detail | null {
  return input === "0" || input === "overview" ? 0 : input === "1" || input === "full" ? 1 : input === "2" || input === "steps" ? 2 : null;
}
export function parseReaderLocation(search: string, hash: string, registry: ReaderRegistry, stored: string | null = null): ReaderState {
  const params = new URLSearchParams(search.length <= 4096 ? search : "");
  const single = (key: string) => params.getAll(key).length === 1 ? params.get(key) : null;
  const view = single("view"), detail = parseDetail(single("detail")) ?? parseDetail(stored) ?? 1;
  let rawAnchor = ""; try { rawAnchor = decodeURIComponent(hash.replace(/^#/, "")); } catch { /* Unrecognized anchors use the first authored passage. */ }
  const anchor = registry.anchors.includes(rawAnchor) ? rawAnchor : registry.anchors[0] ?? "";
  const open = single("open");
  const foundationId = open && open.length <= 200 && open.startsWith("foundation:") ? open.slice(11) : "";
  return Object.freeze({ detail, view: FACES.includes(view as Face) ? view as Face : "reading", lens: single("lens") === "modern", anchor,
    frames: Object.freeze(registry.foundations.includes(foundationId) ? [{ foundationId, triggerId: "", relativeY: 0 }] : []),
  });
}
export function openFoundation(state: ReaderState, frame: Frame, registry: ReaderRegistry): ReaderState {
  if (!registry.foundations.includes(frame.foundationId) || !Number.isFinite(frame.relativeY)) throw new TypeError("Unknown or malformed clarification.");
  const frames = [...state.frames];
  if (frames.length === MAX_CLARIFICATION_DEPTH) frames[MAX_CLARIFICATION_DEPTH - 1] = Object.freeze({ ...frame });
  else frames.push(Object.freeze({ ...frame }));
  return Object.freeze({ ...state, frames: Object.freeze(frames) });
}
/** Closed allowlist: no notebook, device preference, prediction or experiment payload can leak. */
export function passageHref(registry: ReaderRegistry, state: Pick<ReaderState, "view" | "detail" | "lens" | "anchor">): string {
  if (!/^[a-z][a-z0-9-]*$/.test(registry.paperId) || !registry.anchors.includes(state.anchor) || !FACES.includes(state.view) || ![0,1,2].includes(state.detail)) throw new TypeError("Invalid passage location.");
  const params = new URLSearchParams();
  if (state.view !== "reading") params.set("view", state.view);
  if (state.detail !== 1) params.set("detail", String(state.detail));
  if (state.lens) params.set("lens", "modern");
  return `/papers/${registry.paperId}/${params.size ? `?${params}` : ""}#${state.anchor}`;
}
export function readerHref(registry: ReaderRegistry, state: ReaderState): string {
  const url = new URL(passageHref(registry, state), "https://reader.invalid");
  const frame = state.frames.at(-1); if (frame) url.searchParams.set("open", `foundation:${frame.foundationId}`);
  return url.pathname + url.search + url.hash;
}
/** History is untrusted too: old builds and extensions may leave incompatible state. */
export function restoreReaderState(input: unknown, registry: ReaderRegistry): ReaderState | null {
  if (!input || typeof input !== "object") return null;
  const s = input as ReaderState;
  if (!FACES.includes(s.view) || ![0,1,2].includes(s.detail) || typeof s.lens !== "boolean" || !registry.anchors.includes(s.anchor) || !Array.isArray(s.frames) || s.frames.length > MAX_CLARIFICATION_DEPTH) return null;
  if (s.frames.some(f => !f || !registry.foundations.includes(f.foundationId) || typeof f.triggerId !== "string" || f.triggerId.length > 200 || !Number.isFinite(f.relativeY))) return null;
  return Object.freeze({ detail: s.detail, view: s.view, lens: s.lens, anchor: s.anchor, frames: Object.freeze(s.frames.map(f => Object.freeze({ foundationId: f.foundationId, triggerId: f.triggerId, relativeY: f.relativeY }))) });
}
