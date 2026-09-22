import type { Metadata } from "next";
import { CATALOGUE_IDS, CATALOGUE_STATUS, type CatalogueId } from "../../experiments/catalogue.ts";
import { labName } from "../../reader/actions/labNames.ts";

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
    title: "On the electrodynamics of moving bodies",
    href: "/papers/special-relativity/",
    blurb:
      "What it takes to set two distant clocks, and what follows once you say precisely what that means.",
  },
  {
    prefix: "me-",
    title: "Does inertia depend on energy content?",
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

function InstrumentList({ ids }: { ids: readonly CatalogueId[] }) {
  return (
    <ul className="instrument-list">
      {ids.map((id) => (
        <li key={id}>
          <a href={`/lab/${id}/`}>{labName(id)}</a>
          <span className="instrument-id">{id}</span>
        </li>
      ))}
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
        <p className="lead">
          An instrument answers one question with a response you can watch change. You set the
          conditions, it computes, and it says where its number came from. None of them is a
          recording of nature: each is a model, labelled as one, with the assumptions it makes
          written beside it.
        </p>
        <p>
          They are grouped by the paper whose claim they interrogate, because that is what a given
          instrument is for. Each is named by the question it answers.
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
            These carry no paper prefix because they do not serve a single argument. That is a fact
            about the instrument rather than an omission: each one reaches across papers, and a
            reader arriving from any of them is in the right place.
          </p>
          <InstrumentList ids={loose} />
        </section>
      ) : null}

      <section className="reading page-flush">
        <h2>Not built yet</h2>
        <p>
          The catalogue records {inPreparation.length} further ids as in preparation:{" "}
          {inPreparation.join(", ")}. They are named here rather than hidden, so the gap between
          what the edition plans and what it has finished stays visible.
        </p>
        <p>
          {/*
            The wording is "records as in preparation", not "has no instrument behind them",
            because the second is false. avogadro-lab carries that status and already has a route
            and a built page. Readiness here is the catalogue's own signal about whether an
            instrument is admitted, which is not the same question as whether a page exists, and
            conflating them would have put a claim on this page that one line of the four
            contradicts.
          */}
          An id in preparation is not admitted to the registry yet, which is a statement about
          whether its model has an owner rather than about whether anything renders.
        </p>
      </section>
    </>
  );
}
