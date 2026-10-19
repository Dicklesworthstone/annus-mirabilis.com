/**
 * A unified diff over lines, for the record an overwrite leaves behind.
 *
 * `am-edn-alignment-tooling-do1` scope B.6: "Existing block files are never overwritten without
 * `--update`, which writes a unified diff to the run directory first. The tool never deletes a
 * file." The diff is that record. Replacing an authored block file destroys the previous bytes in
 * the working tree, and the diff is what makes the act reviewable and reversible by hand, which is
 * the same reason AGENTS.md RULE 1 governs overwriting authored content and not only deleting it.
 *
 * No dependency is added for this. The repository declares fifteen, deliberately, and a line diff
 * is small enough to own: an LCS table, a backtrack, and hunk assembly with context.
 *
 * The output is the ordinary unified format, so `git apply -R` and `patch -R` read it: a `---` and
 * `+++` header, `@@ -oldStart,oldCount +newStart,newCount @@` hunks, and
 * `\ No newline at end of file` on whichever side lacks one. Identical inputs produce the empty
 * string rather than an empty header, so a caller can tell "no change" from "changed by nothing".
 */

/** One line of the edit script: kept, removed from the old side, or added on the new side. */
type Op = Readonly<{ kind: "eq" | "del" | "add"; text: string; noNewline: boolean }>;

/**
 * A final line that is not newline-terminated is a DIFFERENT line from the same text terminated,
 * and the comparison has to see that or it reports no change at all.
 *
 * Found by comparing against the system `diff -u`: `x\n` against `x` produced the empty string here
 * while diff(1) correctly reported `-x` / `+x` with `\ No newline at end of file`. Stripping the
 * terminator before splitting made the two line arrays equal, so every op was `eq` and the function
 * returned "no change" for inputs that differ in their last byte. A false "identical" is the one
 * answer a diff must never give, because the caller then records no diff for a real overwrite.
 *
 * Marking the unterminated last line with a sentinel puts the distinction inside the LCS, so the
 * del/add pair and the marker both fall out of the ordinary path rather than needing a special case.
 */
const NO_NEWLINE_SENTINEL = "\u0000no-trailing-newline";

/**
 * Above this many lines on either side the LCS table stops being worth its memory
 * ((n+1)*(m+1) 32-bit cells), so the whole file is reported as one replacement hunk instead. A
 * source block file is tens of lines, so this is a ceiling rather than a working mode; it exists so
 * that a caller handed something unexpected still gets a readable record instead of an allocation
 * failure.
 */
export const LCS_LINE_CAP = 20_000;

/**
 * Split into comparison keys, one per line, the last carrying the sentinel when the text is not
 * newline-terminated.
 */
function toLines(text: string): Readonly<{ lines: readonly string[]; endsWithNewline: boolean }> {
  if (text === "") return { lines: [], endsWithNewline: true };
  const endsWithNewline = text.endsWith("\n");
  const body = endsWithNewline ? text.slice(0, -1) : text;
  const lines = body.split("\n");
  if (endsWithNewline) return { lines, endsWithNewline };
  const last = lines.length - 1;
  return {
    lines: lines.map((line, i) => (i === last ? `${line}${NO_NEWLINE_SENTINEL}` : line)),
    endsWithNewline,
  };
}

/** The printable text of a comparison key, and whether it was the unterminated last line. */
function readKey(key: string): Readonly<{ text: string; noNewline: boolean }> {
  return key.endsWith(NO_NEWLINE_SENTINEL)
    ? { text: key.slice(0, -NO_NEWLINE_SENTINEL.length), noNewline: true }
    : { text: key, noNewline: false };
}

/** The edit script taking `a` to `b`, longest-common-subsequence based. */
function diffOps(a: readonly string[], b: readonly string[]): readonly Op[] {
  const n = a.length;
  const m = b.length;
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const diagonal = table[(i + 1) * width + (j + 1)] ?? 0;
      const down = table[(i + 1) * width + j] ?? 0;
      const right = table[i * width + (j + 1)] ?? 0;
      table[i * width + j] = a[i] === b[j] ? diagonal + 1 : Math.max(down, right);
    }
  }

  const ops: Op[] = [];
  const push = (kind: Op["kind"], key: string): void => {
    const { text, noNewline } = readKey(key);
    ops.push({ kind, text, noNewline });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("eq", a[i] ?? "");
      i++;
      j++;
      continue;
    }
    const down = table[(i + 1) * width + j] ?? 0;
    const right = table[i * width + (j + 1)] ?? 0;
    // Ties prefer the deletion, so a replacement reads as removed-then-added rather than the
    // reverse. Either is a valid diff; being consistent is what makes the bytes deterministic.
    if (down >= right) {
      push("del", a[i] ?? "");
      i++;
    } else {
      push("add", b[j] ?? "");
      j++;
    }
  }
  while (i < n) {
    push("del", a[i] ?? "");
    i++;
  }
  while (j < m) {
    push("add", b[j] ?? "");
    j++;
  }
  return ops;
}

