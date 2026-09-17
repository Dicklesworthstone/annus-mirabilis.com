import { exportNotebookHtml, exportNotebookJson } from "./export.ts";
import type { NotebookChange, NotebookStore } from "./notebookStore.ts";
import { notebookFrameHref, NOTEBOOK_LIMITS, NOTEBOOK_PAPERS, type NotebookEntry, type NotebookFrame } from "./schema.ts";

function node<K extends keyof HTMLElementTagNameMap>(tag: K, text = ""): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag); element.textContent = text; return element;
}
function button(label: string, action: () => void) {
  const element = node("button", label); element.type = "button"; element.className = "secondary";
  element.addEventListener("click", action); return element;
}
export const NOTEBOOK_KIND_LABELS = { question: "Question", example: "Example", nextStep: "Next step", note: "Note" } as const;
export type NotebookDraft = Readonly<{ frame: NotebookFrame; title: string }>;

/** Imperative island: private text never goes into server props, URLs, innerHTML or analytics. */
export function mountNotebookPanel(host: HTMLElement, store: NotebookStore, onClear: () => void = () => {}) {
  const dialog = node("dialog"); dialog.className = "notebook-dialog";
  const heading = node("h2", "Your reading notebook"); heading.id = "reading-notebook-title";
  dialog.setAttribute("aria-labelledby", heading.id);
  const intro = node("p", "Private notes on this device. Export important notes before clearing browser data or changing devices. Nothing is uploaded.");
  const close = button("Close notebook", () => { closePanel(); });
  const status = node("p"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); status.setAttribute("aria-atomic", "true");
  const error = node("p"); error.setAttribute("role", "alert");
  const controls = node("div"); controls.className = "actions";
  const form = node("form"); form.hidden = true; form.setAttribute("aria-label", "Write a reading note");
  const frameLabel = node("p"); const label = node("label", "Your note or question");
  const textarea = node("textarea"); textarea.rows = 5; textarea.maxLength = NOTEBOOK_LIMITS.text;
  textarea.id = "reading-notebook-text"; label.htmlFor = textarea.id;
  const save = node("button", "Save note"); save.type = "submit";
  const cancel = button("Cancel editing", () => { draft = null; editing = null; textarea.value = ""; form.hidden = true; close.focus(); });
  form.append(frameLabel, label, textarea, save, cancel);
  const confirmation = node("section"); confirmation.hidden = true; confirmation.setAttribute("aria-label", "Confirm notebook action");
  const list = node("div"); list.className = "notebook-entries";
  const recovery = button("Export preserved original", () => {
    const raw = store.getSnapshot().recoveryRaw;
    if (raw !== null) download(raw, "notebook-preserved-original.txt", "text/plain;charset=utf-8");
  });
  const retry = button("Retry saving", () => { report(store.retry()); });
  const load = button("Load saved notebook", () => confirm("Export any notes from this tab first. Loading the saved notebook replaces this tab's unsaved work.", () => {
    store.reloadConfirmed(); textarea.value = ""; form.hidden = true; draft = null; editing = null;
  }));
  const clear = button("Clear notebook", () => confirm("Clear all saved notes and the remembered reading place? Export first to keep a copy. Other settings and discovery notes are not changed.", () => {
    const result = store.clearConfirmed(); report(result);
    if (result.ok) {
      onClear(); textarea.value = ""; form.hidden = true; draft = null; editing = null;
      if (store.getSnapshot().persistence !== "saved") error.textContent = "This tab is empty, but saved data could not be cleared on this device. Retry saving when storage is available.";
    }
  }));
  controls.append(button("Export notebook JSON", () => download(exportNotebookJson(store.getSnapshot().document), "annus-reading-notebook.json", "application/json")),
    button("Export readable notebook", () => download(exportNotebookHtml(store.getSnapshot().document), "annus-reading-notebook.html", "text/html;charset=utf-8")),
    retry, recovery, load, clear);
  dialog.append(close, heading, intro, status, error, controls, confirmation, form, list); host.append(dialog);
  let previousFocus: HTMLElement | null = null, draft: NotebookDraft | null = null, editing: string | null = null;
  let renderedEntries: readonly NotebookEntry[] | null = null;
  const urls = new Map<string, ReturnType<typeof setTimeout>>();
  function report(result: NotebookChange) {
    error.textContent = result.ok ? "" : result.message;
    if (result.ok) status.textContent = store.getSnapshot().message;
  }
  function download(text: string, filename: string, type: string) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type })), link = node("a");
      link.href = url; link.download = filename; dialog.append(link); link.click(); link.remove();
      urls.set(url, setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); }, 1000));
      status.textContent = "Notebook export prepared locally. Keep the downloaded copy private.";
    } catch { error.textContent = "This browser could not download the notebook. Your notes remain here."; }
  }
  function confirm(message: string, action: () => void) {
    confirmation.replaceChildren(node("p", message), button("Confirm", () => {
      action(); confirmation.hidden = true; close.focus();
    }), button("Cancel", () => { confirmation.hidden = true; close.focus(); }));
    confirmation.hidden = false; confirmation.querySelector("button")?.focus();
  }
  function render() {
    const state = store.getSnapshot();
    status.textContent = state.message;
    dialog.dataset.persistence = state.persistence;
    retry.hidden = state.persistence !== "session-only";
    recovery.hidden = state.recoveryRaw === null;
    load.hidden = state.persistence !== "conflict";
    clear.disabled = state.persistence === "conflict";
    if (state.document.entries === renderedEntries) return;
    renderedEntries = state.document.entries;
    list.replaceChildren();
    if (!renderedEntries.length) list.append(node("p", "No entries yet. Open a paper and use Save question, Save example, or Add a note beside a passage."));
    for (const paper of NOTEBOOK_PAPERS) {
      const entries = renderedEntries.filter((entry) => entry.frame.paper === paper);
      if (!entries.length) continue;
      const section = node("section"); section.append(node("h3", paper.replaceAll("-", " ")));
      for (const entry of entries) {
        const article = node("article"); article.className = "notebook-entry";
        const link = node("a", entry.title); link.href = notebookFrameHref(entry.frame);
        link.addEventListener("click", (event) => {
          if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) closePanel();
        });
        const body = node("p", entry.text); body.className = "notebook-text";
        const edit = button("Edit note", () => {
          draft = { frame: entry.frame, title: entry.title }; editing = entry.id;
          frameLabel.textContent = entry.title; textarea.value = entry.text; save.textContent = "Save changes";
          form.hidden = false; textarea.focus();
        });
        edit.setAttribute("aria-label", `Edit ${NOTEBOOK_KIND_LABELS[entry.kind].toLowerCase()}: ${entry.title}`);
        const remove = button("Remove entry", () => confirm(`Remove the saved entry “${entry.title}”?`, () => { report(store.remove(entry.id)); }));
        article.append(node("h4", NOTEBOOK_KIND_LABELS[entry.kind]), link, body, edit, remove); section.append(article);
      }
      list.append(section);
    }
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault(); if (!draft) return;
    const result = editing ? store.updateText(editing, textarea.value) : add("note", draft.frame, draft.title, textarea.value);
    report(result);
    if (result.ok) { textarea.value = ""; draft = null; editing = null; form.hidden = true; close.focus(); }
  });
  function add(kind: NotebookEntry["kind"], frame: NotebookFrame, title: string, text: string): NotebookChange {
    try { return store.add({ id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `note-${Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")}`, kind, frame, title, text, createdAt: new Date().toISOString() }); }
    catch { return { ok: false, message: "This browser could not create the note. Your typed text is still available." }; }
  }
  function openPanel(nextDraft?: NotebookDraft) {
    store.open();
    if (!dialog.open) { previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null; dialog.showModal(); }
    render();
    if (nextDraft && !draft) { draft = nextDraft; editing = null; frameLabel.textContent = nextDraft.title; save.textContent = "Save note"; form.hidden = false; }
    if (draft) textarea.focus(); else close.focus();
  }
  function closePanel() {
    if (!dialog.open) return;
    dialog.close(); confirmation.hidden = true;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  const onCancel = (event: Event) => { event.preventDefault(); closePanel(); };
  dialog.addEventListener("cancel", onCancel);
  const unsubscribe = store.subscribe(render);
  return Object.freeze({
    open: openPanel,
    add,
    isOpen: () => dialog.open,
    dispose() {
      unsubscribe(); closePanel(); dialog.removeEventListener("cancel", onCancel); dialog.remove();
      for (const [url, timeout] of urls) { clearTimeout(timeout); URL.revokeObjectURL(url); }
      urls.clear();
    },
  });
}
