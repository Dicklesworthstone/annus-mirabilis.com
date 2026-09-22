import type { Metadata } from "next";
import type { SearchType } from "../../search/core.ts";
import { parseSearchShard } from "../../search/protocol.ts";
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
 * disagree", "BM-06", or "mean square"", and on no match it says "No matching entries in this
 * build. Try fewer words, a symbol, or a laboratory ID." Both name a next action.
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
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

export default async function SearchIndexPage() {
  const entries = await readIndex();
  const byType = new Map<string, Entry[]>();
  for (const entry of entries) {
    const list = byType.get(entry.type) ?? [];
    list.push(entry);
    byType.set(entry.type, list);
  }
  const sections = TYPE_ORDER.filter((type) => (byType.get(type)?.length ?? 0) > 0);

  return (
    <>
      <section className="hero">
        <p className="eyebrow">The whole index, on one page</p>
        <h1>Search</h1>
        <p className="lead">
          Press <kbd>Ctrl</kbd> <kbd>K</kbd>, or <kbd>Cmd</kbd> <kbd>K</kbd> on a Mac, to search
          from anywhere in the edition. If that does not work, or you would rather not use it,
          everything the edition has indexed is listed below and your browser&rsquo;s own find will
          reach all of it.
        </p>
        <p>
          {entries.length} entries across {sections.length} kinds. Each one links to the passage,
          argument, equation, instrument or lesson it names.
        </p>
      </section>

      {sections.map((type) => {
        const list = byType.get(type) ?? [];
        return (
          <section className="instrument-group" key={type}>
            <h2>
              {TYPE_LABELS[type] ?? type} <span className="instrument-id">{list.length}</span>
            </h2>
            <ul className="instrument-list">
              {list.map((entry) => (
                <li key={entry.id}>
                  <a href={entry.anchor ? `${entry.route}#${entry.anchor}` : entry.route}>
                    {entry.title}
                  </a>
                  {entry.paper ? (
                    <span className="instrument-id">
                      {entry.paper === "cross-paper"
                        ? "across papers"
                        : entry.paper.replaceAll("-", " ")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
