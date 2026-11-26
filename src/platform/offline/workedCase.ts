import {
  type InstrumentWorkedCase,
  type InstrumentWorkedCaseIndex,
  WORKED_CASE_SCHEMA_VERSION,
  type WorkedCaseCell,
  type WorkedCaseRun,
} from "../../experiments/workedCases/types.ts";

export class OfflineWorkedCaseError extends TypeError {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "OfflineWorkedCaseError";
    this.code = code;
  }
}

/** The existing laboratory generator owns this format and its displayed scientific values. */
export function offlineWorkedCaseIndex(value: unknown): InstrumentWorkedCaseIndex {
  const index = value as InstrumentWorkedCaseIndex | null;
  if (
    !index ||
    index.schemaVersion !== WORKED_CASE_SCHEMA_VERSION ||
    !index.cases ||
    typeof index.cases !== "object" ||
    Array.isArray(index.cases)
  )
    throw new OfflineWorkedCaseError(
      "offline-worked-case-schema",
      "The offline chapter needs the current prepared laboratory examples. Run prepare:lab.",
    );
  return index;
}

type ChapterContext = Readonly<{
  origin: string;
  paper: string;
  section: string;
  explanationAnchor: string;
  sourceDigest?: string | undefined;
}>;

const escapeHtml = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function runs(values: readonly WorkedCaseRun[]): string {
  return values
    .map((run) => {
      const text = escapeHtml(run.t);
      return run.s === "sup"
        ? "<sup>" + text + "</sup>"
        : run.s === "sub"
          ? "<sub>" + text + "</sub>"
          : text;
    })
    .join("");
}

function checkedCount(value: number, minimum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum)
    throw new OfflineWorkedCaseError(
      "offline-worked-case-count",
      "Prepared table spans and omission counts must be finite integers in their allowed range.",
    );
  return value;
}

function cells(values: readonly WorkedCaseCell[], heading = false): string {
  return values
    .map((cell) => {
      const tag = cell.header || heading ? "th" : "td";
      const scope = tag === "th" ? ' scope="' + (heading ? "col" : "row") + '"' : "";
      return (
        "<" +
        tag +
        scope +
        ' colspan="' +
        checkedCount(cell.colSpan, 1) +
        '" rowspan="' +
        checkedCount(cell.rowSpan, 1) +
        '">' +
        runs(cell.content) +
        "</" +
        tag +
        ">"
      );
    })
    .join("");
}

function sourceHref(href: string, context: ChapterContext): string {
  const url = new URL(href, context.origin);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new OfflineWorkedCaseError(
      "offline-worked-case-link",
      "An offline laboratory source must name an HTTPS destination without credentials.",
    );
  const inThisChapter =
    url.origin === context.origin &&
    (url.pathname === "/papers/" + context.paper + "/" ||
      url.pathname === "/papers/" + context.paper + "/" + context.section + "/") &&
    url.hash === "#" + context.section &&
    url.search === "";
  return inThisChapter ? "#" + context.explanationAnchor : url.href;
}

/**
 * Carry the laboratory's own prepared readouts, including array-backed tables and typed
 * unknowns. The older scalar adapter loses their labels and their explanations. No owner,
 * live component, transport buffer or numerical formula is imported into a saved chapter.
 */
export function renderOfflineWorkedCase(
  record: InstrumentWorkedCase | undefined,
  instrumentId: string,
  context: ChapterContext,
): string {
  const online =
    '<a rel="noreferrer" href="' +
    escapeHtml(context.origin) +
    "/lab/" +
    escapeHtml(instrumentId) +
    '/">Read the full laboratory online</a>';
  if (
    record?.kind !== "prepared" ||
    record.address !== instrumentId ||
    record.instrumentId !== instrumentId ||
    record.mode !== null ||
    record.origin !== "prepared-default"
  )
    return (
      "<section data-prepared-case-unavailable><h3>" +
      escapeHtml(instrumentId) +
      "</h3><p>A prepared worked example is not available in this edition. The chapter's authored foundation examples remain available above. " +
      online +
      ".</p></section>"
    );
  const qualitative =
    record.tables.length === 0 &&
    record.statements.every((statement) => statement.kind === "qualitative");
  const settings = record.settings
    .map(
      (setting) =>
        "<dt>" + escapeHtml(setting.label) + "</dt><dd>" + escapeHtml(setting.value) + "</dd>",
    )
    .join("");
  const statements = record.statements
    .map((statement) => {
      if (statement.kind !== "calculation" && statement.kind !== "qualitative")
        throw new OfflineWorkedCaseError(
          "offline-worked-case-statement",
          "A prepared statement must identify a calculation or a qualitative reconstruction.",
        );
      return (
        '<p data-prepared-statement="' + statement.kind + '">' + runs(statement.content) + "</p>"
      );
    })
    .join("");
  const more = (value: number, what: string) => {
    const count = checkedCount(value, 0);
    return count > 0 ? "<p>The full laboratory lists " + count + " further " + what + ".</p>" : "";
  };
  const tables = record.tables
    .map((table) => {
      const headings = table.headings.length
        ? "<thead>" +
          table.headings.map((row) => "<tr>" + cells(row, true) + "</tr>").join("") +
          "</thead>"
        : "";
      return (
        '<div class="table-scroll" role="region" aria-label="' +
        escapeHtml(table.caption) +
        '" tabindex="0"><table><caption>' +
        escapeHtml(table.caption) +
        "</caption>" +
        headings +
        "<tbody>" +
        table.rows.map((row) => "<tr>" + cells(row) + "</tr>").join("") +
        "</tbody></table></div>" +
        more(table.omittedRows, "rows in this table")
      );
    })
    .join("");
  const sources = record.sources
    .map((source) => {
      const href = sourceHref(source.href, context);
      return (
        '<li><a rel="noreferrer" href="' +
        escapeHtml(href) +
        '">' +
        escapeHtml(source.label) +
        "</a>" +
        (href.startsWith("#") ? " (included in this file)" : " (online)") +
        "</li>"
      );
    })
    .join("");
  const limits = record.notModeled.map((item) => item.trim().replace(/\.$/u, "")).join("; ");
  const evaluator = context.sourceDigest
    ? '<p class="revision">Evaluator: ' + escapeHtml(context.sourceDigest) + "</p>"
    : "";
  return (
    '<section data-print-worked-example data-prepared-worked-case="' +
    escapeHtml(instrumentId) +
    '" data-example-origin="prepared-default"><h3>' +
    escapeHtml(record.title) +
    "</h3><p>" +
    (qualitative ? "Prepared qualitative reconstruction" : "Static worked example") +
    " at the laboratory's default settings. No experiment runs in this file.</p>" +
    record.notes.map((note) => "<p>" + escapeHtml(note) + "</p>").join("") +
    "<h4>Settings used for this example</h4><dl>" +
    settings +
    "</dl>" +
    more(record.omittedSettings, "settings") +
    statements +
    more(record.omittedStatements, "accepted readouts") +
    tables +
    more(record.omittedTables, "result tables") +
    "<p>Not modeled: " +
    escapeHtml(limits) +
    ".</p>" +
    (sources
      ? '<nav aria-label="Sources for ' +
        escapeHtml(record.title) +
        '"><ul>' +
        sources +
        "</ul></nav>"
      : "") +
    "<p>" +
    online +
    ".</p>" +
    evaluator +
    "</section>"
  );
}
