/**
 * Three forms of sharing with an enforced payload boundary.
 * Specification: am-inst-permalink-tape-s677, AGENTS.md
 *
 * Requirements:
 * 1. ONE ALLOW-LIST, THREE FORMS: SHARE_FORMS is frozen data with ZERO IMPORTS.
 * 2. Each control names its form.
 * 3. No form carries another's payload (passage link has no tape, permalink has no notebook id).
 * 4. Free text never enters a URL.
 * 5. Filenames / local media references are private and never serialized.
 * 6. Canonical treatment per form (passage link is document URL, experiment permalink is noindex/canonical).
 */

export type ShareFormId = "passage-link" | "experiment-preset" | "notebook-export";

export type ShareFormSpec = Readonly<{
  id: ShareFormId;
  name: string;
  label: string;
  admittedParameters: readonly string[];
  admittedAnchorKinds: readonly string[];
  admittedPayloadFields: readonly string[];
  freeTextAllowed: boolean;
  localMediaAllowed: boolean;
  producesUrl: boolean;
  indexingDirective: "index" | "noindex" | "none";
}>;

export const SHARE_FORMS = Object.freeze({
  "passage-link": Object.freeze({
    id: "passage-link",
    name: "Passage link",
    label: "Copy a link to this passage",
    admittedParameters: Object.freeze(["view", "detail", "lens", "notation", "units"]),
    admittedAnchorKinds: Object.freeze([
      "section",
      "paragraph",
      "sentence",
      "equation",
      "result",
      "argument",
      "lab",
      "entry",
    ]),
    admittedPayloadFields: Object.freeze([]),
    freeTextAllowed: false,
    localMediaAllowed: false,
    producesUrl: true,
    indexingDirective: "index",
  }),
  "experiment-preset": Object.freeze({
    id: "experiment-preset",
    name: "Experiment preset",
    label: "Copy link to this experiment state",
    admittedParameters: Object.freeze(["tape"]),
    admittedAnchorKinds: Object.freeze([]),
    admittedPayloadFields: Object.freeze([
      "tapeVersion",
      "experimentId",
      "mode",
      "modelIdentity",
      "constantSetId",
      "seed",
      "streamVersion",
      "allocationId",
      "replayGrid",
      "initialConditions",
      "presetId",
      "events",
      "predictions",
      "teachingTapeRef",
      "acceptedCheckpoint",
      "title",
      "description",
    ]),
    freeTextAllowed: false,
    localMediaAllowed: false,
    producesUrl: true,
    indexingDirective: "noindex",
  }),
  "notebook-export": Object.freeze({
    id: "notebook-export",
    name: "Notebook or replay export",
    label: "Export your notebook",
    admittedParameters: Object.freeze([]),
    admittedAnchorKinds: Object.freeze([]),
    admittedPayloadFields: Object.freeze([
      "entries",
      "notes",
      "tapes",
      "predictions",
      "pinnedPredictions",
      "freeText",
      "exportTimestamp",
      "schemaVersion",
    ]),
    freeTextAllowed: true,
    localMediaAllowed: false,
    producesUrl: false,
    indexingDirective: "none",
  }),
} as const satisfies Record<ShareFormId, ShareFormSpec>);

export class ShareFormError extends Error {
  readonly formId: string;
  readonly code:
    | "unknown-form"
    | "unadmitted-parameter"
    | "unadmitted-anchor"
    | "unadmitted-payload-field"
    | "free-text-refused"
    | "media-leak-refused";

  constructor(
    formId: string,
    code:
      | "unknown-form"
      | "unadmitted-parameter"
      | "unadmitted-anchor"
      | "unadmitted-payload-field"
      | "free-text-refused"
      | "media-leak-refused",
    message: string,
  ) {
    super(`[ShareForm:${formId}] ${message} (${code})`);
    this.name = "ShareFormError";
    this.formId = formId;
    this.code = code;
  }
}

export function getShareFormSpec(formId: string): ShareFormSpec {
  if (!Object.hasOwn(SHARE_FORMS, formId)) {
    throw new ShareFormError(
      formId,
      "unknown-form",
      `Share form "${formId}" is not declared in SHARE_FORMS allow-list.`,
    );
  }
  return SHARE_FORMS[formId as ShareFormId];
}

/**
 * Validates that query parameters emitted by a share form match its admitted list.
 */
