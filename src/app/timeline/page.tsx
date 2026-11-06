import type { Metadata } from "next";
import { StatusLabel } from "../../discovery/cards/StatusLabel.tsx";
import {
  dateKindLabel,
  formatTimelineDate,
  SHELF_CUTOFF_YEAR,
  TIMELINE_PAPER_NAMES,
  type TimelineDate,
  type TimelineEntry,
} from "../../discovery/timeline/model.ts";
import { loadTimeline } from "../../discovery/timeline/records.ts";
import { TimelineFilters } from "../../discovery/timeline/TimelineFilters.tsx";
import "./timeline.css";

export const metadata: Metadata = {
  title: "Timeline: before and after 1905",
  description:
    "Follow the four papers from their dated manuscripts to publication, the sources available before 1905, and the later evidence, with each date's kind, precision and source kept visible.",
  alternates: { canonical: "/timeline/" },
};

function DateText({ date }: { date: TimelineDate }) {
  const dateTime =
    date.precision === "range"
      ? undefined
      : date.earliest.slice(0, date.precision === "year" ? 4 : date.precision === "month" ? 7 : 10);
  return <time dateTime={dateTime}>{formatTimelineDate(date)}</time>;
}

function TimelineEvent({ entry }: { entry: TimelineEntry }) {
  return (
    <li className="timeline-event">
      <article
        id={`t-${entry.id}`}
        data-timeline-entry={entry.id}
        data-timeline-track={entry.track}
        data-date-precision={entry.date.precision}
      >
        <div className="timeline-event-date">
          <span>{dateKindLabel(entry.date.kind)}</span>
          <DateText date={entry.date} />
          <span className="timeline-precision">
            {entry.date.precision === "range"
              ? "Recorded range"
              : `${entry.date.precision} precision`}
          </span>
        </div>
        <div className="timeline-event-body">
          <p className="eyebrow">{TIMELINE_PAPER_NAMES[entry.paper] ?? entry.paper}</p>
          <h3>{entry.title}</h3>
          {entry.status ? (
            <StatusLabel status={entry.status} admittedImport={entry.admittedImport} />
          ) : null}
          <p>{entry.summary}</p>
          {entry.printedDateLine ? (
            <p className="timeline-date-line">
              Printed date-line: <span lang="de">{entry.printedDateLine}</span>
            </p>
          ) : null}
          {entry.priorEvent ? (
            <p className="timeline-prior-event">
              Earlier event recorded with this source: {dateKindLabel(entry.priorEvent.kind)}{" "}
              <DateText date={entry.priorEvent} />.
            </p>
          ) : null}
          {entry.limits ? (
            <p className="timeline-limits">
              <strong>What this establishes, and its limits. </strong>
              {entry.limits}
            </p>
          ) : null}
          {entry.parallelWorkBasis ? <p>{entry.parallelWorkBasis}</p> : null}
          <div className="timeline-sources">
            <h4>Source</h4>
            <ul>
              {entry.sources.map((source) => (
                <li key={`${source.title}-${source.locator}`}>
                  {source.title}
                  {source.locator ? ` · ${source.locator}` : ""}
                  {source.href ? (
                    <>
                      {" "}
                      (<a href={source.href}>Source receipt</a>)
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          <div className="timeline-entry-links">
            {entry.links.map((link) => (
              <a href={link.href} key={link.href}>
                {link.label}
              </a>
            ))}
            <a href={`#t-${entry.id}`} aria-label={`Link to this entry: ${entry.title}`}>
              Link to this entry
            </a>
          </div>
        </div>
      </article>
    </li>
  );
}

function EventList({ entries }: { entries: readonly TimelineEntry[] }) {
  return (
    <ol className="timeline-events">
      {entries.map((entry) => (
        <TimelineEvent key={entry.id} entry={entry} />
      ))}
    </ol>
  );
}

export default function TimelinePage() {
  const timeline = loadTimeline();
  return (
    <article className="timeline-page" id="timeline-content">
      <header className="page-intro">
        <p className="eyebrow">Sources · Papers · Later evidence</p>
        <h1>Before and after 1905</h1>
        <p className="lead">
          A date can mark an experiment, a talk, a manuscript, or a journal issue. Follow each
          record with its source, keeping the work available by the end of {SHELF_CUTOFF_YEAR}{" "}
          separate from what came afterward.
        </p>
        <p>
          This chronology follows the four papers and the sources discussed in their discovery
          routes. Month and year dates keep that precision; overlapping periods do not establish an
          order within a month or year.
        </p>
      </header>

      <nav className="timeline-track-nav" aria-label="Timeline tracks">
        {timeline.tracks.map((track) => (
          <a href={`#timeline-${track.id}`} key={track.id}>
            <span>{track.title}</span>
            <span>{track.span}</span>
          </a>
        ))}
      </nav>
      <p className="timeline-boundary-link">
        <a href="#t-boundary-1904">Go to the end-of-1904 boundary</a>
      </p>
      <TimelineFilters />

      {timeline.tracks.map((track) => (
        <section
          id={`timeline-${track.id}`}
          key={track.id}
          className="timeline-track"
          aria-labelledby={`timeline-heading-${track.id}`}
        >
          <header className="timeline-track-intro">
            <h2 id={`timeline-heading-${track.id}`}>{track.title}</h2>
            <p className="timeline-span" data-timeline-span={track.id}>
              {track.span} · {track.entries.length} dated entries
            </p>
            <p>{track.description}</p>
          </header>
          {track.id === "long-arc" ? (
            <>
              <EventList entries={track.entries.filter((entry) => entry.beforeBoundary)} />
              <section
                id="t-boundary-1904"
                className="timeline-boundary"
                aria-labelledby="timeline-boundary-title"
              >
                <h3 id="timeline-boundary-title">The end of {SHELF_CUTOFF_YEAR}</h3>
                <p>
                  Everything above in this track was available to a careful reader by then. The
                  entries below are later work, labelled with the role they play in the discovery
                  routes. Availability alone does not establish what Einstein knew.
                </p>
              </section>
              <div id="timeline-post-1904">
                <EventList entries={track.entries.filter((entry) => !entry.beforeBoundary)} />
              </div>
            </>
          ) : (
            <EventList entries={track.entries} />
          )}
        </section>
      ))}

      <footer className="timeline-onward">
        <h2>Follow an argument through the year</h2>
        <p>
          <a href="/papers/">Choose one of the four papers</a>, or{" "}
          <a href="/connections/">follow the connections among their arguments</a>.
        </p>
      </footer>
    </article>
  );
}
