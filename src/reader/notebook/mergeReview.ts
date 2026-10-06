import type { NotebookDocument, NotebookEntry } from "./schema.ts";

/** All inputs are admitted by the notebook schema before planning. No storage or physics here. */
export type NotebookMergeChoice = "keep-both" | "keep-current";
export type NotebookMergeChoices = ReadonlyMap<string, NotebookMergeChoice>;
export type NotebookMergeConflict = Readonly<{
  current: NotebookEntry;
  incoming: NotebookEntry;
  choice: NotebookMergeChoice;
  copiedId: string | null;
  changedFields: readonly string[];
}>;
export type NotebookMergePlan = Readonly<{
  current: NotebookDocument;
  incoming: NotebookDocument;
  document: NotebookDocument;
  added: number;
  duplicates: number;
  keptBoth: number;
  skipped: number;
  conflicts: readonly NotebookMergeConflict[];
  entryLimit: number;
  withinLimit: boolean;
}>;
export class NotebookMergeError extends TypeError {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "NotebookMergeError";
    this.code = code;
  }
}

/** Exact structural comparison, not display rounding, timestamps, or a probabilistic digest. */
function canonical(value: unknown): string {
  return (
    JSON.stringify(value, (_key, item: unknown) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        return Object.fromEntries(
          Object.keys(record)
            .sort()
            .map((key) => [key, record[key]]),
        );
      }
      return item;
    }) ?? "undefined"
  );
}
function entryContent(entry: NotebookEntry): string {
  const { id: _id, ...content } = entry;
  return canonical(content);
}

/** A stable candidate name only. Every collision is checked against the COMPLETE entry. */
function copyStem(id: string, content: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < content.length; i++) {
    hash ^= BigInt(content.charCodeAt(i));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `${id.slice(0, 48)}_copy_${hash.toString(16).padStart(16, "0")}`;
}

/**
 * Preserve every current entry. An edited imported version gets a stable fresh id unless the
 * reader explicitly leaves it out. Reimporting the same version finds its previous copy rather
 * than multiplying it. New ids may not take an id belonging to a later entry in the same import.
 * Capacity is reported for preview; the controller refuses the WHOLE commit if it cannot fit.
 */
export function planNotebookMerge(
  current: NotebookDocument,
  incoming: NotebookDocument,
  entryLimit: number,
  choices: NotebookMergeChoices = new Map(),
): NotebookMergePlan {
  const entries = [...current.entries];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const reserved = new Set([...byId.keys(), ...incoming.entries.map((entry) => entry.id)]);
  const conflicts: NotebookMergeConflict[] = [];
  let added = 0;
  let duplicates = 0;
  let keptBoth = 0;
  let skipped = 0;
  for (const entry of incoming.entries) {
    const existing = byId.get(entry.id);
    if (!existing) {
      entries.push(entry);
      byId.set(entry.id, entry);
      added++;
      continue;
    }
    const content = entryContent(entry);
    if (entryContent(existing) === content) {
      duplicates++;
      continue;
    }
    const stem = copyStem(entry.id, content);
    // A copy may sit beyond a now-free earlier candidate. Search retained copies first, so
    // removing an unrelated allocation obstacle does not make a repeated import multiply notes.
    const previousCopy = [...byId.entries()].find(
      ([id, candidate]) =>
        (id === stem ||
          (id.startsWith(`${stem}_`) && /^[1-9][0-9]*$/.test(id.slice(stem.length + 1)))) &&
        entryContent(candidate) === content,
    );
    if (previousCopy) {
      duplicates++;
      continue;
    }
    let copiedId = stem;
    let suffix = 1;
    while (reserved.has(copiedId)) copiedId = `${stem}_${suffix++}`;
    const choice = choices.has(entry.id) ? choices.get(entry.id) : "keep-both";
    if (choice !== "keep-both" && choice !== "keep-current") {
      throw new NotebookMergeError(
        "notebook-merge-choice-invalid",
        "Choose whether to keep both versions or leave the incoming version out.",
      );
    }
    const fields = ["kind", "title", "text", "createdAt", "frame", "replay"];
    const left = existing as unknown as Record<string, unknown>;
    const right = entry as unknown as Record<string, unknown>;
    conflicts.push(
      Object.freeze({
        current: existing,
        incoming: entry,
        choice,
        copiedId: choice === "keep-both" ? copiedId : null,
        changedFields: Object.freeze(
          fields.filter((field) => canonical(left[field]) !== canonical(right[field])),
        ),
      }),
    );
    if (choice === "keep-current") {
      skipped++;
      continue;
    }
    const copy = Object.freeze({ ...entry, id: copiedId });
    entries.push(copy);
    byId.set(copiedId, copy);
    reserved.add(copiedId);
    added++;
    keptBoth++;
  }
  return Object.freeze({
    current,
    incoming,
    document: Object.freeze({
      ...current,
      entries: Object.freeze(entries),
      lastPlace: current.lastPlace ?? incoming.lastPlace,
    }),
    added,
    duplicates,
    keptBoth,
    skipped,
    conflicts: Object.freeze(conflicts),
    entryLimit,
    withinLimit: entries.length <= entryLimit,
  });
}