export function validateShareParameters(
  formId: string,
  params: Record<string, unknown> | URLSearchParams | readonly string[],
): { valid: boolean; errors: readonly string[] } {
  const spec = getShareFormSpec(formId);
  const admitted = new Set<string>(spec.admittedParameters);
  const paramKeys =
    params instanceof URLSearchParams
      ? Array.from(params.keys())
      : Array.isArray(params)
        ? params
        : Object.keys(params);

  const errors: string[] = [];
  for (const key of paramKeys) {
    if (!admitted.has(key)) {
      errors.push(
        `Parameter "${key}" is not admitted by share form "${spec.id}" (admitted: ${spec.admittedParameters.join(", ") || "none"}).`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates anchor kind for a passage link.
 */
export function validateShareAnchor(
  formId: string,
  anchor: string,
): { valid: boolean; errors: readonly string[] } {
  const spec = getShareFormSpec(formId);
  if (spec.id !== "passage-link") {
    if (anchor && anchor !== "") {
      return {
        valid: false,
        errors: [`Share form "${spec.id}" does not admit anchors.`],
      };
    }
    return { valid: true, errors: [] };
  }

  const clean = anchor.startsWith("#") ? anchor.slice(1) : anchor;
  if (!clean) return { valid: true, errors: [] };

  // Anchor kinds:
  // - section / paragraph / sentence: s<num>, s<num>-p<num>, s<num>-p<num>-s<num>
  // - equation: eq-<id>
  // - result: result-<id>
  // - argument: arg-<id>
  // - lab: lab-<id>
  // - entry: entry-<paper>
  const match =
    /^(?:s\d+(?:-p\d+(?:-s\d+)?)?|eq-[a-z0-9-]+|result-[a-z0-9-]+|arg-[a-z0-9-]+|lab-[a-z0-9-]+|entry-[a-z0-9-]+)$/.test(
      clean,
    );

  if (!match) {
    return {
      valid: false,
      errors: [`Anchor "${anchor}" does not match any admitted anchor kind for "${spec.id}".`],
    };
  }
  return { valid: true, errors: [] };
}

const LOCAL_MEDIA_PATTERN =
  /(?:blob:|data:|file:\/\/|\.(?:png|jpe?g|gif|webp|mp4|mov|webm|avi|mkv|wav|mp3|tiff?|raw)$|\/(?:Users|home|tmp|var|private|Volumes)\/)/i;

/**
 * Validates that no free-text or local-media leaks appear in a share action.
 */
export function assertShareFormNoLeaks(
  formId: string,
  data: {
    readonly params?: Record<string, unknown> | URLSearchParams | undefined;
    readonly payload?: Record<string, unknown> | undefined;
    readonly freeTextValues?: Record<string, unknown> | undefined;
    readonly mediaValues?: Record<string, unknown> | undefined;
  },
): void {
  const spec = getShareFormSpec(formId);

  // 1. Parameter allow-list
  if (data.params) {
    const paramCheck = validateShareParameters(formId, data.params);
    if (!paramCheck.valid) {
      throw new ShareFormError(formId, "unadmitted-parameter", paramCheck.errors.join("; "));
    }
  }

  // 2. Payload field allow-list
  if (data.payload) {
    const admitted = new Set<string>(spec.admittedPayloadFields);
    for (const key of Object.keys(data.payload)) {
      if (!admitted.has(key)) {
        throw new ShareFormError(
          formId,
          "unadmitted-payload-field",
          `Payload field "${key}" is not admitted by share form "${spec.id}".`,
        );
      }
    }
  }

  // 3. Free text refusal for URL-producing forms
  if (!spec.freeTextAllowed && data.freeTextValues) {
    for (const [key, val] of Object.entries(data.freeTextValues)) {
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        throw new ShareFormError(
          formId,
          "free-text-refused",
          `Free-text value in field "${key}" cannot be serialized into shareable URL form "${spec.id}".`,
        );
      }
    }
  }

  // 4. Media leakage refusal for all forms
  if (data.mediaValues) {
    for (const [key, val] of Object.entries(data.mediaValues)) {
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        throw new ShareFormError(
          formId,
          "media-leak-refused",
          `Local media reference in field "${key}" (${String(val)}) cannot be serialized into share form "${spec.id}".`,
        );
      }
    }
  }

  // Deep scan payload for media URLs/filenames
  if (data.payload) {
    scanObjectForMedia(data.payload, formId);
  }
}

function scanObjectForMedia(obj: unknown, formId: string, path = "payload"): void {
  if (typeof obj === "string") {
    if (LOCAL_MEDIA_PATTERN.test(obj)) {
      throw new ShareFormError(
        formId,
        "media-leak-refused",
        `Potential local media path or URL found at "${path}": ${obj}`,
      );
    }
    return;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      scanObjectForMedia(obj[i], formId, `${path}[${i}]`);
    }
    return;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (/^(?:fileName|filePath|blobUrl|objectUrl|localPath|mediaPath)$/i.test(k)) {
        if (v !== undefined && v !== null && String(v).trim() !== "") {
          throw new ShareFormError(
            formId,
            "media-leak-refused",
            `Local media property "${k}" is forbidden in share form "${formId}".`,
          );
        }
      }
      scanObjectForMedia(v, formId, `${path}.${k}`);
    }
  }
}
