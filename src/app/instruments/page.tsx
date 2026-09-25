import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { Fragment } from "react";
import { CATALOGUE_IDS, CATALOGUE_STATUS, type CatalogueId } from "../../experiments/catalogue.ts";
import { labName } from "../../reader/actions/labNames.ts";
import "./instruments.css";

export const metadata: Metadata = {
  title: "Instruments",
  description:
    "Every instrument in the edition, grouped by the paper whose argument it serves, each named by the question it answers.",
};

/**
 * The destination for the "Instruments" nav item (TanElk's nav call, 2026-09-22).
 *
 * The nav item pointed at /lab/bm-06/, one Brownian instrument out of thirty-four, chosen by
 * nobody for a reason a reader could see. The constraint on the replacement was that it answer
 * "show me the instruments" on arrival rather than one click later, which /papers/ does not.
 *
 * WHY THIS IS NOT THE FLAT CATALOGUE THE DOCTRINE DECLINES. AGENTS.md organises the edition
 * around an argument, and a list of thirty-four siblings in one column is the shape it rejects
 * and the shape that made the old homepage unreadable. Here the grouping IS the argument: an
 * instrument appears under the paper whose claim it interrogates, and each is named by the
 * question it answers rather than by its id. A reader who wants the instruments for one paper
 * sees them together; a reader who wants one instrument reads a sentence, not "sr-09".
 *
 * THE LIST IS DERIVED, NOT TRANSCRIBED. Ids and readiness come from src/experiments/catalogue.ts
 * and names from labNames.ts, so an instrument added to the catalogue appears here without anyone
 * remembering to add it, and one whose name is missing degrades to its id rather than vanishing.
 * Measured on build h2Dwz8akGXU682TfDJXOY: 34 registered ids, and all 34 have a route, a built
 * page and a name.
 *
 * WHAT THIS PAGE FIXES BESIDES THE NAV. Five registered instruments were linked from no paper
 * page at all - bm-02, bm-03, bm-04, bm-08 and light-thread - so bm-02, bm-03 and bm-04 were
 * reachable only by typing the URL. They have a door here. That is not the same as belonging to
 * their paper's reading path, and the difference is recorded on am-bzsk rather than papered over:
 * the paper-page links are passage-attached, and attaching these four needs a decision about
 * which passage each serves, which is content work rather than layout.
 */

/* Each paper group uses the name /papers/ and the home plates use (firstPages.ts). Two of them
   were English titles, "On the electrodynamics of moving bodies" and "Does inertia depend on energy
   content?", so a paper had one name here and another a click away. */
const PAPER_GROUPS: readonly {
  readonly prefix: string;
  readonly title: string;
  readonly href: string;
  readonly blurb: string;
}[] = [
  {
    prefix: "lq-",
    title: "Light quanta",
    href: "/papers/light-quanta/",
    blurb:
      "Whether light gives up its energy in whole pieces, and what the wave description keeps when it does.",
  },
  {
    prefix: "bm-",
    title: "Brownian motion",
    href: "/papers/brownian-motion/",
    blurb:
      "Whether a visible speck in still water is being shoved by molecules, and how far it should travel if it is.",
  },
  {
    prefix: "sr-",
    title: "Special relativity",
    href: "/papers/special-relativity/",
    blurb:
      "What it takes to set two distant clocks, and what follows once you say precisely what that means.",
  },
  {
    prefix: "shelf-",
    title: "Before the coordinate map: optical model comparisons",
    href: "/discover/special-relativity/",
    blurb:
      "Compare arm times, moving-water drag and wave equations. These explanatory previews use modern calibration; historical datasets and strict 1904 modes remain in preparation.",
  },
  {
    prefix: "me-",
    title: "Mass and energy",
    href: "/papers/mass-energy/",
    blurb: "What survives when one body's energy is written down twice and subtracted.",
  },
];

function registeredWithPrefix(prefix: string): readonly CatalogueId[] {
  return CATALOGUE_IDS.filter(
    (id) => CATALOGUE_STATUS[id] === "registered" && id.startsWith(prefix),
  );
}

/** Registered instruments that carry no paper prefix, so they belong to no single paper. */
function unaffiliated(): readonly CatalogueId[] {
  const prefixes = PAPER_GROUPS.map((g) => g.prefix);
  return CATALOGUE_IDS.filter(
    (id) => CATALOGUE_STATUS[id] === "registered" && !prefixes.some((p) => id.startsWith(p)),
  );
}

