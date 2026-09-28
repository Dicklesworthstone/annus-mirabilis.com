#!/usr/bin/env bun
/**
 * "SEE IT IN THE INSTRUMENT" OPENS THE SETTING THAT SHOWS THE POINT, NOT THE DEFAULT VIEW (dispatch 331).
 *
 * AGENTS.md's `Misconception` entity says each entry "opens an instrument preset that shows it".
 * Measured 2026-09-28: every callout's link was `/lab/<id>/`, a bare lab path, so a reader who
 * followed it landed on the instrument's default view and had to find the setting themselves, which
 * is the one thing the entry was written to spare them. The settings were not missing: 135 presets
 * are registered across the manifests and 15 of the 26 misconception records name one.
 *
 * WHY `?tape=` AND NOT `?preset=`. Nothing in non-test source reads a `preset` search param, so a
 * `?preset=` href would look like it opens a preset and would land on the default view exactly as
 * before: the same defect wearing a query string. `?tape=` is the mechanism that exists, and the
 * laboratories restore it on mount (useLabTapeLink, useDraftTapeLink). The tour records' `reveal:
 * { kind: "preset" | "tape" }` looked like a second route and is not one: it appears only inside
 * src/content/tours/tours.ts, which uses it to check that a cited preset sets a prompt's control.
 * Nothing anywhere opens a laboratory at a preset from a URL.
 *
 * THE LABORATORY DECIDES, AND THE BINDING TABLE IS NOT COPIED. The preset's `parameterValues` are
 * merged over the laboratory's own defaults and handed to its own validator and its own
 * tapeForSettings / draftTapeForSettings, imported from generate-tape-links.ts rather than restated
 * here, so this generator cannot promise a state an instrument would refuse and no second table can
 * drift. Three laboratories a record points at (sr-01, sr-05, bm-06) have no shared-link binding at
 * all, so no link can carry settings to them and their records keep the plain lab path.
 *
 * HOW A PRESET IS NAMED, AND THE TRAP IN READING IT. Ten records carry the id in a structured field,
 * `intervention.scenarioId`, and five more carry it only in the prose of
 * `intervention.defaultsReviewed.defaultControls` ("Described from the manifest: preset
 * bm-01-velocity-trap; T 290.15 K, ..."). The prose is read by testing each of the 135 REGISTERED ids
 * for exact containment of `preset <id>`, longest id first, rather than by capturing a character
 * class: `[a-z0-9-]+` truncates `sr-03-sphere-0.6c` at the dot, and the truncated `sr-03-sphere-0`
 * resolves to nothing, so four records that do name a preset read as naming none. That is how a
 * fifteen becomes an eleven, and it happened twice on the way here, once in the dispatch's own
 * measurement and once in mine. Matching against known ids cannot make that mistake.
 *
 * `intervention.scenarioId` IS NOT ALWAYS A PRESET, which is why every candidate from either source
 * is validated against the registered set before it reaches a link. misc-me-formula-in-paper names
 * `mass-energy-printed-factor` there, a registered SCENARIO, and its prose says "preset
 * me-02-limit-zero", which is one of me-02's acceptanceCases and not a preset either: me-02 registers
 * exactly one, me-02-0.6c. So that record names no preset, keeps the plain lab path, and its
 * mis-naming is reported rather than guessed at. Reading either field without checking it against the
 * registry would have produced a link to a preset that does not exist.
 *
 * WHAT A LINK DOES NOT CLAIM. It carries the preset's settings and nothing else: no events, no
 * replay. A session laboratory has them in force on arrival; a form laboratory puts them in its form
 * and calculates when the reader applies them, which is a different promise and is recorded as
 * `kind`. The restore runs in an effect after hydration, so a reader with no JavaScript gets the
 * laboratory's worked example, as they do for every shared link on this site.
 */
import { readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "../src/content/provenance/yaml.ts";
import { BM06_DEFAULTS } from "../src/experiments/bm06/definition.ts";
import { validateBm06Parameters } from "../src/experiments/bm06/parameters.ts";
import { decodeBm06Settings, encodeBm06Settings } from "../src/experiments/bm06/permalink.ts";
import { encodeTapePermalink } from "../src/experiments/permalink/codec.ts";
import { MAX_PERMALINK_URL_LENGTH } from "../src/experiments/permalink/codecCore.ts";
import { draftTapeForSettings } from "../src/experiments/permalink/draftTape.ts";
import { requirementsOf, tapeForSettings } from "../src/experiments/permalink/sessionTape.ts";
import { SR01_DEFAULTS } from "../src/experiments/sr01/definition.ts";
import { validateSr01Parameters } from "../src/experiments/sr01/parameters.ts";
import { decodeSr01Settings, encodeSr01Settings } from "../src/experiments/sr01/permalink.ts";
import { loadPaperMargins } from "../src/reader/marginRecords.ts";
import { DRAFT_BINDINGS, SESSION_BINDINGS, type TapeLinkKind } from "./generate-tape-links.ts";

/**
 * A LABORATORY THAT READS ITS OWN QUERY FORMAT ON MOUNT, rather than a `?tape=` permalink (dispatch 335).
 *
 * Four laboratories had no shared-link binding and each was blocking a link a reader clicks. Two of
 * them turned out to honour a link already, in their own format and not the generic one: SR-01's
 * ClockSyncLab calls `decodeSr01Settings(window.location.search)` and its standalone route passes
 * `restoreFromLocation`, and BM-06's BrownianLab calls `decodeBm06Settings(window.location.search)`
 * in its mount effect. So the honest link for those two is the one they read, and adding a `?tape=`
 * binding for them would have meant new machinery beside a working mechanism.
 *
 * THE TWO PROMISES DIFFER, and `kind` records which. SR-01 applies the decoded settings to its session
 * on arrival and says "Loaded the linked setup and recalculated the event ledger", so it is `session`.
 * BM-06 fills its form and says "Shared settings are loaded. Choose Apply settings to calculate them",
 * so it is `form`. Both laboratories validate before anything is minted: BM-06's own encoder throws on
 * settings it would refuse, and this generator validates first in either case.
 */
export type QuerySettingsBinding = Readonly<{
  experimentId: string;
  defaults: Readonly<Record<string, unknown>>;
  validate(input: unknown): Readonly<{ kind: string; data?: unknown }>;
  encode(parameters: never): string;
  /**
   * The laboratory's own reader for that format. This generator does not need it; the guard test
   * does, to follow a minted link back the way the instrument will, and it lives here so the pair
   * cannot drift apart into two tables.
   */
  decode(search: string): Readonly<{ kind: string; parameters?: unknown }>;
  kind: TapeLinkKind;
}>;

export const QUERY_BINDINGS: Readonly<Record<string, QuerySettingsBinding>> = Object.freeze({
  "sr-01": Object.freeze({
    experimentId: "sr-01",
    defaults: SR01_DEFAULTS as unknown as Readonly<Record<string, unknown>>,
    validate: validateSr01Parameters as QuerySettingsBinding["validate"],
    encode: encodeSr01Settings as unknown as QuerySettingsBinding["encode"],
    decode: decodeSr01Settings as QuerySettingsBinding["decode"],
    kind: "session" as const,
  }),
  "bm-06": Object.freeze({
    experimentId: "bm-06",
    defaults: BM06_DEFAULTS as Readonly<Record<string, unknown>>,
    validate: validateBm06Parameters as QuerySettingsBinding["validate"],
    encode: encodeBm06Settings as unknown as QuerySettingsBinding["encode"],
    decode: decodeBm06Settings as QuerySettingsBinding["decode"],
    kind: "form" as const,
  }),
});

/**
 * A PRESET CANNOT CARRY A BOOLEAN, AND ONE LABORATORY REQUIRES ONE (dispatch 335).
 *
 * bm-06's manifest declares the FTCS grid switch as `enumerated: [0, 1]` and the preset
 * bm-06-modern-one-second writes `gridEnabled: 0`, while `Bm06Parameters.gridEnabled` is a boolean and
 * the laboratory refuses anything else: "The grid switch must be true or false." Writing `false` in the
 * preset is not the repair, because `validateExperiment` keeps only number and string values in
 * `parameterValues` and DROPS a boolean silently, so the key would vanish rather than fail. Measured:
 * the validated preset then reports `gridEnabled: undefined`.
 *
 * So the 0 or 1 the manifest declares is read as the boolean the laboratory's own default declares, and
 * only where that default IS a boolean. Every other value is passed through untouched and the
 * laboratory refuses it, which is the point: this converts a spelling the content layer cannot write,
 * it does not widen what an instrument accepts.
 */
export function settingsForLab(
  defaults: Readonly<Record<string, unknown>>,
  values: Readonly<Record<string, number | string | boolean>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values))
    out[key] =
      typeof defaults[key] === "boolean" && (value === 0 || value === 1) ? value === 1 : value;
  return out;
}

export type RegisteredPreset = Readonly<{
  presetId: string;
  experimentId: string;
  label: string;
  parameterValues: Readonly<Record<string, number | string | boolean>>;
}>;

export type MisconceptionLink = Readonly<{
  experimentId: string;
  presetId: string;
  presetLabel: string;
  href: string;
  kind: TapeLinkKind;
  settings: number;
  /** Which of the record's two fields named the preset, so a reader of this file can check it. */
  namedBy: "scenarioId" | "prose";
  /** Which mechanism minted it: the generic ?tape= permalink, or the laboratory's own query format. */
  via: "tape" | "lab-query";
}>;

