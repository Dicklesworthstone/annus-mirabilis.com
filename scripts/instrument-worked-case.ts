/**
 * A compact, immutable reading of the real laboratory's prepared result. This runs only while
 * preparing the site. The reader receives words, units and table cells, never an evaluator,
 * trajectory buffer, worker module or a second set of numerical formulas.
 */
import { outputStatusRegistry } from "../src/experiments/results/types.ts";
import type {
  InstrumentWorkedCase,
  PreparedInstrumentWorkedCase,
  WorkedCaseCell,
  WorkedCaseRun,
  WorkedCaseStatement,
  WorkedCaseTable,
} from "../src/experiments/workedCases/types.ts";
import {
  attribute,
  descendants,
  type Element,
  elements,
  inView,
  parseMarkup,
} from "./instrument-table-plate.ts";

export const WORKED_CASE_LIMITS = Object.freeze({
  settings: 40,
  statements: 8,
  tables: 5,
  rows: 16,
  columns: 10,
  bytes: 49_152,
});

export type WorkedCaseMetadata = Readonly<{
  instrumentId: string;
  mode: string | null;
  title: string;
  notModeled: readonly string[];
  sources: readonly Readonly<{ href: string; label: string }>[];
}>;

const SKIP_TEXT = new Set(["script", "style", "template", "noscript", "button", "input", "select"]);

function allElements(root: Element): Element[] {
  return [root, ...elements(root).flatMap(allElements)];
}

/** Preserve semantic superscripts and subscripts; no HTML can enter the generated record. */
function runsOf(root: Element): WorkedCaseRun[] {
  const result: { t: string; s?: "sup" | "sub" }[] = [];
  function append(text: string, script?: "sup" | "sub") {
    const previous = result.at(-1);
    if (previous && previous.s === script) previous.t += text;
    else result.push(script ? { t: text, s: script } : { t: text });
  }
  function visit(node: Element | string, script?: "sup" | "sub") {
    if (typeof node === "string") {
      append(node, script);
      return;
    }
    if (SKIP_TEXT.has(node.tag) || attribute(node, "aria-hidden") === "true") return;
    if (node.tag === "br") append(" ", script);
    const nextScript = node.tag === "sup" || node.tag === "sub" ? node.tag : script;
    for (const child of node.children) visit(child, nextScript);
  }
  visit(root);
  return result
    .map((run, i, all) => {
      let t = run.t.replace(/\s+/g, " ");
      if (i === 0) t = t.trimStart();
      if (i === all.length - 1) t = t.trimEnd();
      return { ...run, t };
    })
    .filter((run) => run.t.length > 0);
}

function textOf(node: Element): string {
  return runsOf(node)
    .map((run) => (run.s === "sup" ? `^(${run.t})` : run.s === "sub" ? `_(${run.t})` : run.t))
    .join("");
}

function hasClass(node: Element, name: string): boolean {
  return (attribute(node, "class") ?? "").split(/\s+/).includes(name);
}

function under(node: Element, predicate: (ancestor: Element) => boolean): boolean {
  for (let ancestor: Element | null = node; ancestor; ancestor = ancestor.parent) {
    if (predicate(ancestor)) return true;
  }
  return false;
}

/** Predictions are requests, not accepted results. Their empty axes and choice forms stay out. */
function isPrediction(node: Element): boolean {
  return under(
    node,
    (ancestor) =>
      ["data-predict-placeholder", "data-predict-panel", "data-prediction-overlay"].some(
        (name) => attribute(ancestor, name) !== null,
      ) ||
      hasClass(ancestor, "predict-panel") ||
      hasClass(ancestor, "predict-placeholder"),
  );
}

function settingLabel(control: Element, nodes: readonly Element[]): string {
  const id = attribute(control, "id");
  const label = nodes.find((node) => node.tag === "label" && id && attribute(node, "for") === id);
  if (label) return textOf(label);
  const labelledBy = attribute(control, "aria-labelledby");
  if (labelledBy) {
    const labels = labelledBy
      .split(/\s+/)
      .map((key) => nodes.find((node) => attribute(node, "id") === key));
    const text = labels
      .filter((node): node is Element => node !== undefined)
      .map(textOf)
      .join(" ");
    if (text) return text;
  }
  const ariaLabel = attribute(control, "aria-label");
  if (ariaLabel) return ariaLabel;
  for (let parent = control.parent; parent; parent = parent.parent) {
    if (parent.tag === "label") return textOf(parent);
  }
  return "";
}

function radioGroupLabel(control: Element): string {
  for (let parent = control.parent; parent; parent = parent.parent) {
    if (parent.tag === "fieldset") {
      const legend = elements(parent).find((node) => node.tag === "legend");
      return legend ? textOf(legend) : "";
    }
  }
  return "";
}

