#!/usr/bin/env bun
/**
 * Join each capstone's authored selection to the laboratory's real settings loader. Physics and
 * parameter validation remain in that laboratory. Only public links reach the server components;
 * the worksheet never imports a session, evaluator or the whole experiment registry.
 */
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { strictParse } from "../src/content/schemas/strictParse.ts";
import {
  type ExperimentLaunch,
  type ExperimentLaunchIndex,
  type ExperimentSelection,
  experimentSelectionKey,
  isExperimentLaunchHref,
} from "../src/discovery/capstone/experimentLaunch.ts";
import { loadCapstone } from "../src/discovery/capstone/loadCapstone.ts";
import { encodeTapePermalink } from "../src/experiments/permalink/codec.ts";
import { MAX_PERMALINK_URL_LENGTH } from "../src/experiments/permalink/codecCore.ts";
import { draftTapeForSettings } from "../src/experiments/permalink/draftTape.ts";
import { tapeForSettings } from "../src/experiments/permalink/sessionTape.ts";
import { SR01_DEFAULTS } from "../src/experiments/sr01/definition.ts";
import { validateSr01Parameters } from "../src/experiments/sr01/parameters.ts";
import { encodeSr01Settings } from "../src/experiments/sr01/permalink.ts";
import { buildTapeLinks, DRAFT_BINDINGS, SESSION_BINDINGS } from "./generate-tape-links.ts";

export const CAPSTONE_PAPERS = [
  "brownian-motion", "light-quanta", "special-relativity", "mass-energy",
] as const;

function unavailable(instrumentId: string, reason: string): ExperimentLaunch {
  return { status: "unavailable", instrumentId, reason };
}
function ready(instrumentId: string, href: string, kind: "form" | "session"): ExperimentLaunch {
  if (href.length > MAX_PERMALINK_URL_LENGTH || !isExperimentLaunchHref(href, instrumentId)) {
    return unavailable(instrumentId, "The settings do not fit a supported laboratory link.");
  }
  return { status: "ready", instrumentId, href, kind };
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Unknown keys cannot be ignored: that would load the default instead of what the preset asks. */
export function buildPresetLaunch(
  instrumentId: string,
  settings: Readonly<Record<string, unknown>>,
): ExperimentLaunch {
  const session = SESSION_BINDINGS[instrumentId];
  const draft = DRAFT_BINDINGS[instrumentId];
  const defaults = instrumentId === "sr-01" ? SR01_DEFAULTS : (session ?? draft)?.defaults;
  if (!defaults) return unavailable(instrumentId, "This laboratory has no supported settings loader.");
  if (Object.keys(settings).length === 0 ||
      Object.keys(settings).some((key) => !Object.hasOwn(defaults, key))) {
    return unavailable(instrumentId, "The preset contains empty or unrecognized laboratory settings.");
  }
  const parameters = { ...defaults, ...settings };
  // SR-01 predates the tape bindings. Its existing URL codec is the authority; adding ?tape=
  // would suppress that codec, not select the synchronization preset.
  if (instrumentId === "sr-01") {
    const checked = validateSr01Parameters(parameters);
    if (checked.kind !== "accepted") return unavailable(instrumentId, "The laboratory refused this preset.");
    return ready(instrumentId, `/lab/${instrumentId}/${encodeSr01Settings(checked.data)}`, "session");
  }
  const binding = session ?? draft;
  if (!binding || binding.validate(parameters).kind !== "accepted") {
    return unavailable(instrumentId, "The laboratory refused this preset.");
  }
  const tape = session ? tapeForSettings(session, parameters)
    : draft ? draftTapeForSettings(draft, parameters) : null;
  if (!tape) return unavailable(instrumentId, "The laboratory could not record the accepted settings.");
  return ready(instrumentId, `/lab/${instrumentId}/?tape=${encodeTapePermalink(tape)}`,
    session ? "session" : "form");
}

function declaredPreset(selection: ExperimentSelection, root: string): ExperimentLaunch {
  const manifest = strictParse(readFileSync(
    resolve(root, "content/experiments", `${selection.instrumentId}.yaml`), "utf8",
  ), "yaml");
  const candidates = isRecord(manifest) && Array.isArray(manifest.presets)
    ? manifest.presets.filter((preset: unknown) => isRecord(preset) && preset.presetId === selection.presetId)
    : [];
  if (candidates.length !== 1 || !isRecord(candidates[0]) || !isRecord(candidates[0].parameterValues)) {
    return unavailable(selection.instrumentId, "The selected preset has no unique declared parameter set.");
  }
  return buildPresetLaunch(selection.instrumentId, candidates[0].parameterValues);
}

/** Every authored selection gets a ready link or a named gap. No missing preset is dropped. */
export function buildCapstoneLinks(): ExperimentLaunchIndex {
  const root = process.cwd();
  const tapes = buildTapeLinks();
  const links: Record<string, ExperimentLaunch> = {};
  for (const paper of CAPSTONE_PAPERS) {
    for (const selection of loadCapstone(paper, root).capstone.presets) {
      let launch: ExperimentLaunch;
      if (selection.tapeId) {
        const tape = tapes.links[selection.tapeId];
        const gap = tapes.notLinked[selection.tapeId];
        launch = tape && tape.experimentId === selection.instrumentId
          ? ready(selection.instrumentId, tape.href, tape.kind)
          : unavailable(selection.instrumentId, gap?.reason ?? "The selected tape has no matching laboratory launch.");
      } else {
        launch = declaredPreset(selection, root);
      }
      links[experimentSelectionKey(selection)] = launch;
    }
  }
  return Object.freeze(links);
}

export async function generateCapstoneLinks() {
  const links = buildCapstoneLinks();
  const destination = resolve(process.cwd(), "src/generated/capstone-links.json");
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(links, null, 2)}\n`);
  const entries = Object.values(links);
  return { selections: entries.length, linked: entries.filter((link) => link.status === "ready").length,
    unavailable: entries.filter((link) => link.status === "unavailable") };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await generateCapstoneLinks()));
}
