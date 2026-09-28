/**
 * THE ONE DEFINITION OF A COMPILED RECORD'S KEY (am-as1w).
 *
 * `compileContent` namespaces most records as `<routeKind>:<paper>:<id>`, and five reading kinds
 * (paper, argument, foundation, citation, equation) by bare id because they are addressed by id
 * across papers. That format was written inline in one template literal and read nowhere, so every
 * consumer that wanted the kind or the paper of a record reached for a field on the record instead.
 *
 * For editorial notes that was a mistake with a reader-visible cost. The checks in
 * `checks/structural` and `checks/epistemic` test `rec.kind === "editorial-note"`, but `kind` on an
 * editorial note is the NOTE'S OWN kind, one of `historian-margin`, `correction`, `typographical`,
 * `dispute` or `side-note`. Measured 2026-09-28: all 8 records under `content/editorial-notes/`
 * carry a note kind, none carries the string `editorial-note`, and none carries a `paper` field.
 * So those comparisons matched zero records, and a note with a dangling citation or an unknown
 * affected block was never reported, while the note rendered perfectly well.
 *
 * `editorial-note` is what the ROUTE is called, and the route's name lives in the key. Reading the
 * key rather than inventing a second `kind` on the record keeps one on-disk shape, which is the
 * shape that renders and the shape `validateEditorialNote` accepts.
 */

/** The reading kinds keyed by bare id, because they are referenced by id from other papers. */
const BARE_ID_KINDS: ReadonlySet<string> = new Set([
  "paper",
  "argument",
  "foundation",
  "citation",
  "equation",
]);

export function recordKeyFor(routeKind: string, paper: string | undefined, id: string): string {
  return BARE_ID_KINDS.has(routeKind) ? id : `${routeKind}:${paper ?? ""}:${id}`;
}

export type ParsedRecordKey = Readonly<{ routeKind: string; paper: string; id: string }>;

/**
 * The kind and paper a namespaced key carries, or null for a bare-id key. The id may itself contain
 * a colon, so the split is on the FIRST TWO separators only and the remainder is the id.
 */
export function parseRecordKey(key: string): ParsedRecordKey | null {
  const first = key.indexOf(":");
  if (first === -1) return null;
  const second = key.indexOf(":", first + 1);
  if (second === -1) return null;
  return {
    routeKind: key.slice(0, first),
    paper: key.slice(first + 1, second),
    id: key.slice(second + 1),
  };
}

/**
 * The paper an editorial note belongs to, or null when this key is not an editorial note. The
 * corpus puts a note in its paper's directory (`content/editorial-notes/<paper>/<id>.json`) and the
 * record carries no `paper` field, so the key is where a check learns which paper's source blocks
 * an `affectedIds` entry should resolve against.
 */
export function editorialNotePaper(key: string): string | null {
  const parsed = parseRecordKey(key);
  return parsed && parsed.routeKind === "editorial-note" ? parsed.paper : null;
}

/**
 * The paper a source block belongs to, or null when this key is not a source block. A block's id is
 * per-paper by design, so a consumer that judges block ids needs the paper to scope them; reading it
 * from the key rather than from the record keeps one authority for the namespace.
 */
export function sourceBlockPaper(key: string): string | null {
  const parsed = parseRecordKey(key);
  return parsed && parsed.routeKind === "source-block" ? parsed.paper : null;
}

/** Whether this key names an editorial note, whatever the note's own kind happens to be. */
export function isEditorialNoteKey(key: string): boolean {
  return editorialNotePaper(key) !== null;
}
