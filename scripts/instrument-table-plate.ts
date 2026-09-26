/**
 * Reads a table instrument's plate from its laboratory's own page (dispatch 246).
 *
 * Eleven instruments answer with a table rather than a drawing, and /instruments/ shows each as a
 * small table on its plate. Until dispatch 246 the plate held the rows' labels beside empty dotted
 * rules ("Mean energy per resonator oscillation ……"), which read as a widget that had failed to
 * load. A value belongs there, and it must be the laboratory's own: the number its route prints
 * for its default settings, computed by the owner it labels "host calculation". So nothing here
 * computes or formats a quantity. It reads the laboratory page's markup, rendered on the server
 * exactly as the route renders it without JavaScript, and takes the cells as they stand.
 *
 * WHICH TABLE. The first table a reader can see whose body holds values, by the rule the thumbnail
 * generator already uses for a compared column (scripts/generate-instrument-thumbnails.ts): a
 * column holds values when more than half of the rows read have a digit in it. A table inside
 * <noscript>, a closed <details>, an element marked hidden, a <template> or the page's
 * introduction is not one a reader sees on arrival, and a table with no column of values is a key
 * rather than an answer. sr-07's first table is such a key ("X | electric x in K | Ex"); its
 * second is the plane-wave residuals it computes, and that is its plate.
 *
 * WHAT A CELL IS. Its words as runs, plain, superscript or subscript, the form the plate's labels
 * already take, so 10<sup>−20</sup> stays an exponent. A <small> is a cell's second, quieter line
 * and is left out, as the thumbnail generator leaves it out. A column headed "Unit" is not a value
 * column but furniture, so its words are set after each value in its row; a unit of 1 says nothing
 * beside a number and is not set.
 *
 * The markup React writes is regular: every element closed, attributes quoted. This reads that and
 * no more. It is not a general HTML parser and does not try to be one.
 */

/** One stretch of a cell's words as the laboratory sets it: plain, superscript or subscript. */
export type Run = { t: string; s?: "sup" | "sub" };
/** One row of the plate: the row's label and its value in each column of values. */
export type PlateRow = { label: Run[]; values: Run[][] };
/** A table instrument's plate: the names of its columns of values, when the table names them. */
export type TablePlate = { columns: Run[][]; rows: PlateRow[] };

type Element = {
  tag: string;
  attrs: string;
  children: (Element | string)[];
  parent: Element | null;
};

const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
/** Elements whose content is text, not markup, up to their closing tag. */
const RAW_TEXT = new Set(["script", "style", "textarea", "title"]);

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const code =
        name[1] === "x" || name[1] === "X"
          ? Number.parseInt(name.slice(2), 16)
          : Number.parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

const TOKEN =
  /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;

/** The markup as a tree of elements and decoded text. */
export function parseMarkup(html: string): Element {
  const root: Element = { tag: "#root", attrs: "", children: [], parent: null };
  let current = root;
  let last = 0;
  const token = new RegExp(TOKEN.source, "g");
  for (let m = token.exec(html); m !== null; m = token.exec(html)) {
    if (m.index > last) current.children.push(decode(html.slice(last, m.index)));
    last = token.lastIndex;
    if (m[0].startsWith("<!--")) continue;
    const tag = (m[2] ?? "").toLowerCase();
    if (m[1]) {
      // A closing tag closes the nearest open element of its name, and everything inside it.
      let open: Element | null = current;
      while (open && open.tag !== tag) open = open.parent;
      if (open?.parent) current = open.parent;
      continue;
    }
    const element: Element = { tag, attrs: m[3] ?? "", children: [], parent: current };
    current.children.push(element);
    if (RAW_TEXT.has(tag)) {
      const end = html.toLowerCase().indexOf(`</${tag}`, last);
      const stop = end < 0 ? html.length : end;
      element.children.push(html.slice(last, stop));
      const close = html.indexOf(">", stop);
      last = close < 0 ? html.length : close + 1;
      token.lastIndex = last;
      continue;
    }
    if (!VOID.has(tag) && !m[4]) current = element;
  }
  if (last < html.length) current.children.push(decode(html.slice(last)));
  return root;
}

/** The value of an attribute, "" for a bare one, or null when the element does not carry it. */
function attribute(element: Element, name: string): string | null {
  const m = new RegExp(
    `(?:^|\\s)${name}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+)))?(?=\\s|$)`,
    "i",
  ).exec(element.attrs);
  return m ? (m[1] ?? m[2] ?? m[3] ?? "") : null;
}

function elements(parent: Element): Element[] {
  return parent.children.filter((child): child is Element => typeof child !== "string");
}