/** Every op paired with the 1-based line number it occupies on each side it exists on. */
type Numbered = Readonly<{ op: Op; oldNo: number; newNo: number }>;

function numberOps(ops: readonly Op[]): readonly Numbered[] {
  let oldNo = 0;
  let newNo = 0;
  return ops.map((op) => {
    if (op.kind !== "add") oldNo++;
    if (op.kind !== "del") newNo++;
    return { op, oldNo, newNo };
  });
}

export type UnifiedDiffOptions = Readonly<{
  /** The path or label printed on the `---` line. */
  oldLabel: string;
  /** The path or label printed on the `+++` line. */
  newLabel: string;
  /** Unchanged lines kept on each side of a change. Defaults to 3, as diff(1) does. */
  context?: number | undefined;
}>;

/**
 * A unified diff of `oldText` against `newText`, or `""` when they are byte-identical.
 */
export function unifiedDiff(oldText: string, newText: string, options: UnifiedDiffOptions): string {
  if (oldText === newText) return "";

  const context = Math.max(0, options.context ?? 3);
  const old = toLines(oldText);
  const next = toLines(newText);

  const noNewlineMarker = "\\ No newline at end of file";
  const header = [`--- ${options.oldLabel}`, `+++ ${options.newLabel}`];

  if (old.lines.length > LCS_LINE_CAP || next.lines.length > LCS_LINE_CAP) {
    const body: string[] = [
      `@@ -${old.lines.length === 0 ? 0 : 1},${old.lines.length} +${next.lines.length === 0 ? 0 : 1},${next.lines.length} @@`,
    ];
    for (const key of old.lines) {
      const { text, noNewline } = readKey(key);
      body.push(`-${text}`);
      if (noNewline) body.push(noNewlineMarker);
    }
    for (const key of next.lines) {
      const { text, noNewline } = readKey(key);
      body.push(`+${text}`);
      if (noNewline) body.push(noNewlineMarker);
    }
    return `${[...header, ...body].join("\n")}\n`;
  }

  const numbered = numberOps(diffOps(old.lines, next.lines));
  const changed = numbered
    .map((entry, index) => (entry.op.kind === "eq" ? -1 : index))
    .filter((index) => index >= 0);
  // Unreachable while oldText !== newText, but a diff that silently returned a bare header would be
  // worse than one that says nothing.
  if (changed.length === 0) return "";

  /*
   * Group changes whose context windows touch into one hunk. The gap that matters is the number of
   * UNCHANGED ops between two changes, which is `index - last - 1`, not the index distance: a
   * replaced line contributes two ops, so index distance overstates the gap by one per replacement
   * and splits hunks diff(1) merges. Found against the system diff -u, which merged changes seven
   * apart (six unchanged lines, exactly 2 * context) where this split them.
   */
  const clusters: { first: number; last: number }[] = [];
  for (const index of changed) {
    const open = clusters[clusters.length - 1];
    if (open !== undefined && index - open.last - 1 <= context * 2) {
      open.last = index;
    } else {
      clusters.push({ first: index, last: index });
    }
  }

  const body: string[] = [];
  for (const cluster of clusters) {
    const start = Math.max(0, cluster.first - context);
    const end = Math.min(numbered.length - 1, cluster.last + context);
    const span = numbered.slice(start, end + 1);

    const oldSpan = span.filter((entry) => entry.op.kind !== "add");
    const newSpan = span.filter((entry) => entry.op.kind !== "del");
    const oldStart = oldSpan[0]?.oldNo ?? 0;
    const newStart = newSpan[0]?.newNo ?? 0;
    body.push(
      `@@ -${oldSpan.length === 0 ? 0 : oldStart},${oldSpan.length} +${newSpan.length === 0 ? 0 : newStart},${newSpan.length} @@`,
    );

    for (const entry of span) {
      const sign = entry.op.kind === "eq" ? " " : entry.op.kind === "del" ? "-" : "+";
      body.push(`${sign}${entry.op.text}`);
      if (entry.op.noNewline) body.push(noNewlineMarker);
    }
  }

  return `${[...header, ...body].join("\n")}\n`;
}
