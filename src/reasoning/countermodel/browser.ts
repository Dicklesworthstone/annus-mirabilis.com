import { renderCountermodelResults } from "./render.ts";
import { createCountermodelSession, type PreparedCountermodelCase } from "./session.ts";

/** Enhance only this placement. No URLs, storage, analytics, or private reader state. */
export function mountCountermodelWorkbench(
  root: HTMLElement,
  example: PreparedCountermodelCase,
  uid: string,
): () => void {
  const session = createCountermodelSession(uid, example);
  const form = root.querySelector<HTMLFormElement>("[data-countermodel-form]");
  const input = root.querySelector<HTMLInputElement>("[data-observer-input]");
  const results = root.querySelector<HTMLElement>("[data-countermodel-results]");
  const status = root.querySelector<HTMLElement>("[data-workbench-status]");
  const error = root.querySelector<HTMLElement>("[data-workbench-error]");
  const draft = root.querySelector<HTMLElement>("[data-workbench-draft]");
  const label = root.querySelector<HTMLElement>("[data-execution-label]");
  const reset = root.querySelector<HTMLButtonElement>("[data-default-observer]");
  if (!form || !input || !results || !status || !error || !draft || !label || !reset)
    throw new TypeError("Incomplete countermodel markup.");
  const toggles = [...root.querySelectorAll<HTMLInputElement>("[data-test-toggle]")];
  const fieldsets = [...root.querySelectorAll<HTMLFieldSetElement>("fieldset")];
  fieldsets.forEach((fieldset) => {
    fieldset.disabled = false;
  });
  root.dataset.ready = "true";
  function refresh() {
    if (!results || !status || !label) return;
    const state = session.getSnapshot(),
      snapshot = state.view.accepted;
    if (!snapshot) return;
    const opened = new Set(
      [...results.querySelectorAll<HTMLDetailsElement>("details[open][data-cell-detail]")].map(
        (element) => element.dataset.cellDetail,
      ),
    );
    results.innerHTML = renderCountermodelResults(example.case, state, uid);
    results.querySelectorAll<HTMLDetailsElement>("details[data-cell-detail]").forEach((element) => {
      element.open = opened.has(element.dataset.cellDetail);
    });
    root.dataset.snapshotVersion = String(snapshot.snapshotVersion);
    root.dataset.runId = snapshot.runId;
    root.dataset.ownerEvaluations = String(session.getEvaluationCount());
    root.dataset.lastCommand = state.lastCommand;
    label.textContent = state.live
      ? "Accepted result · ideal model, host calculation"
      : "Static worked example · ideal model, host calculation";
    status.textContent = state.message;
  }
  const unsubscribe = session.subscribe(refresh);
  function apply(text: string) {
    if (!error || !draft || !input) return;
    const trimmed = text.trim();
    const numeric = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/u.test(trimmed)
      ? Number(trimmed)
      : NaN;
    const result = session.apply(numeric);
    error.hidden = result.ok;
    error.textContent = result.ok ? "" : result.message;
    if (result.ok) {
      input.value = String(numeric);
      draft.hidden = true;
    }
  }
  const submit = (event: Event) => {
    event.preventDefault();
    if (input) apply(input.value);
  };
  const edit = () => {
    if (draft) draft.hidden = false;
  };
  const restore = () => apply(String(example.case.defaultBeta));
  const change = (event: Event) => {
    const target = event.currentTarget;
    if (target instanceof HTMLInputElement && target.dataset.testToggle)
      session.toggle(target.dataset.testToggle, target.checked);
  };
  form.addEventListener("submit", submit);
  input.addEventListener("input", edit);
  reset.addEventListener("click", restore);
  toggles.forEach((toggle) => {
    toggle.addEventListener("change", change);
  });
  return () => {
    unsubscribe();
    form.removeEventListener("submit", submit);
    input.removeEventListener("input", edit);
    reset.removeEventListener("click", restore);
    toggles.forEach((toggle) => {
      toggle.removeEventListener("change", change);
    });
    fieldsets.forEach((fieldset) => {
      fieldset.disabled = true;
    });
    root.dataset.ready = "false";
  };
}
