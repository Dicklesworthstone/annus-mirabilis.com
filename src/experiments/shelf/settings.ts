/** Bounded settings links, not a claimed replay of unrecorded control actions. */

import { ExperimentRuntimeError } from "../refusal.ts";
import type { Parameters } from "../store/instanceStore.ts";
import { type ShelfId, type ShelfMode, shelfPath, validateShelfInput } from "./definition.ts";

export type ShelfSettingsLink = Readonly<
  | { kind: "absent" }
  | { kind: "settings"; parameters: Parameters }
  | { kind: "invalid"; message: string }
>;
export const SHELF_SETTINGS_LIMIT = 2048;

export function encodeShelfSettings(id: ShelfId, mode: ShelfMode, input: Parameters): string {
  const checked = validateShelfInput(id, mode, input);
  if (checked.kind !== "accepted")
    throw new ExperimentRuntimeError("settings-rejected", checked.message, "shelf");
  const payload = { version: 1, instrument: id, mode, parameters: checked.parameters };
  const url = `${shelfPath(id, mode)}?${new URLSearchParams({ shelf: JSON.stringify(payload) })}`;
  if (url.length > SHELF_SETTINGS_LIMIT)
    throw new ExperimentRuntimeError(
      "settings-link-too-large",
      "This settings link is too large.",
      "shelf",
    );
  return url;
}

export function decodeShelfSettings(
  id: ShelfId,
  mode: ShelfMode,
  search: string,
): ShelfSettingsLink {
  const invalid = (): ShelfSettingsLink => ({
    kind: "invalid",
    message:
      "This settings link is incomplete or belongs to another experiment or mode. The worked example is unchanged.",
  });
  if (!search || search === "?") return { kind: "absent" };
  if (search.length + shelfPath(id, mode).length > SHELF_SETTINGS_LIMIT) return invalid();
  const query = new URLSearchParams(search);
  if (query.size !== 1 || query.getAll("shelf").length !== 1) return invalid();
  try {
    const payload: unknown = JSON.parse(query.get("shelf") ?? "");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return invalid();
    const record = payload as Record<string, unknown>;
    if (
      Object.keys(record).length !== 4 ||
      record.version !== 1 ||
      record.instrument !== id ||
      record.mode !== mode
    )
      return invalid();
    const checked = validateShelfInput(id, mode, record.parameters);
    return checked.kind === "accepted"
      ? { kind: "settings", parameters: checked.parameters }
      : invalid();
  } catch {
    return invalid();
  }
}
