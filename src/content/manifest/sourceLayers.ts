/**
 * THE FOUR SOURCE LAYERS, READ FROM THE TREE (am-4cpx).
 *
 * AGENTS.md names the source manifest the completeness authority: "The source manifest, not a
 * hand-maintained percentage, determines completeness." Until this module existed the report took
 * its layers from `getAbsentSourceLayers()`, which returns `absent` unconditionally and was the
 * DEFAULT argument of the generator, so the authority printed `transcription-not-started` while the
 * tree held 456 source blocks, 821 translation units and 542 gloss units. It would have printed the
 * same zeros on a finished edition, which is the failure this repository's doctrine is built
 * around: a result computed over a population nothing looked at reads exactly like a clean result.
 *
 * So every layer here is DERIVED, and each derivation names the directory it counted:
 *
 * - LEDGER, from `public/papers/transcripts/`. A `<key>-reviewed.txt` is a reviewed ledger; a
 *   `<key>-machine-draft.txt` is a DRAFT and says so as its own state. Those are different facts,
 *   and reporting a draft as "not started" loses the one that took the work. Its count is the pages
 *   the file marks, against the paper's printed page count.
 * - TRANSCRIPTION, from `content/source-blocks/<paper>/`: the files that are source blocks, which
 *   is the ones carrying `kind:`. A directory also holds a ledger allowlist and an id snapshot, and
 *   counting those would inflate the layer.
 * - TRANSLATION, from `content/translation-units/<paper>/`, with its denominator the source blocks
 *   it covers: a unit names sentence ids, so a block counts as covered when a unit names it or one
 *   of its sentence spans.
 * - GLOSS, from `content/gloss-units/<paper>/`, against the sentence spans of the same blocks,
 *   which is the population a gloss can cover.
 *
 * A STATUS IS NEVER UPGRADED. Each layer's status is read from the records' own fields, and where
 * they disagree the weakest wins: one draft among reviewed units makes the layer a draft. The
 * translation layer's note carries the fact the status cannot: the units are reviewed by agents
 * under D-2026-09-25-agent-reviewed-translations, and no person has reviewed any of it.
 *
 * Reads content/ and public/, so it is for scripts and tests, never for a page.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PaperSourceLayers, SourceLayerState } from "./types.ts";

/** A source block file, as opposed to the allowlist and the id snapshot beside it. */
const isBlock = (text: string): boolean => /^kind:/m.test(text);

function yamlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".yaml"))
    .sort();
}

/**
 * Every source block of a paper: the ids a translation unit could name it by, and how many sentence
 * spans it carries. The two are counted separately on purpose. A single-sentence block gives its
 * span the block's own id (closing-dateline), so a set of ids loses those spans: counting the set
 * gave mass-energy 28 spans where the files hold 34, and the report then printed "34 of 28" gloss
 * units, a denominator smaller than its numerator.
 */
export function sourceBlockSpans(
  root: string,
  paper: string,
): Map<string, { ids: Set<string>; spans: number }> {
  const dir = join(root, "content", "source-blocks", paper);
  const out = new Map<string, { ids: Set<string>; spans: number }>();
  for (const file of yamlFiles(dir)) {
    const text = readFileSync(join(dir, file), "utf8");
    if (!isBlock(text)) continue;
    const id = file.slice(0, -".yaml".length);
    const ids = new Set<string>([id]);
    let spans = 0;
    const section = text.split("sentenceSpans:")[1];
    if (section)
      for (const m of section.matchAll(/^\s+- id: "([\w.-]+)"/gm)) {
        ids.add(m[1] as string);
        spans++;
      }
    out.set(id, { ids, spans });
  }
  return out;
}

/** Every source id a paper's translation units name, whether a block's or a sentence's. */
function translatedIds(root: string, paper: string): { units: number; named: Set<string> } {
  const dir = join(root, "content", "translation-units", paper);
  const named = new Set<string>();
  const files = yamlFiles(dir);
  for (const file of files) {
    const text = readFileSync(join(dir, file), "utf8");
    const refs = text.split("sourceRefs:")[1]?.split("\ninlines:")[0] ?? "";
    for (const m of refs.matchAll(/id: "([\w.-]+)"/g)) named.add(m[1] as string);
  }
  return { units: files.length, named };
}

/** The weakest status among the records, since a layer is only as reviewed as its least unit. */
function weakest(states: readonly string[]): "draft" | "proofed" | "reviewed" {
  if (states.length === 0) return "draft";
  if (states.some((s) => s !== "reviewed" && s !== "accepted")) return "draft";
  return "reviewed";
}

