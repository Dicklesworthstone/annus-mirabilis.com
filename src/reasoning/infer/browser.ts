import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { RADIUS_DEFAULTS, RADIUS_EXAMPLE } from "./model.ts";
import { type InferenceExample, renderCameraResults, renderRadiusResults } from "./render.ts";
import { createCameraInferenceSession, createRadiusSession } from "./session.ts";

/** Scoped enhancement. No observation regeneration, persistence, URL writes or requests. */
export function mountInferenceWorkbench(
  root: HTMLElement,
  example: InferenceExample,
  uid: string,
): () => void {
  const radius = createRadiusSession(`${uid}-radius`, example.ideal);
  const camera = createCameraInferenceSession(`${uid}-camera`, example.camera);
  function required<T extends Element>(selector: string): T {
    const element = root.querySelector<T>(selector);
    if (!element) throw new TypeError(`Missing inference control: ${selector}.`);
    return element;
  }
  const radiusRoot = required<HTMLElement>('[data-infer-case="radius"]');
  const cameraRoot = required<HTMLElement>('[data-infer-case="camera"]');
  const form = required<HTMLFormElement>("[data-radius-form]");
  const fields = new Map(
    [...form.querySelectorAll<HTMLInputElement>("[data-radius-field]")].map((input) => [
      input.name,
      input,
    ]),
  );
  const draft = required<HTMLElement>("[data-radius-draft]");
  const worked = required<HTMLButtonElement>("[data-radius-worked]");
  const remove = required<HTMLButtonElement>("[data-radius-remove]");
  const radios = [...root.querySelectorAll<HTMLInputElement>("[data-camera-information]")];
  const fieldsets = [...root.querySelectorAll<HTMLFieldSetElement>("fieldset")];
  if (fields.size !== 5 || radios.length !== 3)
    throw new TypeError("Incomplete inference controls.");
  fieldsets.forEach((fieldset) => {
    fieldset.disabled = false;
  });
  root.dataset.ready = "true";
  function announce(section: HTMLElement, message: string, error = false) {
    const node = section.querySelector<HTMLElement>(
      error ? "[data-infer-error]" : "[data-infer-status]",
    );
    if (node) {
      node.textContent = message;
      if (error) node.hidden = !message;
    }
  }
  function refresh(section: HTMLElement, snapshot: AcceptedSnapshot, html: string) {
    const results = section.querySelector<HTMLElement>("[data-infer-results]");
    if (!results) throw new TypeError("Missing inference result panel.");
    const open = [
      ...results.querySelectorAll<HTMLDetailsElement>("details[open][data-preserve-detail]"),
    ].map((node) => node.dataset.preserveDetail);
    results.innerHTML = html;
    results.querySelectorAll<HTMLDetailsElement>("[data-preserve-detail]").forEach((node) => {
      node.open = open.includes(node.dataset.preserveDetail);
    });
    section.dataset.executionLabel = "host";
    section.dataset.runId = snapshot.runId;
    section.dataset.snapshotVersion = String(snapshot.snapshotVersion);
    section.dataset.inputRevision = String(snapshot.revisions.input);
    section.dataset.estimatorRevision = String(snapshot.revisions.estimator);
    const label = section.querySelector<HTMLElement>("[data-infer-label]");
    if (label) label.textContent = "Accepted inference · host calculation";
    announce(section, "", true);
  }
  function numeric(name: string, factor: number) {
    const text = fields.get(name)?.value.trim() ?? "";
    return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/u.test(text) ? Number(text) * factor : NaN;
  }
  function applyRadius(parameters: unknown) {
    const outcome = radius.apply(parameters);
    if (outcome.kind !== "accepted") {
      const message =
        outcome.kind === "refused"
          ? String(outcome.refusal.details?.requirements ?? outcome.refusal.message)
          : outcome.kind === "no-value"
            ? outcome.reason
            : outcome.outcome.message;
      announce(radiusRoot, `${message} The previous accepted result is unchanged.`, true);
      return;
    }
    const snapshot = outcome.data.accepted;
    if (!snapshot) throw new TypeError("Missing accepted radius inference.");
    refresh(radiusRoot, snapshot, renderRadiusResults(snapshot));
    draft.hidden = true;
    const interval = snapshot.outputs.find((output) => output.quantityId === "molecularInterval");
    announce(
      radiusRoot,
      snapshot.parameters.radiusKnown === false
        ? "Radius information removed. Molecular number is underdetermined; observations are unchanged."
        : interval?.status === "value"
          ? "Independent radius admitted. The conditional conservative interval is updated; observations are unchanged."
          : "Radius information recorded, but its declared coverage does not support the requested combined interval. Observations are unchanged.",
    );
  }
  const submit = (event: Event) => {
    event.preventDefault();
    applyRadius({
      ...RADIUS_EXAMPLE,
      radius: numeric("radius", 1e-6),
      radiusLower: numeric("radiusLower", 1e-6),
      radiusUpper: numeric("radiusUpper", 1e-6),
      radiusCoverage: numeric("radiusCoverage", 0.01),
      provenance: fields.get("provenance")?.value ?? "",
    });
  };
  const useWorked = () => {
    for (const [name, text] of Object.entries({
      radius: "0.5",
      radiusLower: "0.45",
      radiusUpper: "0.55",
      radiusCoverage: "97.5",
      provenance: RADIUS_EXAMPLE.provenance,
    })) {
      const field = fields.get(name);
      if (field) field.value = text;
    }
    applyRadius(RADIUS_EXAMPLE);
  };
  const removeRadius = () => applyRadius(RADIUS_DEFAULTS);
  const edit = () => {
    draft.hidden = false;
  };
  const change = (event: Event) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    const outcome = camera.apply({ information: target.value });
    if (outcome.kind !== "accepted") {
      announce(
        cameraRoot,
        "This information choice could not be accepted. The previous result is unchanged.",
        true,
      );
      const selected = camera.getSnapshot().accepted?.parameters.information;
      radios.forEach((radio) => {
        radio.checked = radio.value === selected;
      });
      return;
    }
    const snapshot = outcome.data.accepted;
    if (!snapshot) throw new TypeError("Missing accepted camera inference.");
    refresh(cameraRoot, snapshot, renderCameraResults(snapshot));
    announce(
      cameraRoot,
      target.value === "variance"
        ? "Variance alone: diffusion and noise are underdetermined. Observations are unchanged."
        : `${target.value === "covariance" ? "Neighboring covariance" : "A second spacing"} admitted. Point estimates updated without a confidence interval; observations are unchanged.`,
    );
  };
  form.addEventListener("submit", submit);
  form.addEventListener("input", edit);
  worked.addEventListener("click", useWorked);
  remove.addEventListener("click", removeRadius);
  radios.forEach((radio) => {
    radio.addEventListener("change", change);
  });
  return () => {
    form.removeEventListener("submit", submit);
    form.removeEventListener("input", edit);
    worked.removeEventListener("click", useWorked);
    remove.removeEventListener("click", removeRadius);
    radios.forEach((radio) => {
      radio.removeEventListener("change", change);
    });
    fieldsets.forEach((fieldset) => {
      fieldset.disabled = true;
    });
    root.dataset.ready = "false";
  };
}
