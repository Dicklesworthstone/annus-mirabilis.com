import type {
  NotebookMergeChoices,
  NotebookMergeReview,
  NotebookReviewResult,
} from "./mergeReview.ts";
import type { NotebookStore } from "./notebookStore.ts";
import type { NotebookEntry } from "./schema.ts";

let sequence = 0;
const FIELD_NAMES: Readonly<Record<string, string>> = {
  kind: "entry type",
  title: "passage title",
  text: "note",
  createdAt: "creation time",
  frame: "reading location",
  replay: "saved comparison data",
};
type MergeStore = Pick<
  NotebookStore,
  "reviseMerge" | "refreshMerge" | "commitMerge" | "cancelMerge"
>;

/**
 * A review of private work, not a new notebook owner. Every value is textContent, including saved
 * comparison data. Neither expanding a comparison nor changing a choice runs or saves anything.
 * No nested form: this island also mounts inside the notebook's existing confirmation section.
 */
export function mountNotebookMergePanel(
  host: HTMLElement,
  store: MergeStore,
  initial: NotebookMergeReview,
  onApplied: () => void,
  onCancelled: () => void,
) {
  let review = initial;
  let disposed = false;
  let listeners = new AbortController();
  const prefix = `notebook-merge-${++sequence}`;
  const root = document.createElement("section");
  root.setAttribute("data-notebook-merge", initial.source);
  root.setAttribute("aria-label", "Review notebook merge");
  host.append(root);
  const openDetails = new Map<string, HTMLDetailsElement>();
  const choiceControls = new Map<string, HTMLInputElement>();
  let message: HTMLParagraphElement;

  function node<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text = "",
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  }
  function button(text: string, action: () => void): HTMLButtonElement {
    const element = node("button", text);
    element.type = "button";
    element.className = "secondary";
    element.addEventListener(
      "click",
      () => {
        if (!disposed) action();
      },
      { signal: listeners.signal },
    );
    return element;
  }
  function showEntry(entry: NotebookEntry, label: string): HTMLElement {
    const section = node("section");
    section.append(node("h4", label), node("p", entry.title));
    const text = node("p", entry.text || "No separate note was saved.");
    text.className = "notebook-text";
    section.append(
      text,
      node(
        "p",
        `Created ${entry.createdAt}. ${entry.frame.paper}, ${entry.frame.anchor}; ${entry.frame.view} view, detail ${entry.frame.detail}, ${entry.frame.lens} perspective.`,
      ),
    );
    if (entry.kind === "replay") {
      const details = node("details");
      details.append(
        node("summary", "Inspect the complete saved comparison data (does not run it)"),
      );
      const data = node("pre", JSON.stringify(entry.replay, null, 2));
      data.style.whiteSpace = "pre-wrap";
      data.style.overflowWrap = "anywhere";
      details.append(data);
      section.append(details);
    }
    return section;
  }
  function accept(result: NotebookReviewResult, focusId?: string) {
    if (!result.ok) {
      message.textContent = result.message;
      return;
    }
    review = result.review;
    render();
    if (focusId) choiceControls.get(focusId)?.focus();
  }
  function revise(choices: NotebookMergeChoices, focusId?: string) {
    accept(store.reviseMerge(review, choices), focusId);
  }
  function render() {
    const opened = new Set(
      [...openDetails].filter(([, details]) => details.open).map(([id]) => id),
    );
    listeners.abort();
    listeners = new AbortController();
    openDetails.clear();
    choiceControls.clear();
    root.replaceChildren();
    const plan = review.plan;
    const heading = node(
      "h3",
      review.source === "saved"
        ? "Combine this tab with the saved notebook"
        : "Review the notebook to import",
    );
    heading.tabIndex = -1;
    root.append(
      heading,
      node(
        "p",
        "Every entry already in this tab is kept unchanged. Edited incoming versions are kept as separate entries unless you explicitly leave them out. Nothing changes until you confirm below.",
      ),
    );
    if (review.savedWasCleared)
      root.append(
        node(
          "p",
          "The saved notebook was cleared. Confirming this merge will save this tab's retained entries again. Cancel to leave the cleared saved notebook alone.",
        ),
      );
    const summary = node(
      "p",
      `${plan.added} entries to add, including ${plan.keptBoth} separate edited versions; ${plan.duplicates} versions already present; ${plan.skipped} incoming versions left out. The combined notebook has ${plan.document.entries.length} of ${plan.entryLimit} entries.`,
    );
    summary.setAttribute("role", "status");
    summary.setAttribute("aria-live", "polite");
    root.append(summary);
    root.append(
      node(
        "p",
        plan.current.lastPlace
          ? "This tab's remembered reading place is kept."
          : plan.incoming.lastPlace
            ? "This tab has no remembered reading place; the incoming notebook's place will be kept."
            : "Neither notebook has a remembered reading place.",
      ),
    );
    if (!plan.withinLimit)
      root.append(
        node(
          "p",
          "This merge exceeds the notebook's entry limit and cannot be confirmed. Leave incoming edited versions out, or cancel and export your work before making room. No entries will be truncated.",
        ),
      );
    if (plan.conflicts.length) {
      const all = node("div");
      all.className = "actions";
      all.append(
        button("Keep both versions of every edited entry", () => revise(new Map())),
        button("Leave all incoming edited versions out", () =>
          revise(new Map(plan.conflicts.map((conflict) => [conflict.current.id, "keep-current"]))),
        ),
      );
      root.append(all);
      plan.conflicts.forEach((conflict, index) => {
        const details = node("details");
        details.open = opened.has(conflict.current.id);
        openDetails.set(conflict.current.id, details);
        details.append(
          node(
            "summary",
            `Edited entry: ${conflict.current.title}. Changed: ${conflict.changedFields.map((field) => FIELD_NAMES[field] ?? field).join(", ")}.`,
          ),
        );
        const versions = node("div");
        versions.style.display = "grid";
        versions.style.gridTemplateColumns = "repeat(auto-fit, minmax(min(100%, 18rem), 1fr))";
        versions.style.gap = "1rem";
        versions.append(
          showEntry(conflict.current, "This tab's version (always kept)"),
          showEntry(
            conflict.incoming,
            review.source === "saved"
              ? "Saved version from the other tab"
              : "Incoming file's version",
          ),
        );
        details.append(versions);
        root.append(details);
        // The choice stays outside the disclosure so no hidden control must be found to review it.
        const label = node(
          "label",
          ` Keep the incoming version of “${conflict.current.title}” as a separate entry`,
        );
        const choice = node("input");
        choice.type = "checkbox";
        choice.checked = conflict.choice === "keep-both";
        choice.id = `${prefix}-choice-${index}`;
        label.htmlFor = choice.id;
        choiceControls.set(conflict.current.id, choice);
        choice.addEventListener(
          "change",
          () => {
            if (disposed) return;
            const choices = new Map(plan.conflicts.map((item) => [item.current.id, item.choice]));
            choices.set(conflict.current.id, choice.checked ? "keep-both" : "keep-current");
            revise(choices, conflict.current.id);
          },
          { signal: listeners.signal },
        );
        label.prepend(choice);
        root.append(label);
      });
    }
    const additions = plan.document.entries.slice(plan.current.entries.length);
    if (additions.length) {
      const details = node("details");
      details.append(node("summary", `Inspect all ${additions.length} entries to add`));
      for (const entry of additions)
        details.append(
          showEntry(entry, entry.kind === "replay" ? "Saved comparison" : "Incoming note"),
        );
      root.append(details);
    }
    message = node("p");
    message.setAttribute("role", "alert");
    const actions = node("div");
    actions.className = "actions";
    const commit = button(
      review.source === "saved"
        ? "Confirm merge and save combined notebook"
        : "Confirm reviewed import",
      () => {
        const result = store.commitMerge(review);
        if (!result.ok) {
          message.textContent = result.message;
          return;
        }
        onApplied();
      },
    );
    commit.disabled = !plan.withinLimit;
    actions.append(
      commit,
      button("Refresh merge preview", () => {
        const next = store.refreshMerge(review);
        if (next.ok) openDetails.clear();
        accept(next);
        if (next.ok)
          message.textContent =
            "Preview refreshed. All edited versions are set to keep both again; review your choices before confirming.";
      }),
      button("Cancel merge", () => {
        store.cancelMerge(review);
        onCancelled();
      }),
    );
    root.append(message, actions);
  }
  render();
  root.querySelector("h3")?.focus();
  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true;
      store.cancelMerge(review);
      listeners.abort();
      root.remove();
    },
  });
}
