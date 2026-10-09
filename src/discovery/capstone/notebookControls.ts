import {
  type CapstoneRestoreReview,
  type CaptureEquation,
  capstoneCaptureText,
  captureCapstone,
  confirmCapstoneRestore,
  reviewCapstoneRestore,
} from "../../reader/notebook/capstoneEntry.ts";
import type { NotebookStore } from "../../reader/notebook/notebookStore.ts";
import type { NotebookCapstoneEntry } from "../../reader/notebook/schema.ts";
import type { Capstone } from "./capstoneSchema.ts";
import { exportWorksheet, type WorksheetState } from "./worksheetState.ts";

type CaptureStore = Pick<
  NotebookStore,
  "open" | "getSnapshot" | "subscribe" | "add" | "checkForExternalChange"
>;
export type NotebookWorksheetContext = Readonly<{
  capstone(): Capstone;
  worksheet(): WorksheetState;
  equations(): readonly CaptureEquation[];
  restore(worksheet: WorksheetState): void;
  download(text: string, filename: string): void;
}>;

/** Keep the existing notebook owner: no second storage key or background copying of private work. */
export function saveCapstoneSnapshot(
  store: CaptureStore,
  capstone: Capstone,
  worksheet: WorksheetState,
  equations: readonly CaptureEquation[],
  identity: Readonly<{ id: string; createdAt: string }>,
): Readonly<{ ok: boolean; message: string }> {
  try {
    store.open();
    const capture = captureCapstone(capstone, worksheet, equations);
    const serialized = JSON.stringify(capture);
    const duplicate = store
      .getSnapshot()
      .document.entries.some(
        (entry) => entry.kind === "capstone" && JSON.stringify(entry.capstone) === serialized,
      );
    if (duplicate)
      return {
        ok: true,
        message: `This attempt is already in your notebook. ${store.getSnapshot().message}`,
      };
    const first = capstone.claims[0];
    if (!first)
      return {
        ok: false,
        message: "This capstone has no source passage to save with the attempt.",
      };
    const result = store.add({
      id: identity.id,
      createdAt: identity.createdAt,
      kind: "capstone",
      frame: {
        paper: capture.paper,
        anchor: first.anchor,
        view: "parallel",
        detail: 1,
        lens: "paper",
        open: "",
      },
      title: capstone.title,
      text: "",
      capstone: capture,
    });
    return { ok: result.ok, message: result.ok ? store.getSnapshot().message : result.message };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "The snapshot could not be saved. Your worksheet is unchanged.",
    };
  }
}

