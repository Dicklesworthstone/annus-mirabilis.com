"use client";

import { useEffect, useRef, useState } from "react";
import { CHAPTER_INVESTIGATION_KEYS, INVESTIGATION_KEYS } from "../../platform/storage/keys.ts";
import { createStorageContext } from "../../platform/storage/store.ts";
import { CHAPTER_INVESTIGATIONS } from "./chapterTasks.ts";
import {
  exportInvestigationHtml,
  exportInvestigationJson,
  type InvestigationReport,
  type InvestigationSpec,
} from "./core.ts";
import { type InvestigationReadStatus, readStoredInvestigation } from "./persistence.ts";
import { INVESTIGATIONS } from "./specs.ts";
import "./investigation.css";

type Paper = keyof typeof INVESTIGATIONS;
const PAPERS = Object.keys(INVESTIGATIONS) as Paper[];
const PAPER_NAMES: Readonly<Record<Paper, string>> = {
  "brownian-motion": "Brownian motion",
  "light-quanta": "Light quanta",
  "special-relativity": "Special relativity",
  "mass-energy": "Mass and energy",
};
type PublishedInvestigation = Readonly<{
  id: string;
  paper: Paper;
  title: string;
  spec: InvestigationSpec;
  href: string;
  revisitHref?: string;
}>;
const PUBLISHED: readonly PublishedInvestigation[] = [
  ...PAPERS.map((paper) => ({
    id: paper,
    paper,
    title: PAPER_NAMES[paper],
    spec: INVESTIGATIONS[paper],
    href: `/discover/${paper}/#${INVESTIGATIONS[paper].promptId}`,
  })),
  ...CHAPTER_INVESTIGATIONS.map((chapter) => ({
    id: chapter.id,
    paper: chapter.paper,
    title: `${PAPER_NAMES[chapter.paper]}: ${chapter.title}`,
    spec: chapter.spec,
    href: `/papers/${chapter.paper}/${chapter.section}/#${chapter.id}`,
    revisitHref: `/papers/${chapter.paper}/${chapter.section}/#${chapter.id}-revisit`,
  })),
];
const STORAGE_KEYS = new Set<string>([
  ...Object.values(INVESTIGATION_KEYS),
  ...Object.values(CHAPTER_INVESTIGATION_KEYS),
]);
type KeptInvestigation = PublishedInvestigation &
  Readonly<{
    status: InvestigationReadStatus;
    report?: InvestigationReport;
  }>;

/**
 * A view of the discovery and chapter records, not another notebook or a migration.
 * Only the browser reads them. Parsed reader text is rendered as text; return links come
 * from the published specifications rather than a location inside a stored report.
 */