/**
 * Why a callout has no settings link. The CAUSE is separate from the sentence for the reason the
 * tape generator gives: the sentence is for a person reading this file, and the cause is what the
 * guard test reads, so a record whose laboratory has no binding is distinguishable from one whose
 * settings were refused.
 */
export type MisconceptionLinkCause =
  | "no-instrument"
  | "names-no-preset"
  | "no-settings"
  | "no-binding"
  | "refused"
  | "not-recordable"
  | "too-long";

export type MisconceptionLinkGap = Readonly<{
  experimentId?: string | undefined;
  presetId?: string | undefined;
  cause: MisconceptionLinkCause;
  reason: string;
}>;

export type MisconceptionLinks = Readonly<{
  links: Readonly<Record<string, MisconceptionLink>>;
  notLinked: Readonly<Record<string, MisconceptionLinkGap>>;
}>;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Every preset any manifest registers, read with the site's own YAML reader rather than a regex. */
export function registeredPresets(root: string = ROOT): Map<string, RegisteredPreset> {
  const dir = join(root, "content", "experiments");
  const out = new Map<string, RegisteredPreset>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".yaml"))) {
    const manifest = parseYaml(readFileSync(join(dir, file), "utf8")) as Record<string, unknown>;
    const experimentId = file.replace(/\.yaml$/, "");
    const presets = Array.isArray(manifest.presets) ? manifest.presets : [];
    for (const entry of presets) {
      const preset = (entry ?? {}) as Record<string, unknown>;
      const presetId = typeof preset.presetId === "string" ? preset.presetId : undefined;
      if (!presetId) continue;
      const values = (preset.parameterValues ?? {}) as Readonly<
        Record<string, number | string | boolean>
      >;
      out.set(presetId, {
        presetId,
        experimentId,
        label: typeof preset.label === "string" ? preset.label : presetId,
        parameterValues: values,
      });
    }
  }
  return out;
}

/**
 * The preset a record names, from the structured field if it resolves and the prose if it does not.
 * Longest id first so a shorter registered id can never shadow a longer one that contains it.
 */
export function presetNamedBy(
  record: {
    intervention?: { scenarioId?: string | undefined; defaultsReviewed?: unknown } | undefined;
  },
  presets: ReadonlyMap<string, RegisteredPreset>,
): { preset: RegisteredPreset; namedBy: "scenarioId" | "prose" } | undefined {
  const structured = record.intervention?.scenarioId;
  if (structured) {
    const direct = presets.get(structured);
    if (direct) return { preset: direct, namedBy: "scenarioId" };
  }
  const reviewed = (record.intervention?.defaultsReviewed ?? {}) as Record<string, unknown>;
  const prose = typeof reviewed.defaultControls === "string" ? reviewed.defaultControls : "";
  if (!prose) return undefined;
  const ids = [...presets.keys()].sort((a, b) => b.length - a.length);
  for (const id of ids)
    if (prose.includes(`preset ${id}`)) {
      const preset = presets.get(id);
      if (preset) return { preset, namedBy: "prose" };
    }
  return undefined;
}

/** The laboratory's own words for a refusal, preferred over anything this script could say. */
function refusalSentence(lab: string, outcome: { kind: string }): string {
  const refusal = (outcome as { refusal?: { message?: unknown } }).refusal;
  const message = refusal?.message;
  if (typeof message === "string" && message.trim()) return message;
  const requirements = requirementsOf(outcome as never);
  if (requirements) return requirements;
  return `${lab.toUpperCase()} does not accept this preset's settings.`;
}

