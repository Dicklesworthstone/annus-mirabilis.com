import { refusalSentence } from "../../experiments/results/refusalSentence.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import type { InferenceEvidence } from "./evidence.ts";
import { RADIUS_DEFAULTS, RADIUS_EXAMPLE } from "./model.ts";
import { type InferenceExample, renderCameraResults, renderRadiusResults } from "./render.ts";
import { createCameraInferenceSession, createRadiusSession } from "./session.ts";

function required<T extends Element>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new TypeError(`Missing inference control: ${selector}.`);
  return element;
}
function enableFields(root: HTMLElement) {
  const fieldsets = [...root.querySelectorAll<HTMLFieldSetElement>("fieldset")];
  fieldsets.forEach((fieldset) => {
    fieldset.disabled = false;
  });
  return () => {
    fieldsets.forEach((fieldset) => {
      fieldset.disabled = true;
    });
  };
}
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
  section.dataset.acceptedInputRevision = String(snapshot.revisions.input);
  section.dataset.estimatorRevision = String(snapshot.revisions.estimator);
  const label = section.querySelector<HTMLElement>("[data-infer-label]");
  if (label) label.textContent = "Accepted inference · host calculation";
  announce(section, "", true);
}

function mountRadiusCase(radiusRoot: HTMLElement, evidence: InferenceEvidence, uid: string) {
  const radius = createRadiusSession(`${uid}-radius`, evidence);
  const form = required<HTMLFormElement>(radiusRoot, "[data-radius-form]");
  const fields = new Map(
    [...form.querySelectorAll<HTMLInputElement>("[data-radius-field]")].map((input) => [
      input.name,
      input,
    ]),
  );
  const draft = required<HTMLElement>(radiusRoot, "[data-radius-draft]");
  const worked = required<HTMLButtonElement>(radiusRoot, "[data-radius-worked]");
  const remove = required<HTMLButtonElement>(radiusRoot, "[data-radius-remove]");
  if (fields.size !== 5) throw new TypeError("Incomplete inference controls.");
  const disableFields = enableFields(radiusRoot);
  function numeric(name: string, factor: number) {
    const text = fields.get(name)?.value.trim() ?? "";
    return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/u.test(text) ? Number(text) * factor : NaN;
  }
  function applyRadius(parameters: unknown) {
    const outcome = radius.apply(parameters);
    if (outcome.kind !== "accepted") {
      /**
       * THE SENTENCE STAYS A SENTENCE, AND THE CODE REACHES THE DOM (am-ig23).
       *
       * This is the one flattening site where the string was not simply a mistake: `announce`
       * writes into a live region, and a live region genuinely takes text. What was lost is the
       * refusal's IDENTITY, so that is what is restored, as an attribute beside the announcement
       * rather than by passing a typed failure into `announce`. The module already publishes its
       * identities this way (executionLabel, runId, snapshotVersion a few lines up).
       *
       * NOT `applyFailure`, deliberately, although it is the canonical discriminator and is used by
       * every component converted under this bead. It knows `accepted`, `refused` and an execution
       * outcome, and this session has a FOURTH kind: `no-value`, whose `reason` is the only sentence
       * a reader would get. applyFailure would classify that as `unexplained` and replace the reason
       * with its generic text, which is a regression dressed as a conversion. `refusalSentence` is
       * used for the refused arm, which also fixes the non-string `requirements` hazard that the
       * String() call papered over.
       *
       * This is payment rather than evasion of the ratchet's pattern: the pattern stops matching
       * because the flattening is gone, and the code the flattening destroyed is now observable.
       */
      const message =
        outcome.kind === "refused"
          ? refusalSentence(outcome.refusal)
          : outcome.kind === "no-value"
            ? outcome.reason
            : outcome.outcome.message;
      radiusRoot.dataset.applyFailure = outcome.kind;
      if (outcome.kind === "refused") radiusRoot.dataset.refusalCode = outcome.refusal.code;
      else delete radiusRoot.dataset.refusalCode;
      announce(radiusRoot, `${message} The previous accepted result is unchanged.`, true);
      return;
    }
    delete radiusRoot.dataset.applyFailure;
    delete radiusRoot.dataset.refusalCode;
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
  form.addEventListener("submit", submit);
  form.addEventListener("input", edit);
  worked.addEventListener("click", useWorked);
  remove.addEventListener("click", removeRadius);
  return () => {
    form.removeEventListener("submit", submit);
    form.removeEventListener("input", edit);
    worked.removeEventListener("click", useWorked);
    remove.removeEventListener("click", removeRadius);
    disableFields();
  };
}
function mountCameraCase(cameraRoot: HTMLElement, evidence: InferenceEvidence, uid: string) {
  const camera = createCameraInferenceSession(`${uid}-camera`, evidence);
  const radios = [...cameraRoot.querySelectorAll<HTMLInputElement>("[data-camera-information]")];
  if (radios.length !== 3) throw new TypeError("Incomplete inference controls.");
  const disableFields = enableFields(cameraRoot);
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
  radios.forEach((radio) => {
    radio.addEventListener("change", change);
  });
  return () => {
    radios.forEach((radio) => {
      radio.removeEventListener("change", change);
    });
    disableFields();
  };
}

/** Scoped enhancement. No observation regeneration, persistence, URL writes or requests. */
export function mountInferenceWorkbench(
  root: HTMLElement,
  example: InferenceExample,
  uid: string,
): () => void {
  const disposeRadius = mountRadiusCase(
    required(root, '[data-infer-case="radius"]'),
    example.ideal,
    uid,
  );
  const disposeCamera = mountCameraCase(
    required(root, '[data-infer-case="camera"]'),
    example.camera,
    uid,
  );
  root.dataset.ready = "true";
  return () => {
    disposeRadius();
    disposeCamera();
    root.dataset.ready = "false";
  };
}
export function mountInferenceCase(
  root: HTMLElement,
  evidence: InferenceEvidence,
  uid: string,
): () => void {
  const dispose =
    evidence.kind === "ideal"
      ? mountRadiusCase(required(root, '[data-infer-case="radius"]'), evidence, uid)
      : mountCameraCase(required(root, '[data-infer-case="camera"]'), evidence, uid);
  root.dataset.ready = "true";
  return () => {
    dispose();
    root.dataset.ready = "false";
  };
}