export type NotebookMergeReview = Readonly<{
  source: "file" | "saved";
  savedWasCleared: boolean;
  plan: NotebookMergePlan;
}>;
export type NotebookReviewResult =
  | Readonly<{ ok: true; review: NotebookMergeReview }>
  | Readonly<{ ok: false; message: string }>;
export type NotebookMergeChange = Readonly<{ ok: true } | { ok: false; message: string }>;
export type SavedNotebookLease = Readonly<{ raw: string | null }>;
export type NotebookMergePort = Readonly<{
  entryLimit: number;
  admit(input: unknown): NotebookDocument;
  current(): NotebookDocument;
  saved(): Readonly<{ document: NotebookDocument; raw: string | null }>;
  /** Recheck a saved lease immediately before writing, using the store's normal size protection. */
  commit(document: NotebookDocument, lease?: SavedNotebookLease): NotebookMergeChange;
}>;
const STALE =
  "The notebook changed after this preview. Nothing was merged. Refresh the preview and review the versions again.";
const UNKNOWN = "This merge preview is no longer active. Open a new preview; nothing was merged.";

/**
 * Preview/review/commit protocol shared by file imports and cross-tab reconciliation. Reviews are
 * instance-local capabilities: a caller cannot forge a document or reuse a consumed confirmation.
 * Neither preview nor choosing a resolution writes anything. A failed commit retains the review.
 */
export function createNotebookMergeController(port: NotebookMergePort) {
  const reviews = new WeakMap<NotebookMergeReview, { base: string; lease?: SavedNotebookLease }>();
  const failed = (error: unknown): Readonly<{ ok: false; message: string }> => ({
    ok: false,
    message:
      error instanceof Error
        ? error.message
        : "The notebooks could not be merged. Both originals are unchanged.",
  });
  function issue(
    input: unknown,
    source: NotebookMergeReview["source"],
    choices: NotebookMergeChoices,
    lease?: SavedNotebookLease,
  ): NotebookReviewResult {
    const current = port.admit(port.current());
    const incoming = port.admit(input);
    const review: NotebookMergeReview = Object.freeze({
      source,
      savedWasCleared: source === "saved" && lease?.raw === null,
      plan: planNotebookMerge(current, incoming, port.entryLimit, choices),
    });
    reviews.set(review, { base: canonical(current), ...(lease ? { lease } : {}) });
    return { ok: true, review };
  }
  function stillCurrent(review: NotebookMergeReview): NotebookMergeChange {
    const context = reviews.get(review);
    if (!context) return { ok: false, message: UNKNOWN };
    if (canonical(port.current()) !== context.base) return { ok: false, message: STALE };
    if (context.lease && port.saved().raw !== context.lease.raw)
      return { ok: false, message: STALE };
    return { ok: true };
  }
  function previewSavedMerge(choices: NotebookMergeChoices = new Map()): NotebookReviewResult {
    try {
      const saved = port.saved();
      return issue(saved.document, "saved", choices, { raw: saved.raw });
    } catch (error) {
      return failed(error);
    }
  }
  return Object.freeze({
    previewImport(input: unknown): NotebookReviewResult {
      try {
        return issue(input, "file", new Map());
      } catch (error) {
        return failed(error);
      }
    },
    previewSavedMerge,
    reviseMerge(review: NotebookMergeReview, choices: NotebookMergeChoices): NotebookReviewResult {
      try {
        const checked = stillCurrent(review);
        if (!checked.ok) return checked;
        const next = issue(
          review.plan.incoming,
          review.source,
          choices,
          reviews.get(review)?.lease,
        );
        reviews.delete(review);
        return next;
      } catch (error) {
        return failed(error);
      }
    },
    refreshMerge(review: NotebookMergeReview): NotebookReviewResult {
      if (!reviews.has(review)) return { ok: false, message: UNKNOWN };
      try {
        const next =
          review.source === "saved"
            ? previewSavedMerge()
            : issue(review.plan.incoming, "file", new Map());
        if (next.ok) reviews.delete(review);
        return next;
      } catch (error) {
        return failed(error);
      }
    },
    commitMerge(review: NotebookMergeReview): NotebookMergeChange {
      try {
        const checked = stillCurrent(review);
        if (!checked.ok) return checked;
        if (!review.plan.withinLimit)
          return {
            ok: false,
            message: `The combined notebook would have ${review.plan.document.entries.length} entries; the limit is ${review.plan.entryLimit}. Nothing was merged. Leave incoming versions out or export and make room first.`,
          };
        const document = port.admit(review.plan.document);
        const outcome = port.commit(document, reviews.get(review)?.lease);
        if (outcome.ok) reviews.delete(review);
        return outcome;
      } catch (error) {
        return failed(error);
      }
    },
    cancelMerge(review: NotebookMergeReview) {
      reviews.delete(review);
    },
  });
}