/** Imperative island, matching the notebook itself. It never replaces work just by opening a preview. */
export function mountCapstoneNotebook(
  host: HTMLElement,
  store: CaptureStore,
  context: NotebookWorksheetContext,
): Readonly<{ dispose(): void }> {
  const doc = host.ownerDocument;
  function node<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text = "",
  ): HTMLElementTagNameMap[K] {
    const element = doc.createElement(tag);
    element.textContent = text;
    return element;
  }
  const root = node("section");
  root.setAttribute("aria-label", "Capstone notebook snapshots");
  const heading = node("h3", "Attempts in your notebook");
  heading.tabIndex = -1;
  const message = node("p");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  const persistence = node("p");
  const list = node("div");
  const preview = node("section");
  preview.hidden = true;
  preview.setAttribute("aria-label", "Review a saved capstone attempt");
  let disposed = false;
  let selected: { id: string; review: CapstoneRestoreReview } | null = null;
  let renderedEntries: unknown = null;
  function button(label: string, action: () => void) {
    const element = node("button", label);
    element.type = "button";
    element.addEventListener("click", () => {
      if (!disposed) action();
    });
    return element;
  }
  function entries(): readonly NotebookCapstoneEntry[] {
    return store
      .getSnapshot()
      .document.entries.filter(
        (entry): entry is NotebookCapstoneEntry =>
          entry.kind === "capstone" && entry.capstone.paper === context.capstone().paper,
      );
  }
  function renderPreview(focus = false) {
    preview.replaceChildren();
    preview.hidden = selected === null;
    if (!selected) return;
    const held = selected;
    const title = node("h4", "The attempt you selected");
    title.tabIndex = -1;
    const words = node("pre", capstoneCaptureText(held.review.capture));
    words.style.whiteSpace = "pre-wrap";
    words.style.overflowWrap = "anywhere";
    const warning = node(
      "p",
      "Replace this tab's worksheet with this attempt? Export your current worksheet first to keep both. Reference wording may have changed since the snapshot was saved. The notebook copy will not be changed.",
    );
    const saved = entries().find((entry) => entry.id === held.id)?.capstone;
    const eligibility = confirmCapstoneRestore(
      held.review,
      context.worksheet(),
      saved,
      context.capstone(),
    );
    const restore = button("Replace worksheet with this snapshot", () => {
      // Confirmation is tied to both versions the reader reviewed, not merely to an entry id.
      const latest = entries().find((entry) => entry.id === held.id)?.capstone;
      const outcome = confirmCapstoneRestore(
        held.review,
        context.worksheet(),
        latest,
        context.capstone(),
      );
      if (!outcome.ok) {
        message.textContent = outcome.message;
        return;
      }
      context.restore(outcome.worksheet);
      selected = null;
      renderPreview();
      message.textContent =
        "Snapshot restored to this tab. The worksheet's saving status is shown above. Your notebook copy is unchanged.";
      heading.focus();
    });
    restore.disabled = !eligibility.ok;
    preview.append(title, words, warning);
    if (!eligibility.ok) preview.append(node("p", eligibility.message));
    preview.append(
      restore,
      button("Export the selected worksheet", () =>
        context.download(exportWorksheet(held.review.capture.worksheet), "capstone-worksheet.json"),
      ),
      button("Cancel snapshot review", () => {
        selected = null;
        renderPreview();
        heading.focus();
      }),
    );
    if (focus) title.focus();
  }
  const save = button("Save a snapshot to notebook", () => {
    try {
      const crypto = doc.defaultView?.crypto;
      if (!crypto) {
        message.textContent =
          "This browser cannot create a private snapshot identity. Export the worksheet instead.";
        return;
      }
      const id =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `capstone-${Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      const result = saveCapstoneSnapshot(
        store,
        context.capstone(),
        context.worksheet(),
        context.equations(),
        { id, createdAt: new Date().toISOString() },
      );
      message.textContent = result.message;
    } catch {
      message.textContent =
        "This browser could not create the snapshot. Your worksheet is unchanged; export it to keep a copy.";
    }
  });
  const notebook = node("a", "Open the complete notebook to export, import or combine attempts");
  notebook.href = "/notebook/";
  root.append(
    heading,
    node(
      "p",
      "A snapshot keeps this attempt separately from your working worksheet. Nothing is copied until you press Save. You can keep several attempts and review one before restoring it.",
    ),
    save,
    message,
    persistence,
    list,
    preview,
    notebook,
  );
  host.append(root);
  function render() {
    const state = store.getSnapshot();
    persistence.textContent = state.message;
    if (renderedEntries === state.document.entries) return;
    renderedEntries = state.document.entries;
    list.replaceChildren();
    const snapshots = [...entries()].reverse();
    if (!snapshots.length)
      list.append(node("p", "No snapshots for this paper are in this notebook yet."));
    for (const entry of snapshots) {
      const article = node("article");
      article.append(node("h4", entry.title), node("p", `Saved ${entry.createdAt}`));
      if (entry.text) article.append(node("p", entry.text));
      article.append(
        button(`Review snapshot from ${entry.createdAt}`, () => {
          selected = {
            id: entry.id,
            review: reviewCapstoneRestore(entry.capstone, context.worksheet()),
          };
          message.textContent = "";
          renderPreview(true);
        }),
      );
      list.append(article);
    }
    renderPreview();
  }
  const check = () => store.checkForExternalChange();
  const win = doc.defaultView;
  store.open();
  const unsubscribe = store.subscribe(render);
  for (const event of ["storage", "pageshow", "focus"]) win?.addEventListener(event, check);
  render();
  heading.focus();
  return Object.freeze({
    dispose() {
      disposed = true;
      unsubscribe();
      for (const event of ["storage", "pageshow", "focus"]) win?.removeEventListener(event, check);
      root.remove();
    },
  });
}
