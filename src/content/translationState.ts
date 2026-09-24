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
      for (const file of readdirSync(join(dir, slug))) {
        if (!file.endsWith(".yaml")) continue;
        const record = yaml.load(readFileSync(join(dir, slug, file), "utf8")) as {
          kind?: unknown;
          reviewState?: unknown;
        } | null;
        if (record?.kind !== "translation-unit") continue;
        units += 1;
        if (record.reviewState === "machine-draft") machineDrafts += 1;
        if (record.reviewState === "reviewed") reviewed += 1;
      }
      return units > 0 ? [{ slug, units, machineDrafts, reviewed }] : [];
    });
}

const NUMBER_WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];
const inWords = (n: number) => NUMBER_WORDS[n] ?? String(n);

/**
 * A paper's short title as it reads mid-sentence: "Mass and energy" becomes "mass and energy", and
 * a proper noun keeps its capital, so "Brownian motion" stays "Brownian motion".
 */
export function nameInSentence(title: string): string {
  return /^Brownian\b/.test(title) ? title : title.charAt(0).toLowerCase() + title.slice(1);
}

/**
 * One sentence on the translation's state, for any page that mentions it. `names` gives each
 * paper's reader-facing name by slug.
 */
export function translationSentence(
  state: readonly PaperTranslation[],
  names: ReadonlyMap<string, string>,
): string {
  if (state.length === 0) return "The English translation has not been started.";
  const parts = state.map((paper) => {
    const name = nameInSentence(names.get(paper.slug) ?? paper.slug);
    const drafted =
      paper.machineDrafts === paper.units
        ? "all drafted by a machine"
        : `${inWords(paper.machineDrafts)} of them drafted by a machine`;
    const review =
      paper.reviewed === 0 ? "none reviewed yet" : `${inWords(paper.reviewed)} reviewed`;
    return `the ${name} paper: ${paper.units} passages, ${drafted}, and ${review}`;
  });
  return `The English translation has begun with ${parts.join("; and with ")}.`;
}