function absent(
  layer: SourceLayerState["layer"],
  reason: string,
): Extract<SourceLayerState, { state: "absent" }> {
  return { layer, state: "absent", reason, available: false, unitCount: 0 };
}

/** The ledger: a reviewed transcription if one exists, else the machine draft, named as a draft. */
function ledgerLayer(root: string, document: string, pageCount: number): SourceLayerState {
  const dir = join(root, "public", "papers", "transcripts");
  const reviewed = join(dir, `${document}-reviewed.txt`);
  const draft = join(dir, `${document}-machine-draft.txt`);
  const path = existsSync(reviewed) ? reviewed : existsSync(draft) ? draft : undefined;
  if (!path)
    return absent(
      "ledger",
      `no ${document}-reviewed.txt and no ${document}-machine-draft.txt in public/papers/transcripts`,
    );
  const text = readFileSync(path, "utf8");
  const pages = new Set(
    [...text.matchAll(/^--- [A-Z ]*TRANSCRIPTION PAGE (\d+) OF \d+ ---$/gm)].map((m) => m[1]),
  );
  const isReviewed = path === reviewed;
  return {
    layer: "ledger",
    state: "present",
    status: isReviewed ? "reviewed" : "draft",
    available: true,
    unitCount: pages.size,
    of: pageCount,
    population: "printed pages",
    ...(isReviewed
      ? {}
      : {
          note: "A machine draft with hand correction. No person has reviewed it, so it is a draft and not a reviewed ledger.",
        }),
  };
}

/**
 * Every layer of one paper, derived. `document` is the bibliographic key the ledger is filed under
 * (ap-17-891) and `pageCount` the manifest's printed page count, which is the ledger's denominator.
 */
export function readSourceLayers(
  root: string,
  paper: string,
  document: string,
  pageCount: number,
): PaperSourceLayers {
  const blocks = sourceBlockSpans(root, paper);
  const blockDir = join("content", "source-blocks", paper);

  const transcriptionStates: string[] = [];
  let spanCount = 0;
  for (const [id, block] of blocks) {
    spanCount += block.spans;
    const text = readFileSync(join(root, blockDir, `${id}.yaml`), "utf8");
    transcriptionStates.push(/^\s+transcription: "([\w-]+)"/m.exec(text)?.[1] ?? "draft");
  }

  const transcription: SourceLayerState =
    blocks.size === 0
      ? absent("transcription", `no source block in ${blockDir}`)
      : {
          layer: "transcription",
          state: "present",
          status: weakest(transcriptionStates),
          available: true,
          unitCount: blocks.size,
          of: blocks.size,
          population: "source blocks in the tree",
        };

  const { units: translationUnits, named } = translatedIds(root, paper);
  const covered = [...blocks.values()].filter((b) => [...b.ids].some((id) => named.has(id))).length;
  const translationStates = yamlFiles(join(root, "content", "translation-units", paper)).map(
    (file) =>
      /^reviewState: "([\w-]+)"/m.exec(
        readFileSync(join(root, "content", "translation-units", paper, file), "utf8"),
      )?.[1] ?? "draft",
  );
  const translation: SourceLayerState =
    translationUnits === 0
      ? absent("translation", `no translation unit in content/translation-units/${paper}`)
      : {
          layer: "translation",
          state: "present",
          status: weakest(translationStates),
          available: true,
          unitCount: covered,
          of: blocks.size,
          population: `source blocks covered by one of ${translationUnits} translation units`,
          note: "Checked by AI agents in two rounds under D-2026-09-25-agent-reviewed-translations. No person has reviewed any of it.",
        };

  const glossDir = join(root, "content", "gloss-units", paper);
  const glossFiles = yamlFiles(glossDir);
  const glossStates = glossFiles.map(
    (file) =>
      /^reviewState: "([\w-]+)"/m.exec(readFileSync(join(glossDir, file), "utf8"))?.[1] ?? "draft",
  );
  const gloss: SourceLayerState =
    glossFiles.length === 0
      ? absent("gloss", `no gloss unit in content/gloss-units/${paper}`)
      : {
          layer: "gloss",
          state: "present",
          status: weakest(glossStates),
          available: true,
          unitCount: glossFiles.length,
          of: spanCount,
          population: "sentence spans of the paper's source blocks",
        };

  return { ledger: ledgerLayer(root, document, pageCount), transcription, translation, gloss };
}