function readSettings(root: Element) {
  const nodes = allElements(root);
  const settings: { label: string; value: string }[] = [];
  const seen = new Set<string>();
  const typedLabels = new Set<string>();
  // Read typed fields first even when a slider precedes its paired field. A slider can be
  // visually clamped while the accepted typed value lies beyond its teaching range.
  const controls = nodes.filter((node) => ["input", "select", "textarea"].includes(node.tag));
  controls.sort(
    (a, b) => Number(attribute(a, "type") === "range") - Number(attribute(b, "type") === "range"),
  );
  for (const control of controls) {
    if (!["input", "select", "textarea"].includes(control.tag) || isPrediction(control)) continue;
    if (under(control, (node) => attribute(node, "hidden") !== null || node.tag === "template"))
      continue;
    const type = attribute(control, "type") ?? "text";
    if (["hidden", "file", "submit", "button", "reset"].includes(type)) continue;
    if (type === "radio" && attribute(control, "checked") === null) continue;
    const controlLabel = settingLabel(control, nodes);
    if (!controlLabel) continue;
    const group = type === "radio" ? radioGroupLabel(control) : "";
    const label = group ? `${group}: ${controlLabel}` : controlLabel;
    if (type === "range" && typedLabels.has(label)) continue;
    let value: string;
    if (control.tag === "select") {
      const options = descendants(control, "option");
      const selected =
        options.find((option) => attribute(option, "selected") !== null) ?? options[0];
      value = selected ? textOf(selected) : "";
    } else if (control.tag === "textarea") {
      value = control.children
        .filter((child): child is string => typeof child === "string")
        .join("");
    } else if (type === "checkbox") value = attribute(control, "checked") === null ? "Off" : "On";
    else if (type === "radio") value = "Selected";
    else value = attribute(control, "value") ?? "";
    if (!value.trim()) continue;
    if (type !== "range") typedLabels.add(label);
    const key = label + "\n" + value;
    if (seen.has(key)) continue;
    seen.add(key);
    settings.push({ label, value });
  }
  // Some laboratories select the physical boundary or notation with pressed buttons rather
  // than form fields. The active choice belongs to the example too; ordinary action buttons do not.
  for (const button of nodes.filter(
    (node) =>
      node.tag === "button" && attribute(node, "aria-pressed") === "true" && !isPrediction(node),
  )) {
    const label = textOf({ ...button, tag: "span" });
    if (label && !seen.has(label + "\nSelected")) settings.push({ label, value: "Selected" });
  }
  return settings;
}

function spanOf(cell: Element, name: string): number {
  const span = Number(attribute(cell, name) ?? "1");
  return Number.isSafeInteger(span) && span > 0 ? span : 1;
}

function readCells(row: Element): WorkedCaseCell[] {
  return elements(row)
    .filter((cell) => cell.tag === "th" || cell.tag === "td")
    .map((cell) => ({
      content: runsOf(cell),
      header: cell.tag === "th",
      colSpan: spanOf(cell, "colspan"),
      rowSpan: spanOf(cell, "rowspan"),
    }));
}

function hasTypedResult(root: Element): boolean {
  return allElements(root).some((node) => {
    const status = attribute(node, "data-result-status");
    return (
      status !== null && Object.hasOwn(outputStatusRegistry, status) && textOf(node).length > 0
    );
  });
}

function readTable(table: Element): WorkedCaseTable | "omitted" | null {
  // Drawing scales describe the illustration, not a physical prediction of the experiment.
  if (hasClass(table, "scale-facts-table")) return null;
  const head = elements(table).find((node) => node.tag === "thead");
  const body = elements(table).find((node) => node.tag === "tbody") ?? table;
  const rows = elements(body)
    .filter((node) => node.tag === "tr")
    .map(readCells);
  if (!rows.length) return null;
  // A symbol concordance is useful in the full lab but is not its prepared answer. Keep
  // nonnumeric statuses beside values, including a fully underdetermined result table.
  const hasAnswer =
    hasTypedResult(table) ||
    rows.some((row) =>
      row
        .slice(1)
        .some((cell) =>
          /\d|underdetermined|not.applicable|outside.domain|symbolic|not (?:defined|identified|determined)|unknown|unavailable|requires/i.test(
            cell.content.map((run) => run.t).join(""),
          ),
        ),
    );
  if (!hasAnswer) return null;
  const headings = head
    ? elements(head)
        .filter((node) => node.tag === "tr")
        .map(readCells)
    : [];
  if (
    [...headings, ...rows].some(
      (row) =>
        row.reduce((columns, cell) => columns + cell.colSpan, 0) > WORKED_CASE_LIMITS.columns,
    )
  )
    return "omitted";
  const caption = elements(table).find((node) => node.tag === "caption");
  return {
    caption: caption ? textOf(caption) : "Prepared readouts",
    headings,
    rows: rows.slice(0, WORKED_CASE_LIMITS.rows),
    omittedRows: Math.max(0, rows.length - WORKED_CASE_LIMITS.rows),
  };
}

