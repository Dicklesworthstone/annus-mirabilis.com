/** Local reader work, never a publication record or an assessment of its author. */
export const NOTEBOOK_KEY = "am:notebook:v1";
export const NOTEBOOK_FORMAT = "annus-reading-notebook";
export const NOTEBOOK_LIMITS = Object.freeze({ entries: 100, text: 4000, title: 240, recap: 2000 });
export const NOTEBOOK_PAPERS = [
  "brownian-motion", "light-quanta", "special-relativity", "mass-energy", "molecular-dimensions",
] as const;
export type NotebookPaper = (typeof NOTEBOOK_PAPERS)[number];
export const NOTEBOOK_KINDS = ["question", "example", "nextStep", "note"] as const;
export type NotebookKind = (typeof NOTEBOOK_KINDS)[number];
export const NOTEBOOK_VIEWS = [
  "reading", "results", "german", "english", "gloss", "parallel", "facsimile", "split",
] as const;
export type NotebookFrame = Readonly<{
  paper: NotebookPaper;
  anchor: string;
  view: (typeof NOTEBOOK_VIEWS)[number];
  detail: 0 | 1 | 2;
  lens: "paper" | "modern";
  /** Only the existing reader's portable foundation clarification, not instance/run ids. */
  open: string;
}>;
export type NotebookEntry = Readonly<{
  id: string;
  kind: NotebookKind;
  frame: NotebookFrame;
  title: string;
  text: string;
  createdAt: string;
}>;
export type LastPlace = Readonly<{
  frame: NotebookFrame;
  title: string;
  recap: string;
  recapKind: "authored-recap" | "overview";
}>;
export type NotebookDocument = Readonly<{
  format: typeof NOTEBOOK_FORMAT;
  schemaVersion: 1;
  entries: readonly NotebookEntry[];
  lastPlace: LastPlace | null;
}>;

function record(input: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input)))
    throw new TypeError("Expected a notebook record.");
  if (Reflect.ownKeys(input).length !== fields.length || fields.some((key) =>
    !Object.hasOwn(Object.getOwnPropertyDescriptor(input, key) ?? {}, "value")))
    throw new TypeError("Unknown or missing notebook fields. The saved original is preserved.");
  return input as Record<string, unknown>;
}
function text(input: unknown, max: number, empty = false): string {
  if (typeof input !== "string" || input.length > max || (!empty && !input.trim()) ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(input))
    throw new TypeError("Notebook text is empty, invalid, or too long.");
  return input;
}
export function parseNotebookFrame(input: unknown): NotebookFrame {
  const f = record(input, ["paper", "anchor", "view", "detail", "lens", "open"]);
  if (!NOTEBOOK_PAPERS.includes(f.paper as NotebookPaper) ||
      !NOTEBOOK_VIEWS.includes(f.view as NotebookFrame["view"]) ||
      ![0, 1, 2].includes(f.detail as number) || !["paper", "modern"].includes(f.lens as string))
    throw new TypeError("Unsupported notebook reading location.");
  const anchor = text(f.anchor, 160);
  if (!/^[a-zA-Z][a-zA-Z0-9_.:-]*$/u.test(anchor))
    throw new TypeError("A stable content anchor is required.");
  const open = text(f.open, 180, true);
  if (open !== "" && !/^foundation:[a-z][a-z0-9-]*$/u.test(open))
    throw new TypeError("Unsupported notebook clarification.");
  return Object.freeze({ paper: f.paper, anchor, view: f.view, detail: f.detail, lens: f.lens, open }) as NotebookFrame;
}
export function parseNotebookEntry(input: unknown): NotebookEntry {
  const e = record(input, ["id", "kind", "frame", "title", "text", "createdAt"]);
  const id = text(e.id, 80), createdAt = text(e.createdAt, 32);
  if (!/^[a-zA-Z0-9_-]+$/u.test(id) || !NOTEBOOK_KINDS.includes(e.kind as NotebookKind) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(createdAt) ||
      !Number.isFinite(Date.parse(createdAt)) || new Date(createdAt).toISOString() !== createdAt)
    throw new TypeError("Invalid notebook entry identity, kind, or timestamp.");
  return Object.freeze({ id, kind: e.kind as NotebookKind, frame: parseNotebookFrame(e.frame),
    title: text(e.title, NOTEBOOK_LIMITS.title), text: text(e.text, NOTEBOOK_LIMITS.text), createdAt });
}
export function parseLastPlace(input: unknown): LastPlace {
  const p = record(input, ["frame", "title", "recap", "recapKind"]);
  if (p.recapKind !== "authored-recap" && p.recapKind !== "overview")
    throw new TypeError("A recap must identify its authored source.");
  return Object.freeze({ frame: parseNotebookFrame(p.frame), title: text(p.title, NOTEBOOK_LIMITS.title),
    recap: text(p.recap, NOTEBOOK_LIMITS.recap), recapKind: p.recapKind });
}
export function parseNotebookDocument(input: unknown): NotebookDocument {
  const d = record(input, ["format", "schemaVersion", "entries", "lastPlace"]);
  if (d.format !== NOTEBOOK_FORMAT || d.schemaVersion !== 1)
    throw new TypeError("This notebook version is not supported. Its original is preserved.");
  if (!Array.isArray(d.entries) || d.entries.length > NOTEBOOK_LIMITS.entries)
    throw new TypeError(`A notebook can hold at most ${NOTEBOOK_LIMITS.entries} entries.`);
  const entries = d.entries.map(parseNotebookEntry);
  if (new Set(entries.map((e) => e.id)).size !== entries.length)
    throw new TypeError("Notebook entry ids must be unique.");
  return Object.freeze({ format: NOTEBOOK_FORMAT, schemaVersion: 1, entries: Object.freeze(entries),
    lastPlace: d.lastPlace === null ? null : parseLastPlace(d.lastPlace) });
}
export function emptyNotebook(): NotebookDocument {
  return Object.freeze({ format: NOTEBOOK_FORMAT, schemaVersion: 1, entries: Object.freeze([]), lastPlace: null });
}

/** Construct an allowlisted public location; free text and local entry ids never enter URLs. */
export function notebookFrameHref(input: NotebookFrame): string {
  const frame = parseNotebookFrame(input), query = new URLSearchParams();
  if (frame.view !== "reading") query.set("view", frame.view);
  if (frame.detail !== 1) query.set("detail", String(frame.detail));
  if (frame.lens === "modern") query.set("lens", "modern");
  if (frame.open) query.set("open", frame.open);
  return `/papers/${frame.paper}/${query.size ? `?${query}` : ""}#${frame.anchor}`;
}