/**
 * A picture of the instrument's worked default, when one has been taken. The pictures are written by
 * scripts/generate-instrument-thumbnails.ts from a built page, so an instrument added since the last
 * run has none, and its entry is the question alone rather than a broken image. The generator's
 * manifest names the ids it pictured; a file it did not list, such as a results table photographed
 * before tables were refused, is not shown even though it is still on disk.
 */
const MANIFEST = join(process.cwd(), "public/figures/instruments/manifest.json");

/** One stretch of a label as the laboratory sets it: plain, superscript or subscript. */
type Run = { readonly t: string; readonly s?: "sup" | "sub" };
/** The words the generator read from a table-answering instrument: compared columns, row labels. */
type TableWords = {
  readonly head: readonly (readonly Run[])[];
  readonly rows: readonly (readonly Run[])[];
};

function isLabel(value: unknown): value is readonly Run[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (run) =>
        typeof run === "object" &&
        run !== null &&
        typeof (run as Run).t === "string" &&
        ((run as Run).s === undefined || (run as Run).s === "sup" || (run as Run).s === "sub"),
    )
  );
}

const manifest = existsSync(MANIFEST)
  ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as {
      pictures: Record<string, string>;
      tables?: Record<string, { head?: unknown; rows?: unknown }>;
    })
  : null;
const pictured: ReadonlySet<string> | null = manifest
  ? new Set(Object.keys(manifest.pictures))
  : null;

/**
 * The words for a table instrument's plate, when the generator read them. A label that is not a
 * list of runs is dropped rather than shown half-formed, and an entry left with no rows is none.
 */
function tableWords(id: CatalogueId): TableWords | undefined {
  const entry = manifest?.tables?.[id];
  if (!entry) return undefined;
  const rows = Array.isArray(entry.rows) ? entry.rows.filter(isLabel) : [];
  const head = Array.isArray(entry.head) ? entry.head.filter(isLabel) : [];
  return rows.length > 0 ? { head, rows } : undefined;
}

function specimenPicture(id: CatalogueId): string | undefined {
  if (pictured && !pictured.has(id)) return undefined;
  const file = `/figures/instruments/${id}.webp`;
  return existsSync(join(process.cwd(), "public", file)) ? file : undefined;
}

/** An instrument still in preparation may already have a preview page under src/app/lab/. */
function hasPreviewPage(id: CatalogueId): boolean {
  return existsSync(join(process.cwd(), "src/app/lab", id, "page.tsx"));
}

/**
 * Each instrument as a specimen: a small plate of what it shows at its worked default, captioned by
 * the question it answers. The plate is the same mounted-page device as the printed first pages on
 * the home page, so the catalogue reads as part of the edition rather than a list of links. The
 * question is the link's name; the picture carries no alt text of its own because the question
 * beside it already names what it shows.
 */
/** A label with its superscripts and subscripts, keyed by content because the runs never move. */
function Label({ runs }: { runs: readonly Run[] }) {
  return (
    <>
      {runs.map((run) =>
        run.s === "sup" ? (
          <sup key={`sup:${run.t}`}>{run.t}</sup>
        ) : run.s === "sub" ? (
          <sub key={`sub:${run.t}`}>{run.t}</sub>
        ) : (
          <Fragment key={`t:${run.t}`}>{run.t}</Fragment>
        ),
      )}
    </>
  );
}

/** Names for the value cells of a row, so each has a stable key: one per compared column. */
const VALUE_CELLS = ["first", "second", "third"] as const;
/** The plate's grid, by how many value columns it draws; written out whole so each class is found. */
const COLUMNS_CLASS = ["plate-columns-1", "plate-columns-2", "plate-columns-3"] as const;

/**
 * The longest word a column name may hold when three columns share a plate. A third of a desktop
 * plate is about 57px, and at the smallest type size "Fresnel" fits there and "Coordinate" does not
 * (measured on /instruments/ at 1024 and 1440). Two columns have room for "contraction".
 */
const LONGEST_WORD_IN_THREE = 8;

function fitsThree(names: readonly (readonly Run[])[]): boolean {
  return names.every((name) =>
    name
      .map((run) => run.t)
      .join("")
      .split(/\s+/)
      .every((word) => word.length <= LONGEST_WORD_IN_THREE),
  );
}

/**
 * A table instrument's plate: its own words set as a small table. A table that compares two or
 * three named columns of values (no drag, full drag, Fresnel drag) shows them as the heading, when
 * the names fit; any other shows its rows alone. A value is a dotted rule, never a number: the
 * words were read from the live laboratory by the generator, and a number copied here would go
 * stale while its page moved on. The plate stays hidden from assistive technology, because the
 * question beside it is the link's name.
 */
