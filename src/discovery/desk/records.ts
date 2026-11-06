/** Build-time projection of authored objects and the same cards the four journeys render. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { registryEntry } from "../../experiments/registry.ts";
import { JOURNEY_SHELVES } from "../cards/journeyCards.ts";
import { DESK_INSTRUMENT_BINDINGS, DESK_MANIFEST_DEFAULTS } from "./instruments.ts";
import { DESK_EXPERIMENT_IDS, DESK_OBJECT_IDS, type DeskObject, deskCatalogue } from "./model.ts";

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`1904 desk: ${label} must be a record`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`1904 desk: ${label} must be nonempty text`);
  return value;
}
function texts(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`1904 desk: ${label} must be a list`);
  const result = value.map((item) => text(item, label));
  if (new Set(result).size !== result.length)
    throw new Error(`1904 desk: ${label} contains duplicate entries`);
  return result;
}

export function parseDesk(
  value: unknown,
): Readonly<{ reconstruction: string; objects: readonly DeskObject[] }> {
  const raw = record(value, "content");
  if (raw.schemaVersion !== 1 || !Array.isArray(raw.objects))
    throw new Error("1904 desk: expected schema version 1 and five objects");
  const objects = raw.objects.map((value, index) => {
    const item = record(value, `object ${index + 1}`);
    const id = DESK_OBJECT_IDS[index];
    if (!id || item.id !== id)
      throw new Error(`1904 desk: object ${index + 1} must be ${DESK_OBJECT_IDS[index]}`);
    const responses = texts(item.responses, `${item.id} responses`);
    if (responses.length !== 3) throw new Error(`1904 desk: ${item.id} needs all three responses`);
    const experiments = texts(item.experiments, `${item.id} experiments`).map((experiment) => {
      const known = DESK_EXPERIMENT_IDS.find((known) => known === experiment);
      if (!known)
        throw new Error(
          `1904 desk: ${item.id} uses undeclared historical experiment ${experiment}`,
        );
      return known;
    });
    return {
      id,
      title: text(item.title, "title"),
      question: text(item.question, "question"),
      description: text(item.description, "description"),
      unresolved: text(item.unresolved, "unresolved"),
      responses: [
        text(responses[0], "first response"),
        text(responses[1], "second response"),
        text(responses[2], "third response"),
      ] as const,
      cardIds: texts(item.cardIds, `${item.id} cards`),
      foundations: texts(item.foundations, `${item.id} foundations`),
      experiments,
      journey: text(item.journey, `${item.id} journey`),
    } satisfies DeskObject;
  });
  if (objects.length !== DESK_OBJECT_IDS.length)
    throw new Error("1904 desk: expected exactly five objects");
  return { reconstruction: text(raw.reconstruction, "reconstruction statement"), objects };
}

export function loadDesk(root = process.cwd()) {
  const desk = parseDesk(
    load(readFileSync(join(root, "content/arguments/desk-1904.yaml"), "utf8")),
  );
  const foundationTitles = new Map<string, string>();
  for (const object of desk.objects) {
    if (!JOURNEY_SHELVES.some((shelf) => shelf.journey === object.journey))
      throw new Error(`1904 desk: unknown journey ${object.journey}`);
    for (const slug of object.foundations) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
        throw new Error(`1904 desk: invalid foundation ${slug}`);
      const foundation = record(
        JSON.parse(readFileSync(join(root, "content/foundations", `${slug}.json`), "utf8")),
        slug,
      );
      if (foundation.id !== slug) throw new Error(`1904 desk: foundation ${slug} does not resolve`);
      foundationTitles.set(slug, text(foundation.title, `${slug} title`));
    }
    for (const id of object.experiments) {
      if (id === "signed-displacement") continue;
      const binding = DESK_INSTRUMENT_BINDINGS[id];
      const entry = registryEntry(id);
      if (entry.status !== "registered" || !entry.owner)
        throw new Error(`1904 desk: ${object.id} has no registered owner for ${id}`);
      // The three shelf adapters already declare their two modes in shelf/definition.ts and
      // share their historical bindings with the live views. LQ-02/SR-04 also have manifests.
      if (id === "lq-02" || id === "sr-04") {
        const manifest = record(
          load(readFileSync(join(root, "content/experiments", `${id}.yaml`), "utf8")),
          id,
        );
        if (
          !Array.isArray(manifest.modes) ||
          !manifest.modes.some((mode) => record(mode, id).id === binding.modeId)
        )
          throw new Error(`1904 desk: ${id} does not declare mode ${binding.modeId}`);
        const preset = Array.isArray(manifest.presets)
          ? manifest.presets.find((preset) => record(preset, id).presetId === binding.presetId)
          : undefined;
        if (!preset)
          throw new Error(`1904 desk: ${id} does not declare preset ${binding.presetId}`);
        const parameters = record(
          record(preset, id).parameterValues,
          `${binding.presetId} parameters`,
        );
        const defaults = DESK_MANIFEST_DEFAULTS[id];
        if (
          Object.keys(parameters).length !== Object.keys(defaults).length ||
          Object.entries(defaults).some(([key, value]) => parameters[key] !== value)
        )
          throw new Error(
            `1904 desk: ${binding.presetId} differs from its accepted worked example`,
          );
      }
    }
  }
  return { ...desk, catalogue: deskCatalogue(JOURNEY_SHELVES, desk.objects), foundationTitles };
}
