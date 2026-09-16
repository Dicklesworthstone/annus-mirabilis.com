"use client";
import { useEffect } from "react";
import { DETAIL_STORAGE_KEY, FACES, MAX_CLARIFICATION_DEPTH, openFoundation, parseDetail, parseReaderLocation, passageHref, readerHref, restoreReaderState, type Face, type ReaderRegistry, type ReaderState } from "./navigation/state";
type Props = { registry: ReaderRegistry; titles: Readonly<Record<string, string>>; questions: Readonly<Record<string, string>> };
/** Only navigation metadata crosses this island. Prose, math and laboratory subtrees stay mounted. */
export function ReaderController({ registry, titles, questions }: Props) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-reader-root]")!;
    const dialog = root.querySelector<HTMLDialogElement>("[data-clarification-dialog]")!;
    const announcement = root.querySelector<HTMLElement>("[data-reader-announcement]")!;
    const detailControls = [...root.querySelectorAll<HTMLSelectElement>("[data-detail-control]")];
    const lensControls = [...root.querySelectorAll<HTMLInputElement>("[data-lens-control]")];
    let stored: string | null = null; try { stored = localStorage.getItem(DETAIL_STORAGE_KEY); } catch { /* Reading works without storage. */ }
    let state = restoreReaderState(history.state?.annusReader?.state, registry) ?? parseReaderLocation(location.search, location.hash, registry, stored);
    let index = Number.isSafeInteger(history.state?.annusReader?.index) ? history.state.annusReader.index as number : 0;
    let trigger = 0;
    root.dataset.enhanced = "true"; [...detailControls, ...lensControls].forEach(control => { control.disabled = false; });
    function url() { const u = new URL(readerHref(registry, state), location.origin); u.pathname = location.pathname; return u.pathname + u.search + u.hash; }
    function save(push = false) {
      const next = { ...history.state, annusReader: { state, index: push ? ++index : index } };
      if (push) history.pushState(next, "", url()); else history.replaceState(next, "", url());
    }
    function focusReturn(previous: ReaderState) {
      const frame = previous.frames[state.frames.length];
      const target = (frame?.triggerId ? document.getElementById(frame.triggerId) : null) ?? document.getElementById(state.anchor);
      if (!target) return;
      target.focus({ preventScroll: true });
      const behavior = document.documentElement.style.scrollBehavior; document.documentElement.style.scrollBehavior = "auto";
      const delta = target.getBoundingClientRect().top - (frame?.relativeY ?? 0.15) * innerHeight;
      if (dialog.open && dialog.contains(target)) dialog.scrollTop += delta; else window.scrollBy(0, delta);
      document.documentElement.style.scrollBehavior = behavior;
    }
    function render(previous?: ReaderState, message = "") {
      document.documentElement.dataset.detail = String(state.detail);
      document.documentElement.dataset.lens = state.lens ? "modern" : "paper";
      document.documentElement.dataset.readerView = state.view;
      detailControls.forEach(control => { control.value = String(state.detail); }); lensControls.forEach(control => { control.checked = state.lens; });
      root.querySelectorAll<HTMLElement>("[data-view-link]").forEach(a => { if (a.dataset.viewLink === state.view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
      const frame = state.frames.at(-1);
      for (const panel of root.querySelectorAll<HTMLElement>("[data-foundation-panel]")) panel.hidden = panel.dataset.foundationPanel !== frame?.foundationId;
      if (frame) {
        const heading = root.querySelector<HTMLElement>(`[data-foundation-panel="${frame.foundationId}"] h2`)!;
        dialog.setAttribute("aria-labelledby", heading.id);
        root.querySelector<HTMLElement>("[data-compass-question]")!.textContent = questions[state.anchor] ?? "The Brownian displacement argument";
        root.querySelector<HTMLElement>("[data-compass-idea]")!.textContent = titles[frame.foundationId] ?? frame.foundationId;
        if (!dialog.open) dialog.showModal();
        if (!previous || previous.frames.at(-1)?.foundationId !== frame.foundationId || previous.frames.length !== state.frames.length) {
          if (previous && previous.frames.length > state.frames.length) focusReturn(previous); else heading.focus();
        }
      } else {
        if (dialog.open) dialog.close();
        if (previous?.frames.length) focusReturn(previous);
      }
      if (message) announcement.textContent = message;
    }
    function change(next: ReaderState, push: boolean, message: string) { const previous = state; state = next; save(push); render(previous, message); }
    function closeOne() {
      if (!state.frames.length) return;
      if (index > 0) history.back();
      else change({ ...state, frames: state.frames.slice(0, -1) }, false, "Returned to the argument.");
    }
    const cancel = (event: Event) => { event.preventDefault(); closeOne(); };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
      const control = event.target.closest<HTMLElement>("[data-foundation],[data-view-link],[data-reader-anchor],[data-reader-back],[data-reader-close],[data-copy-passage]");
      if (!control || !root.contains(control)) return;
      if (control.hasAttribute("data-foundation")) {
        const id = control.dataset.foundation!; if (!registry.foundations.includes(id)) return;
        event.preventDefault();
        const anchor = control.closest<HTMLElement>(".reader-passage")?.id ?? state.anchor;
        if (!control.id) control.id = `reader-trigger-${++trigger}`;
        const base = { ...state, anchor };
        change(openFoundation(base, { foundationId: id, triggerId: control.id, relativeY: control.getBoundingClientRect().top / innerHeight }, registry), state.frames.length < MAX_CLARIFICATION_DEPTH, state.frames.length === MAX_CLARIFICATION_DEPTH ? "The deepest explanation was replaced; return to the argument is still available." : `Opened ${titles[id]}.`);
      } else if (control.dataset.viewLink && FACES.includes(control.dataset.viewLink as Face)) {
        event.preventDefault(); change({ ...state, view: control.dataset.viewLink as Face }, true, "Changed the reading face; the passage and laboratory are preserved.");
      } else if (control.dataset.readerAnchor && registry.anchors.includes(control.dataset.readerAnchor)) {
        event.preventDefault(); change({ ...state, anchor: control.dataset.readerAnchor, frames: [] }, true, "Moved to the selected passage."); document.getElementById(state.anchor)?.scrollIntoView();
      } else if (control.hasAttribute("data-reader-back")) { event.preventDefault(); closeOne(); }
      else if (control.hasAttribute("data-reader-close")) { event.preventDefault(); change({ ...state, frames: [] }, false, "Returned to the exact step."); }
      else if (control.dataset.copyPassage && registry.anchors.includes(control.dataset.copyPassage)) {
        event.preventDefault(); const href = new URL(passageHref(registry, { ...state, anchor: control.dataset.copyPassage }), location.origin).href;
        const fallback = () => { const box = root.querySelector<HTMLElement>("[data-copy-fallback]")!; box.hidden = false; const input = box.querySelector("input")!; input.value = href; input.focus(); input.select(); announcement.textContent = "Copy the passage link from the selected field."; };
        if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(href).then(() => { announcement.textContent = "Passage link copied."; }, fallback); else fallback();
      }
    };
    const changeControl = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement && detailControls.includes(target)) {
        const detail = parseDetail(target.value) ?? 1;
        try { localStorage.setItem(DETAIL_STORAGE_KEY, String(detail)); } catch { /* Optional preference persistence. */ }
        change({ ...state, detail }, false, "Changed detail without restarting the laboratory or closing your explanation.");
      } else if (target instanceof HTMLInputElement && lensControls.includes(target)) change({ ...state, lens: target.checked }, false, target.checked ? "Modern qualifications are shown beside the explanation." : "Modern qualifications are hidden.");
    };
    const pop = () => {
      const previous = state, restored = restoreReaderState(history.state?.annusReader?.state, registry) ?? parseReaderLocation(location.search, location.hash, registry);
      state = { ...restored, detail: state.detail }; index = Number.isSafeInteger(history.state?.annusReader?.index) ? history.state.annusReader.index : 0;
      save(); render(previous, state.frames.length ? `Returned to ${titles[state.frames.at(-1)!.foundationId]}.` : "Returned to the argument.");
    };
    root.addEventListener("click", click); root.addEventListener("change", changeControl); dialog.addEventListener("cancel", cancel); window.addEventListener("popstate", pop);
    save(); render();
    return () => { root.removeEventListener("click", click); root.removeEventListener("change", changeControl); dialog.removeEventListener("cancel", cancel); window.removeEventListener("popstate", pop); };
  }, [registry, titles, questions]);
  return <div className="reader-controls">
    <nav aria-label="Reading face"><a href="?view=reading" data-view-link="reading">Explanation</a><a href="?view=results" data-view-link="results">Argument synopsis</a><a href="?view=german" data-view-link="german">Source status</a></nav>
    <div className="reader-options"><label>Detail<select data-detail-control defaultValue="1" disabled><option value="0">Overview</option><option value="1">Full explanation</option><option value="2">Show every step</option></select></label><label className="check"><input type="checkbox" data-lens-control disabled/>Show modern qualifications</label></div>
    <p className="reader-announcement fine" role="status" aria-live="polite" aria-atomic="true" data-reader-announcement/>
    <label className="share-field" data-copy-fallback hidden>Passage link<input readOnly/></label>
  </div>;
}