function descendants(parent: Element, tag: string): Element[] {
  const found: Element[] = [];
  for (const child of elements(parent)) {
    if (child.tag === tag) found.push(child);
    found.push(...descendants(child, tag));
  }
  return found;
}

/** Whether a reader without JavaScript sees the element on arriving at the page. */
function inView(element: Element): boolean {
  for (let node: Element | null = element; node; node = node.parent) {
    if (node.tag === "noscript" || node.tag === "template") return false;
    if (node.tag === "details" && attribute(node, "open") === null) return false;
    if (attribute(node, "hidden") !== null) return false;
    if ((attribute(node, "class") ?? "").split(/\s+/).includes("page-intro")) return false;
  }
  return true;
}

function textOf(node: Element | string | undefined): string {
  if (node === undefined) return "";
  if (typeof node === "string") return node;
  if (RAW_TEXT.has(node.tag)) return "";
  return node.children.map(textOf).join("");
}

/** A cell's words as runs, with whitespace collapsed and trimmed at both ends. */
export function cellRuns(cell: Element | undefined): Run[] {
  if (!cell) return [];
  const out: Run[] = [];
  const walk = (node: Element) => {
    for (const child of node.children) {
      if (typeof child === "string") out.push({ t: child });
      else if (child.tag === "small" || RAW_TEXT.has(child.tag)) continue;
      else if (child.tag === "sup" || child.tag === "sub")
        out.push({ t: textOf(child), s: child.tag });
      else walk(child);
    }
  };
  walk(cell);
  const merged: Run[] = [];
  for (const run of out) {
    const last = merged[merged.length - 1];
    if (last && last.s === run.s) last.t += run.t;
    else merged.push({ ...run });
  }
  return merged
    .map((run) => ({ ...run, t: run.t.replace(/\s+/g, " ") }))
    .map((run, i, all) => {
      let t = run.t;
      if (i === 0) t = t.trimStart();
      if (i === all.length - 1) t = t.trimEnd();
      return { ...run, t };
    })
    .filter((run) => run.t.length > 0);
}

function cells(row: Element): Element[] {
  return elements(row).filter((cell) => cell.tag === "td" || cell.tag === "th");
}

/** A value with its row's unit set after it, unless the unit is 1. */
function withUnit(value: Run[], unit: Run[]): Run[] {
  const unitText = unit.map((run) => run.t).join("");
  if (value.length === 0 || unit.length === 0 || unitText === "1") return value;
  return [...value, { t: " " }, ...unit].reduce<Run[]>((merged, run) => {
    const last = merged[merged.length - 1];
    if (last && last.s === run.s) last.t += run.t;
    else merged.push({ ...run });
    return merged;
  }, []);
}

/**
 * The plate a laboratory page's markup gives: its first table in view that holds values, with up
 * to `rowLimit` rows. Null when the page has no such table.
 */
export function readTablePlate(html: string, rowLimit = 4): TablePlate | null {
  for (const table of descendants(parseMarkup(html), "table")) {
    if (!inView(table)) continue;
    const head = descendants(table, "thead")[0];
    const headCells = head ? cells(descendants(head, "tr")[0] ?? head) : [];
    const body = descendants(table, "tbody")[0] ?? table;
    const bodyRows = elements(body)
      .filter((row) => row.tag === "tr")
      .slice(0, rowLimit);
    if (bodyRows.length === 0) continue;
    const width = Math.max(...bodyRows.map((row) => cells(row).length));
    const holdsValues = (column: number) =>
      bodyRows.filter((row) => /\d/.test(textOf(cells(row)[column]))).length * 2 > bodyRows.length;
    const valueColumns: number[] = [];
    for (let column = 1; column < width; column += 1)
      if (holdsValues(column)) valueColumns.push(column);
    if (valueColumns.length === 0) continue;
    const unitColumn = headCells.findIndex(
      (cell, column) =>
        column > 0 &&
        !valueColumns.includes(column) &&
        textOf(cell).replace(/\s+/g, " ").trim().toLowerCase() === "unit",
    );
    const rows = bodyRows
      .map((row) => {
        const rowCells = cells(row);
        const unit = unitColumn > 0 ? cellRuns(rowCells[unitColumn]) : [];
        return {
          label: cellRuns(rowCells[0]),
          values: valueColumns.map((column) => withUnit(cellRuns(rowCells[column]), unit)),
        };
      })
      .filter((row) => row.label.length > 0);
    if (rows.length === 0) continue;
    const columns =
      headCells.length > 0 ? valueColumns.map((column) => cellRuns(headCells[column])) : [];
    return { columns, rows };
  }
  return null;
}
