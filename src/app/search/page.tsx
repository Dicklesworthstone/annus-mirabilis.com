import type { Metadata } from "next";
import { loadFirstPages } from "../../components/home/firstPages.ts";
import { type SearchType, searchResultHref } from "../../search/core.ts";
import { parseSearchShard } from "../../search/protocol.ts";
import { SearchPageField } from "../../search/SearchPageField.tsx";
import { readCurrentSearchShard, readSearchManifest } from "../../search/server.ts";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Every passage, argument, equation, instrument and foundation the edition has indexed, listed in full so a browser's own find works on it.",
};

/**
 * THE PAGE A READER REACHES WHEN SEARCH CANNOT RUN (REDIRECT chrome sweep, 2026-09-22).
 *
 * The live search is a dialog: press Ctrl/Cmd K, or activate the header link, and
 * src/search/CommandPalette.ts opens over the page. That path is good and is not touched here.
 * Measured on the live palette: before typing it says "N entries available. Try "clocks
 * disagree", "Avogadro", or "mean square"", and on no match it says "Nothing matches. Try fewer
 * words, or a single symbol." Both name a next action.
 *
 * THE QUESTION THIS PAGE ANSWERS is the one nobody had answered: what a reader gets when that
 * script does not run. The header link's fallback pointed at /papers/, so a reader without
 * JavaScript who clicked a control labelled "Search" arrived at a catalogue of five papers with
 * nothing to search. The word on the control was a promise the fallback did not keep. It is the
 * same defect as the notebook button fixed in efeebd0d, one level quieter.
 *
 * A static site cannot run a query without a script. What it CAN do is put the whole index on one
 * page, which makes the browser's own find work on it - and AGENTS.md already treats that as a
 * first-class route: "Browser text search must find every section, so paragraphs are never
 * virtualized out of the DOM." So this is not a consolation prize; it is the same principle
 * applied to the index itself.
 *
 * SIZE, measured before committing to a single page: the index holds 191 documents across seven
 * types (argument 42, result 42, instrument 34, foundation 27, section 24, equation 18, paper 4).
 * That is a page a reader can scroll and a browser can find in. If the index grows past a few
 * hundred, this wants splitting by type rather than quietly becoming a wall.
 *
 * THE LIST IS THE INDEX ITSELF, not a second description of it. It is read from
 * generated/search/ through src/search/server.ts, which verifies every shard against the
 * manifest's sha256 and refuses a shard whose bytes or count disagree. So this page cannot drift
 * from what the palette searches: they read the same bytes.
 */

const TYPE_LABELS: Readonly<Record<string, string>> = {
  paper: "Papers",
  section: "Sections",
  argument: "Arguments",
  equation: "Equations",
  instrument: "Laboratories",
  foundation: "Foundations",
  result: "Argument synopses",
  "sentence-de": "German passages",
  "sentence-en": "English passages",
  glossary: "Notation and terms",
};

/** The order sections appear in. Types absent from the index are skipped, never rendered empty. */
const TYPE_ORDER: readonly string[] = [
  "paper",
  "section",
  "argument",
  "result",
  "equation",
  "instrument",
  "foundation",
  "sentence-de",
  "sentence-en",
  "glossary",
];

type Entry = Readonly<{
  id: string;
  type: SearchType;
  title: string;
  route: string;
  anchor: string;
  /** The palette's own link for this document (searchResultHref), view included. */
  href: string;
  paper: string;
}>;

async function readIndex(): Promise<readonly Entry[]> {
  // The manifest, not a directory listing: it carries each shard's expected document count, and
  // parseSearchShard refuses a shard whose count disagrees. Reading the directory instead would
  // have meant inventing a count, which is the one number that must not be guessed here.
  const { manifest } = await readSearchManifest();
  const out: Entry[] = [];
  for (const descriptor of manifest.shards) {
    const name = descriptor.path.slice("/search/".length);
    const text = await readCurrentSearchShard(name);
    if (text === null) continue;
    const parsed = parseSearchShard(JSON.parse(text), descriptor.documents);
    for (const doc of parsed.documents) {
      out.push({
        id: doc.id,
        type: doc.type,
        title: doc.title,
        route: doc.route,
        anchor: doc.anchor,
        href: searchResultHref(doc),
        // `paper`, not `scopeLabel`. Measured on the 191 documents: scopeLabel runs 41 to 111
        // characters, median 95, against a median title of 35. Printed beside every entry it
        // would be three times the length of the thing it qualifies and the list would read as a
        // wall of repeated sentences. `paper` is one of five short slugs and is the fact a reader
        // scanning an index actually wants.
        paper: doc.paper,
      });
    }
  }
  // Stable, readable order within a type. The shards are content-addressed, so their own order is
  // a hashing artefact and would reshuffle a reader's page for no reason on an unrelated edit.
  // Numeric, so "§2" comes before "§10". A paper's sections go in the paper's own order, by their
  // anchor (s0 is the unnumbered introduction): by title, "Introduction · ..." sorted after "§10".
  // One key for every pair (paper, then section number, then title) keeps the comparison
  // consistent; entries that are not sections compare equal on the middle key.
  const sectionNumber = (e: Entry) =>
    e.type === "section" ? Number(/^s(\d+)$/.exec(e.anchor)?.[1] ?? Number.POSITIVE_INFINITY) : 0;
  return out.sort(
    (a, b) =>
      a.paper.localeCompare(b.paper) ||
      sectionNumber(a) - sectionNumber(b) ||
      a.title.localeCompare(b.title, "en", { numeric: true }),
  );
}