function readDefinitionList(list: Element): WorkedCaseTable | null {
  if (!hasClass(list, "derived-outputs") && attribute(list, "data-results") === null) return null;
  const rows: WorkedCaseCell[][] = [];
  let label: Element | undefined;
  // HTML permits either direct dt/dd children or a div around each term/definition group.
  const entries = elements(list).flatMap((node) => (node.tag === "div" ? elements(node) : [node]));
  for (const node of entries) {
    if (node.tag === "dt") label = node;
    else if (node.tag === "dd" && label) {
      rows.push([
        { content: runsOf(label), header: true, colSpan: 1, rowSpan: 1 },
        { content: runsOf(node), header: false, colSpan: 1, rowSpan: 1 },
      ]);
      label = undefined;
    }
  }
  if (
    !rows.length ||
    (!hasTypedResult(list) &&
      !rows.some((row) =>
        row
          .slice(1)
          .some((cell) =>
            /\d|underdetermined|not.applicable|outside.domain|symbolic|not (?:defined|identified|determined)|unknown|unavailable|requires/i.test(
              cell.content.map((run) => run.t).join(""),
            ),
          ),
      ))
  )
    return null;
  return {
    caption: "Prepared readouts",
    headings: [],
    rows: rows.slice(0, WORKED_CASE_LIMITS.rows),
    omittedRows: Math.max(0, rows.length - WORKED_CASE_LIMITS.rows),
  };
}

export function readInstrumentWorkedCase(
  html: string,
  metadata: WorkedCaseMetadata,
): InstrumentWorkedCase {
  const address = metadata.mode
    ? metadata.instrumentId + ":" + metadata.mode
    : metadata.instrumentId;
  const unavailable = (reason: string): InstrumentWorkedCase => ({
    kind: "unavailable",
    address,
    reason,
  });
  const document = parseMarkup(html);
  const root = allElements(document).find(
    (node) => attribute(node, "data-instrument-id") === address,
  );
  if (!root) return unavailable("The addressed laboratory did not render a prepared result.");
  if (
    attribute(root, "data-snapshot-version") === null ||
    attribute(root, "data-accepted-input-revision") === null ||
    attribute(root, "data-pending") === "true"
  ) {
    return unavailable("The laboratory did not identify an accepted prepared result.");
  }
  const settings = readSettings(root);
  if (!settings.length) return unavailable("The prepared result did not identify its settings.");
  const statements: WorkedCaseStatement[] = allElements(root).flatMap((node) => {
    const kind = attribute(node, "data-results");
    if (
      node.tag !== "p" ||
      !inView(node) ||
      isPrediction(node) ||
      (kind !== "calculation" && kind !== "qualitative")
    )
      return [];
    const content = runsOf(node);
    return content.length ? [{ kind, content }] : [];
  });
  const tableReadings = allElements(root)
    .filter(
      (node) => (node.tag === "table" || node.tag === "dl") && inView(node) && !isPrediction(node),
    )
    .map((node) => (node.tag === "table" ? readTable(node) : readDefinitionList(node)));
  const tables = tableReadings.filter(
    (table): table is WorkedCaseTable => table !== null && table !== "omitted",
  );
  if (!tables.length && !statements.length)
    return unavailable("The prepared result had no readable accepted readout.");
  if (!metadata.notModeled.length || !metadata.sources.length)
    return unavailable("The prepared example's model limits or source passage are unavailable.");
  const notes = [
    ...new Set(
      allElements(root)
        .filter(
          (node) =>
            (node.tag === "p" || node.tag === "div") &&
            inView(node) &&
            !isPrediction(node) &&
            (hasClass(node, "accepted-caption") ||
              (node.tag === "p" && attribute(node, "data-semantic-kind") !== null)),
        )
        .map(textOf)
        .filter(Boolean),
    ),
  ];
  const result: PreparedInstrumentWorkedCase = {
    kind: "prepared",
    address,
    instrumentId: metadata.instrumentId,
    mode: metadata.mode,
    origin: "prepared-default",
    title: metadata.title,
    settings: settings.slice(0, WORKED_CASE_LIMITS.settings),
    omittedSettings: Math.max(0, settings.length - WORKED_CASE_LIMITS.settings),
    notes,
    statements: statements.slice(0, WORKED_CASE_LIMITS.statements),
    omittedStatements: Math.max(0, statements.length - WORKED_CASE_LIMITS.statements),
    tables: tables.slice(0, WORKED_CASE_LIMITS.tables),
    omittedTables:
      tableReadings.filter((table) => table === "omitted").length +
      Math.max(0, tables.length - WORKED_CASE_LIMITS.tables),
    notModeled: [...metadata.notModeled],
    sources: metadata.sources.map((source) => ({ ...source })),
  };
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > WORKED_CASE_LIMITS.bytes) {
    return unavailable(
      "The prepared result could not be represented as a bounded reading summary.",
    );
  }
  return result;
}