export function buildMisconceptionLinks(root: string = ROOT): MisconceptionLinks {
  const presets = registeredPresets(root);
  const links: Record<string, MisconceptionLink> = {};
  const notLinked: Record<string, MisconceptionLinkGap> = {};
  const papers = readdirSync(join(root, "content", "misconceptions"));
  for (const paper of papers)
    for (const record of loadPaperMargins(paper, root).misconceptions) {
      const lab = record.intervention.instrumentId ?? record.instrumentIds?.[0];
      if (!lab) {
        notLinked[record.id] = {
          cause: "no-instrument",
          reason: `${record.id} names no instrument, so the callout shows no instrument link at all.`,
        };
        continue;
      }
      const named = presetNamedBy(record, presets);
      if (!named) {
        notLinked[record.id] = {
          experimentId: lab,
          cause: "names-no-preset",
          reason: `${record.id} names no registered preset, so it keeps the plain ${lab.toUpperCase()} link. Choosing which setting demonstrates it is editorial work for whoever wrote the entry.`,
        };
        continue;
      }
      const { preset, namedBy } = named;
      const settings = preset.parameterValues;
      if (Object.keys(settings).length === 0) {
        notLinked[record.id] = {
          experimentId: lab,
          presetId: preset.presetId,
          cause: "no-settings",
          reason: `Preset ${preset.presetId} declares no parameterValues, so there is no setting for a link to carry.`,
        };
        continue;
      }
      const session = SESSION_BINDINGS[preset.experimentId];
      const draft = DRAFT_BINDINGS[preset.experimentId];
      const query = !session && !draft ? QUERY_BINDINGS[preset.experimentId] : undefined;
      if (query) {
        // The laboratory reads its own query format on mount, so the link is minted in that format
        // and not as a ?tape=, which this instrument would ignore. It still validates first.
        const wanted = { ...query.defaults, ...settingsForLab(query.defaults, settings) };
        const accepted = query.validate(wanted);
        if (accepted.kind !== "accepted") {
          notLinked[record.id] = {
            experimentId: preset.experimentId,
            presetId: preset.presetId,
            cause: "refused",
            reason: refusalSentence(preset.experimentId, accepted),
          };
          continue;
        }
        let encoded: string;
        try {
          encoded = query.encode(accepted.data as never);
        } catch {
          notLinked[record.id] = {
            experimentId: preset.experimentId,
            presetId: preset.presetId,
            cause: "not-recordable",
            reason: `${preset.experimentId.toUpperCase()} accepted ${preset.presetId} but its own settings link refused to carry them.`,
          };
          continue;
        }
        const queryHref = `/lab/${preset.experimentId}/${encoded}`;
        if (queryHref.length > MAX_PERMALINK_URL_LENGTH) {
          notLinked[record.id] = {
            experimentId: preset.experimentId,
            presetId: preset.presetId,
            cause: "too-long",
            reason: `The link for ${preset.presetId} is ${queryHref.length} characters, over the ${MAX_PERMALINK_URL_LENGTH} a shared link may carry.`,
          };
          continue;
        }
        links[record.id] = {
          experimentId: preset.experimentId,
          presetId: preset.presetId,
          presetLabel: preset.label,
          href: queryHref,
          kind: query.kind,
          settings: Object.keys(settings).length,
          namedBy,
          via: "lab-query",
        };
        continue;
      }
      if (!session && !draft) {
        notLinked[record.id] = {
          experimentId: preset.experimentId,
          presetId: preset.presetId,
          cause: "no-binding",
          reason: `${preset.experimentId.toUpperCase()} has neither a shared-link binding nor a settings link of its own, so nothing can carry settings to it and ${record.id} keeps the plain lab path.`,
        };
        continue;
      }
      const binding = session ?? draft;
      if (!binding) continue;
      const merged = { ...binding.defaults, ...settings };
      const checked = binding.validate(merged);
      if (checked.kind !== "accepted") {
        notLinked[record.id] = {
          experimentId: preset.experimentId,
          presetId: preset.presetId,
          cause: "refused",
          reason: refusalSentence(preset.experimentId, checked),
        };
        continue;
      }
      const built = session
        ? tapeForSettings(session, merged)
        : draft
          ? draftTapeForSettings(draft, merged)
          : null;
      if (!built) {
        notLinked[record.id] = {
          experimentId: preset.experimentId,
          presetId: preset.presetId,
          cause: "not-recordable",
          reason: `${preset.experimentId.toUpperCase()} accepted ${preset.presetId} but could not record it in a shared link.`,
        };
        continue;
      }
      const href = `/lab/${preset.experimentId}/?tape=${encodeTapePermalink(built)}`;
      if (href.length > MAX_PERMALINK_URL_LENGTH) {
        notLinked[record.id] = {
          experimentId: preset.experimentId,
          presetId: preset.presetId,
          cause: "too-long",
          reason: `The link for ${preset.presetId} is ${href.length} characters, over the ${MAX_PERMALINK_URL_LENGTH} a shared link may carry.`,
        };
        continue;
      }
      links[record.id] = {
        experimentId: preset.experimentId,
        presetId: preset.presetId,
        presetLabel: preset.label,
        href,
        kind: session ? "session" : "form",
        settings: Object.keys(settings).length,
        namedBy,
        via: "tape",
      };
    }
  return Object.freeze({ links: Object.freeze(links), notLinked: Object.freeze(notLinked) });
}

export async function generateMisconceptionLinks() {
  const built = buildMisconceptionLinks();
  await mkdir(resolve(ROOT, "src/generated"), { recursive: true });
  await writeFile(
    resolve(ROOT, "src/generated/misconception-links.json"),
    `${JSON.stringify(built, null, 2)}\n`,
  );
  return {
    linked: Object.keys(built.links).length,
    notLinked: Object.keys(built.notLinked).length,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await generateMisconceptionLinks()));
}
