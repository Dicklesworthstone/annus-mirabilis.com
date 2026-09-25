import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

/*
 * HOW FAR THE ENGLISH TRANSLATION HAS GOT, counted from the translation units themselves
 * (dispatch 150). Three pages said "The English translation has not been started" after 43
 * machine-drafted units of the mass-energy paper went live, because the sentence was typed and
 * nothing tied it to content/translation-units. Now it is counted at build time, so it changes when
 * the units do.
 */

export type PaperTranslation = Readonly<{
  slug: string;
  units: number;
  machineDrafts: number;
  reviewed: number;
  /** Units whose translator is an AI model, whatever their review state. */
  byModel?: number | undefined;
  /**
   * Reviewed units whose review is an `agentReview`: final under
   * D-2026-09-25-agent-reviewed-translations, checked by AI agents and by no person.
   */
  agentChecked?: number | undefined;
}>;

/** One entry per paper with at least one translation unit, in slug order. */
export function translationState(root: string): PaperTranslation[] {
  const dir = join(root, "content", "translation-units");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((slug) => statSync(join(dir, slug)).isDirectory())
    .sort()
    .flatMap((slug) => {
      let units = 0;
      let machineDrafts = 0;
      let reviewed = 0;
      let byModel = 0;
      let agentChecked = 0;
      for (const file of readdirSync(join(dir, slug))) {
        if (!file.endsWith(".yaml")) continue;
        const record = yaml.load(readFileSync(join(dir, slug, file), "utf8")) as {
          kind?: unknown;
          reviewState?: unknown;
          translator?: { kind?: unknown } | null;
          agentReview?: unknown;
        } | null;
        if (record?.kind !== "translation-unit") continue;
        units += 1;
        if (record.reviewState === "machine-draft") machineDrafts += 1;
        if (record.reviewState === "reviewed") reviewed += 1;
        if (record.translator?.kind === "model") byModel += 1;
        if (record.reviewState === "reviewed" && record.agentReview) agentChecked += 1;
      }
      return units > 0 ? [{ slug, units, machineDrafts, reviewed, byModel, agentChecked }] : [];
    });
}

/**
 * A paper's short title as it reads mid-sentence: "Mass and energy" becomes "mass and energy", and
 * a proper noun keeps its capital, so "Brownian motion" stays "Brownian motion".
 */
export function nameInSentence(title: string): string {
  return /^Brownian\b/.test(title) ? title : title.charAt(0).toLowerCase() + title.slice(1);
}

/**
 * One sentence on the translation, for any page that mentions it: which papers it covers, and which
 * it does not yet. `names` gives each paper's reader-facing name by slug, for every paper. It says
 * what the site contains and nothing of who drafted or checked it
 * (D-2026-09-25-no-review-status-banners): the units' records and the receipts keep that.
 */
export function translationSentence(
  state: readonly PaperTranslation[],
  names: ReadonlyMap<string, string>,
): string {
  const translated = state.filter((paper) => paper.units > 0);
  if (translated.length === 0) return "The English translation has not been started.";
  const name = (slug: string) => nameInSentence(names.get(slug) ?? slug);
  const listed = (items: readonly string[]) =>
    items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
  const papers = (n: number) => (n === 1 ? "paper" : "papers");
  // In the order `names` gives the papers (the journal's), not the slugs' alphabetical order.
  const has = new Set(translated.map((paper) => paper.slug));
  const order = [...names.keys(), ...[...has].filter((slug) => !names.has(slug))];
  const covered = order.filter((slug) => has.has(slug)).map(name);
  const missing = order.filter((slug) => !has.has(slug)).map(name);
  const sentence = `The English translation covers the ${listed(covered)} ${papers(covered.length)}`;
  return missing.length === 0
    ? `${sentence}.`
    : `${sentence}; the ${listed(missing)} ${papers(missing.length)} ${missing.length === 1 ? "has" : "have"} none yet.`;
}
