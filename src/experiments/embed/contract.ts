import { ExperimentRuntimeError } from "../refusal.ts";
import { type EmbeddableId, embedInstrument, isEmbeddableId } from "./catalogue.ts";

export const EMBED_ORIGIN = "https://annus-mirabilis.com";
export const EMBED_VERSION = "1";
export const EMBED_QUERY_LIMIT = 2048;
export type EmbedOptions = Readonly<{
  theme: "system" | "light" | "dark";
  detail: "overview" | "full" | "steps";
  motion: "system" | "reduce";
}>;
export const DEFAULT_EMBED_OPTIONS: EmbedOptions = Object.freeze({
  theme: "system",
  detail: "overview",
  motion: "system",
});
const allowed = {
  theme: ["system", "light", "dark"],
  detail: ["overview", "full", "steps"],
  motion: ["system", "reduce"],
} as const;
export type EmbedDecode =
  | Readonly<{ kind: "options"; options: EmbedOptions }>
  | Readonly<{ kind: "invalid"; message: string }>;

/** Query options configure presentation, never physical parameters or private state.
 * Refuse the whole configuration instead of silently repairing a purported saved run.
 */
export function decodeEmbedOptions(search: string): EmbedDecode {
  const invalid = (message: string): EmbedDecode => ({ kind: "invalid", message });
  if (search.length > EMBED_QUERY_LIMIT) return invalid("This embed link is too long.");
  const query = new URLSearchParams(search);
  const keys = ["embed", ...Object.keys(allowed)];
  for (const key of query.keys()) {
    if (!keys.includes(key))
      return invalid(
        "This embed does not accept experiment settings, tapes, or other URL fields. Open the full laboratory to restore an experiment.",
      );
    if (query.getAll(key).length !== 1)
      return invalid("The embed link repeats a presentation option.");
  }
  if (query.has("embed") && query.get("embed") !== EMBED_VERSION)
    return invalid("This embed version is not supported. Generate a current link.");
  for (const [key, values] of Object.entries(allowed)) {
    if (query.has(key) && !(values as readonly string[]).includes(query.get(key) ?? ""))
      return invalid("The embed link contains an unsupported presentation option.");
  }
  return {
    kind: "options",
    options: {
      theme: (query.get("theme") ?? DEFAULT_EMBED_OPTIONS.theme) as EmbedOptions["theme"],
      detail: (query.get("detail") ?? DEFAULT_EMBED_OPTIONS.detail) as EmbedOptions["detail"],
      motion: (query.get("motion") ?? DEFAULT_EMBED_OPTIONS.motion) as EmbedOptions["motion"],
    },
  };
}

export function embedPath(id: EmbeddableId, options: EmbedOptions = DEFAULT_EMBED_OPTIONS): string {
  if (!isEmbeddableId(id))
    throw new ExperimentRuntimeError(
      "embed-not-admitted",
      "No admitted adapter exists for this instrument.",
      "embed",
    );
  // Runtime callers do not get to smuggle additional object properties into a public URL.
  const query = new URLSearchParams({
    embed: EMBED_VERSION,
    theme: options.theme,
    detail: options.detail,
    motion: options.motion,
  });
  const parsed = decodeEmbedOptions(query.toString());
  if (parsed.kind !== "options")
    throw new ExperimentRuntimeError("embed-invalid-options", parsed.message, "embed");
  return `/embed/lab/${id}/?${query}`;
}

export function embedUrl(id: EmbeddableId, options: EmbedOptions = DEFAULT_EMBED_OPTIONS): string {
  return `${EMBED_ORIGIN}${embedPath(id, options)}`;
}

function attribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Fixed first-party origin and native scrolling: no parent-page script or wildcard messaging.
 * A visible fallback link works when a CMS strips iframes or a browser blocks them.
 */
export function embedMarkup(
  id: EmbeddableId,
  options: EmbedOptions = DEFAULT_EMBED_OPTIONS,
  height = 900,
): string {
  const instrument = embedInstrument(id);
  if (!instrument)
    throw new ExperimentRuntimeError(
      "embed-unknown-instrument",
      "Unknown embeddable instrument.",
      "embed",
    );
  if (!Number.isInteger(height) || height < 400 || height > 2000)
    throw new ExperimentRuntimeError(
      "embed-height-out-of-range",
      "Embed height must be a whole number from 400 to 2000 pixels.",
      "embed",
    );
  return `<iframe\n  src="${attribute(embedUrl(id, options))}"\n  title="${attribute(instrument.title)} · Annus Mirabilis"\n  width="100%" height="${height}"\n  loading="lazy" referrerpolicy="no-referrer"\n  style="border:0;max-width:100%"\n></iframe>\n<p><a href="${EMBED_ORIGIN}/lab/${id}/">Open ${attribute(instrument.title)} at Annus Mirabilis</a></p>`;
}