export function KeptInvestigations() {
  const [entries, setEntries] = useState<readonly KeptInvestigation[] | null>(null);
  const [feedback, setFeedback] = useState({ text: "", failed: false });
  const downloads = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const ctx = createStorageContext();
    const urls = downloads.current;
    function read() {
      setEntries(
        PUBLISHED.map((published): KeptInvestigation => {
          const kept = readStoredInvestigation(published.id, ctx);
          const report = kept.report;
          const { spec } = published;
          // Match the provider's restore boundary. An otherwise valid record placed under the
          // wrong key must not appear as this paper's work or get a misleading return link.
          if (
            kept.status === "ok" &&
            (!report ||
              report.paper !== spec.paper ||
              report.experimentId !== spec.experimentId ||
              report.promptId !== spec.promptId)
          ) {
            return { ...published, status: "unreadable" };
          }
          return { ...published, ...kept };
        }),
      );
    }
    read();
    function changed(event: StorageEvent) {
      if (event.key === null || STORAGE_KEYS.has(event.key)) {
        read();
      }
    }
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("storage", changed);
      for (const [url, timer] of urls) {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, []);

  function download(id: string, report: InvestigationReport, printable: boolean) {
    let url: string | undefined;
    try {
      const text = printable ? exportInvestigationHtml(report) : exportInvestigationJson(report);
      url = URL.createObjectURL(
        new Blob([text], {
          type: printable ? "text/html;charset=utf-8" : "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${id}-investigation.${printable ? "html" : "json"}`;
      link.hidden = true;
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
      const keep = url;
      downloads.current.set(
        keep,
        setTimeout(() => {
          URL.revokeObjectURL(keep);
          downloads.current.delete(keep);
        }, 1000),
      );
      setFeedback({
        text: "Investigation file prepared with your prediction, captured readings and explanation.",
        failed: false,
      });
    } catch {
      if (url) URL.revokeObjectURL(url);
      setFeedback({
        text: "The download could not start. Your saved investigation is still on this device.",
        failed: true,
      });
    }
  }

  return (
    <section
      className="investigation-workspace"
      aria-labelledby="kept-investigations-title"
      data-kept-investigations=""
    >
      <h2 id="kept-investigations-title">Your discovery investigations</h2>
      <p>
        Return to a prediction you pinned in a chapter or discovery journey, compare its saved
        readings, and finish your explanation. These investigations stay in this browser.
      </p>
      <details data-investigation-import-help="">
        <summary>Open a downloaded investigation on this device</summary>
        <p>
          Choose its chapter task or discovery journey below, open the prediction and comparison
          controls, then choose <strong>Open an investigation JSON file</strong>. You can review the
          file before opening it. Existing work is kept until you explicitly choose to replace it.
        </p>
        <ul>
          {PUBLISHED.map(({ id, title, href }) => (
            <li key={id}>
              <a href={href}>{title}</a>
            </li>
          ))}
        </ul>
      </details>
      {entries?.some((entry) => entry.status === "unavailable") && (
        <p className="notice">
          Saved investigations are unavailable because browser storage is blocked or unavailable.
          The chapter tasks and discovery journeys still work. If an investigation is keeping work
          only on its open page, download it there before leaving.
        </p>
      )}
      {entries?.some((entry) => entry.status === "unreadable") && (
        <p className="notice">
          A saved investigation could not be opened in this edition. Its original data is available
          under <a href="/your-data/">your data on this device</a>.
        </p>
      )}
      {entries?.every((entry) => entry.status === "missing") && (
        <p>
          No discovery investigations are kept on this device yet.{" "}
          <a href="/discover/brownian-motion/">Open the Brownian motion journey</a> and pin a
          prediction beside its laboratory to begin.
        </p>
      )}
      {entries?.map(({ id, title, spec, href, revisitHref, report }) =>
        report ? (
          <article
            className="investigation-reading"
            key={id}
            aria-labelledby={`kept-investigation-${id}`}
            data-kept-investigation={id}
          >
            <h3 id={`kept-investigation-${id}`}>{title}</h3>
            <p>{report.task.task}</p>
            <h4>Your pinned prediction</h4>
            <p className="investigation-words" data-kept-prediction="">
              {report.prediction}
            </p>
            <h4>Your explanation</h4>
            <p className="investigation-words" data-kept-explanation="">
              {report.explanation ||
                "No explanation saved yet. Reopen the investigation to add one."}
            </p>
            <p className="fine">
              Starting reading and {report.observations.length} changed{" "}
              {report.observations.length === 1 ? "reading" : "readings"} kept with this prediction.
              These are saved model calculations.
            </p>
            <div className="actions">
              <a href={href}>Reopen this investigation</a>
              {revisitHref && <a href={revisitHref}>Revisit your earlier prediction</a>}
              <a href={spec.sourceHref}>Read the source argument</a>
              <button type="button" onClick={() => download(id, report, false)}>
                Download investigation JSON
              </button>
              <button type="button" onClick={() => download(id, report, true)}>
                Download printable investigation
              </button>
            </div>
          </article>
        ) : null,
      )}
      <p className="fine">
        Clearing the reading notebook above keeps these investigations. You can remove them under{" "}
        <a href="/your-data/">your data on this device</a>.
      </p>
      <p role={feedback.failed ? "alert" : "status"} aria-atomic="true">
        {feedback.text}
      </p>
    </section>
  );
}
