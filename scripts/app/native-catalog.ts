/**
 * What the app's native navigation screens show (App plan §8.1, §8.2): the library, each paper's
 * outline, the Discover routes and the lab catalogue. Every word comes from the site's own
 * records and registries, the same ones its pages render, so the app authors none:
 *
 * - papers, in the order Annalen received them (ROUTE_INDEX), with their titles, German titles,
 *   descriptions and sections from content/papers/<slug>.json;
 * - Discover routes from src/discovery/routeIndex.ts: name, German title, blurb, and each step's
 *   label as the journey page prints it;
 * - registered instruments from src/experiments/catalogue.ts, named by labName(), grouped by the
 *   paper their id belongs to.
 *
 * export-edition.ts writes this beside the manifest, pins its SHA-256, and refuses the export when
 * any route here is not a page of the edition, so a native row never opens a missing page.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROUTE_INDEX } from "../../src/discovery/routeIndex.ts";
import { CATALOGUE_IDS, CATALOGUE_STATUS } from "../../src/experiments/catalogue.ts";
import { labName } from "../../src/reader/actions/labNames.ts";

export const NATIVE_CATALOG_FILE = "native-catalog.json";
export const NATIVE_CATALOG_SCHEMA = "annus-mirabilis-native-catalog.v1";

export interface NativeCatalogSection {
  readonly id: string;
  readonly title: string;
  readonly route: string;
  readonly anchor: string;
}

export interface NativeCatalogPaper {
  readonly slug: string;
  /** The short name /papers/ and the home page use ("Brownian motion"). */
  readonly name: string;
  readonly title: string;
  readonly germanTitle: string;
  readonly description: string;
  readonly route: string;
  readonly sections: readonly NativeCatalogSection[];
}

export interface NativeCatalogRoute {
  readonly slug: string;
  readonly name: string;
  readonly germanTitle: string;
  readonly blurb: string;
  readonly steps: readonly string[];
  readonly route: string;
}

export interface NativeCatalogLabGroup {
  /** The paper the group's instruments belong to. */
  readonly paper: string;
  readonly name: string;
  readonly instruments: readonly {
    readonly id: string;
    readonly name: string;
    readonly route: string;
  }[];
}

export interface NativeCatalog {
  readonly schemaVersion: typeof NATIVE_CATALOG_SCHEMA;
  readonly papers: readonly NativeCatalogPaper[];
  readonly discover: readonly NativeCatalogRoute[];
  readonly labs: readonly NativeCatalogLabGroup[];
}

interface PaperRecord {
  readonly title: string;
  readonly germanTitle: string;
  readonly description: string;
  readonly sections: readonly { readonly id: string; readonly title: string }[];
}

/**
 * Which paper an instrument id belongs to. The shelf instruments are the optical comparisons of
 * the special-relativity route (the site's instruments page links their group to
 * /discover/special-relativity/). An id with none of these prefixes belongs to no paper.
 */
const LAB_PREFIXES: readonly (readonly [prefix: string, paper: string])[] = [
  ["lq-", "light-quanta"],
  ["bm-", "brownian-motion"],
  ["sr-", "special-relativity"],
  ["shelf-", "special-relativity"],
  ["me-", "mass-energy"],
];

export function buildNativeCatalog(contentDir: string): NativeCatalog {
  const papers = ROUTE_INDEX.map((entry): NativeCatalogPaper => {
    const record = JSON.parse(
      readFileSync(join(contentDir, "papers", `${entry.slug}.json`), "utf8"),
    ) as PaperRecord;
    const route = `/papers/${entry.slug}/`;
    return {
      slug: entry.slug,
      name: entry.name,
      title: record.title,
      germanTitle: record.germanTitle,
      description: record.description,
      route,
      sections: record.sections.map((section) => ({
        id: section.id,
        title: section.title,
        route,
        anchor: section.id,
      })),
    };
  });
  const discover = ROUTE_INDEX.map(
    (entry): NativeCatalogRoute => ({
      slug: entry.slug,
      name: entry.name,
      germanTitle: entry.germanTitle,
      blurb: entry.blurb,
      steps: [...entry.steps],
      route: `/discover/${entry.slug}/`,
    }),
  );
  const registered = CATALOGUE_IDS.filter((id) => CATALOGUE_STATUS[id] === "registered");
  const labs = ROUTE_INDEX.map(
    (entry): NativeCatalogLabGroup => ({
      paper: entry.slug,
      name: entry.name,
      instruments: registered
        .filter((id) =>
          LAB_PREFIXES.some(([prefix, paper]) => paper === entry.slug && id.startsWith(prefix)),
        )
        .map((id) => ({ id, name: labName(id), route: `/lab/${id}/` })),
    }),
  ).filter((group) => group.instruments.length > 0);
  return { schemaVersion: NATIVE_CATALOG_SCHEMA, papers, discover, labs };
}

/** Registered instruments no paper claims; the catalogue leaves them out, and says so here. */
export function unaffiliatedInstruments(): readonly string[] {
  return CATALOGUE_IDS.filter(
    (id) =>
      CATALOGUE_STATUS[id] === "registered" &&
      !LAB_PREFIXES.some(([prefix]) => id.startsWith(prefix)),
  );
}

/** Every page the catalogue opens, each once. */
export function nativeCatalogRoutes(catalog: NativeCatalog): readonly string[] {
  return [
    ...new Set([
      ...catalog.papers.flatMap((paper) => [paper.route, ...paper.sections.map((s) => s.route)]),
      ...catalog.discover.map((route) => route.route),
      ...catalog.labs.flatMap((group) => group.instruments.map((instrument) => instrument.route)),
    ]),
  ];
}