/**
 * Within each kind, entries are grouped under the paper they belong to, in the order the journal
 * received the papers, and the paper is named once above its group. Each entry used to carry its
 * paper as a monospace slug ("brownian motion") under the link, 191 times, and the one
 * alphabetical list put "§1 · classical energy allocation" (light quanta) beside "§1 ·
 * operational simultaneity" (relativity) and "§10" before "§2". A kind with one entry per paper,
 * the papers themselves, is listed without the groups.
 */
function groupByPaper(list: readonly Entry[], titles: ReadonlyMap<string, string>) {
  const order = [...titles.keys(), "molecular-dimensions", "cross-paper"];
  const groups = new Map<string, Entry[]>();
  for (const entry of list) {
    const key = entry.paper || "cross-paper";
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  const rank = (key: string) => {
    const i = order.indexOf(key);
    return i === -1 ? order.length : i;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([key, entries]) => ({
      key,
      label:
        titles.get(key) ??
        (key === "cross-paper"
          ? "Across the papers"
          : key === "molecular-dimensions"
            ? "Molecular dimensions (the dissertation)"
            : key.replaceAll("-", " ")),
      entries,
    }));
}

export default async function SearchIndexPage() {
  const entries = await readIndex();
  const titles = new Map(loadFirstPages().map((p) => [p.slug, p.title]));
  // Each entry links where the palette sends it. This page used to build route#anchor itself and
  // drop the document's view, so an argument's synopsis, which opens the results view
  // (?view=results), linked to the reading view like the argument, and the two looked identical.
  const href = (entry: Entry) => entry.href;
  // An entry that repeats an earlier one exactly, the same title leading to the same place, is
  // listed once, under the first kind in TYPE_ORDER. With each entry on its real link this drops
  // nothing today: a synopsis shares its argument's title but opens the results view.
  const seen = new Set<string>();
  const byType = new Map<string, Entry[]>();
  for (const type of TYPE_ORDER) {
    for (const entry of entries) {
      const key = `${href(entry)}\u0000${entry.title}`;
      if (entry.type !== type || seen.has(key)) continue;
      seen.add(key);
      byType.set(type, [...(byType.get(type) ?? []), entry]);
    }
  }
  const sections = TYPE_ORDER.filter((type) => (byType.get(type)?.length ?? 0) > 0);

  return (
    <>
      <section className="hero">
        <p className="eyebrow">The whole index, on one page</p>
        <h1>Search</h1>
        {/* The field comes first because it is what a reader looks for on a page called Search.
            The lead used to open with "Press Ctrl K", which a phone cannot do; the shortcut now
            sits inside the field, shown only where there is a keyboard to press it on. */}
        <SearchPageField />
        <p className="lead">
          Every entry in the edition&rsquo;s index is listed below, once each: {seen.size} of them,
          each linking to the passage, argument, equation, instrument or lesson it names. Your
          browser&rsquo;s own find reaches every one of them.
        </p>
      </section>

      {sections.map((type) => {
        const list = byType.get(type) ?? [];
        const groups = groupByPaper(list, titles);
        const flat = groups.every((g) => g.entries.length === 1);
        return (
          <section className="search-index-kind" key={type} aria-labelledby={`kind-${type}`}>
            <h2 id={`kind-${type}`}>
              {TYPE_LABELS[type] ?? type} <span className="search-index-count">{list.length}</span>
            </h2>
            {flat ? (
              <ul className="search-index-list">
                {groups
                  .flatMap((g) => g.entries)
                  .map((entry) => (
                    <li key={entry.id}>
                      <a href={href(entry)}>{entry.title}</a>
                    </li>
                  ))}
              </ul>
            ) : (
              <div className="search-index-groups">
                {groups.map((group) => (
                  <div className="search-index-group" key={group.key}>
                    <h3>{group.label}</h3>
                    <ul className="search-index-list">
                      {group.entries.map((entry) => (
                        <li key={entry.id}>
                          <a href={href(entry)}>{entry.title}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