function TablePlate({ words }: { words: TableWords }) {
  const n = words.head.length;
  const compared = n === 2 || (n === 3 && fitsThree(words.head)) ? words.head : [];
  const cells = VALUE_CELLS.slice(0, Math.max(compared.length, 1));
  // A label may take two lines, so a plate with a heading has room for three rows and one without
  // for four.
  const rows = words.rows.slice(0, compared.length > 0 ? 3 : 4);
  return (
    <span
      className={`instrument-plate instrument-plate-words ${COLUMNS_CLASS[cells.length - 1]}`}
      aria-hidden="true"
    >
      <span className="plate-table">
        {compared.length > 0 ? (
          <span className="plate-table-head">
            <span />
            {compared.map((name) => (
              <span key={name.map((run) => run.t).join("")}>
                <Label runs={name} />
              </span>
            ))}
          </span>
        ) : null}
        {rows.map((row) => (
          <span className="plate-table-row" key={row.map((run) => run.t).join("")}>
            <span className="plate-table-label">
              <Label runs={row} />
            </span>
            {cells.map((cell) => (
              <span className="plate-table-value" key={cell} />
            ))}
          </span>
        ))}
      </span>
    </span>
  );
}

function InstrumentList({ ids }: { ids: readonly CatalogueId[] }) {
  return (
    <ul className="instrument-specimens">
      {ids.map((id) => {
        const picture = specimenPicture(id);
        const words = picture ? undefined : tableWords(id);
        return (
          <li key={id} className="instrument-specimen">
            <a href={`/lab/${id}/`}>
              {picture ? (
                <span className="instrument-plate">
                  <img
                    src={picture}
                    alt=""
                    width={640}
                    height={400}
                    loading="lazy"
                    decoding="async"
                  />
                </span>
              ) : words ? (
                <TablePlate words={words} />
              ) : (
                // Neither a photograph nor words read by the generator (an instrument added since
                // its last run): the plate is a drawn table in the same frame, so the entries keep
                // one rhythm down the page, and it says so, because the ruled box alone read as a
                // picture that failed to load.
                <span className="instrument-plate instrument-plate-table" aria-hidden="true">
                  <span className="instrument-plate-note">Answers in a table</span>
                </span>
              )}
              <span className="instrument-question">{labName(id)}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export default function InstrumentsIndex() {
  const inPreparation = CATALOGUE_IDS.filter((id) => CATALOGUE_STATUS[id] !== "registered");
  const loose = unaffiliated();

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Operate the argument</p>
        <h1>Instruments</h1>
        {/* One sentence, where two paragraphs stood: on a 390px phone the first of 37
            instruments sat at y=855, below the first screen (BUILD 17). That they are grouped by
            paper and named by their question is what the headings and rows below already show. */}
        <p className="lead">
          Each answers one question: you set the conditions, it computes, and it says where its
          number came from. Each is a model, labelled as one, never a recording of nature.
        </p>
      </section>

      {PAPER_GROUPS.map((group) => {
        const ids = registeredWithPrefix(group.prefix);
        if (ids.length === 0) return null;
        return (
          <section className="instrument-group" key={group.prefix}>
            <h2>
              <a href={group.href}>{group.title}</a>
            </h2>
            <p>{group.blurb}</p>
            <InstrumentList ids={ids} />
          </section>
        );
      })}

      {loose.length > 0 ? (
        <section className="instrument-group">
          <h2>Across more than one paper</h2>
          <p>
            These reach across the papers rather than serving one argument, so a reader arriving
            from any of them is in the right place.
          </p>
          <InstrumentList ids={loose} />
        </section>
      ) : null}

      <section className="reading page-flush">
        <h2>In preparation</h2>
        {/* Named in words, and linked where a preview page already exists, so the gap between
            what the edition plans and what it has finished stays visible. "In preparation" is the
            catalogue's own status: the model has no admitted owner yet, which is a different
            question from whether a page renders (avogadro-lab has one). */}
        <p>
          Still being finished, and listed so the gap between what the edition plans and what it has
          finished stays visible:
        </p>
        <ul>
          {inPreparation.map((id) => (
            <li key={id}>
              {hasPreviewPage(id) ? <a href={`/lab/${id}/`}>{labName(id)}</a> : labName(id)}{" "}
              {hasPreviewPage(id) ? "(a preview page exists)" : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
