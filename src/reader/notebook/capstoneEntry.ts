/** A private reconstruction, including enough reference wording to read it after an edition changes. */
import type { Capstone } from "../../discovery/capstone/capstoneSchema.ts";
import {
  readWorksheet,
  type WorksheetState,
  worksheetMatches,
} from "../../discovery/capstone/worksheetState.ts";

export const CAPSTONE_CAPTURE_LIMITS = Object.freeze({ bytes: 196608, labels: 128, text: 10000 });
export const CAPSTONE_PAPERS = [
  "brownian-motion",
  "light-quanta",
  "special-relativity",
  "mass-energy",
] as const;
export type CapstonePaper = (typeof CAPSTONE_PAPERS)[number];
export type CapstoneCapture = Readonly<{
  schemaVersion: 1;
  paper: CapstonePaper;
  worksheet: WorksheetState;
  prompt: string;
  /** Wording as it was saved, not a substitute for the current edition or an answer key. */
  claims: Readonly<Record<string, string>>;
  assumptions: Readonly<Record<string, string>>;
  equations: Readonly<Record<string, string>>;
}>;
export type CaptureEquation = Readonly<{ equationId: string; title: string }>;

export class CapstoneCaptureError extends TypeError {
  readonly code = "notebook-capstone-invalid";
  constructor() {
    super(
      "This capstone snapshot is unsupported, inconsistent, or too large. Nothing was truncated; keep the original.",
    );
    this.name = "CapstoneCaptureError";
  }
}
function record(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
    Reflect.ownKeys(value).every(
      (key) =>
        typeof key === "string" &&
        Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, "value"),
    )
  );
}
function text(value: unknown): value is string {
  if (typeof value !== "string" || value.length > CAPSTONE_CAPTURE_LIMITS.text) return false;
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31)) return false;
  }
  return true;
}
function labels(value: unknown): value is Record<string, string> {
  return (
    record(value) &&
    Object.keys(value).length <= CAPSTONE_CAPTURE_LIMITS.labels &&
    Object.entries(value).every(
      ([key, label]) =>
        /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/u.test(key) &&
        !["constructor", "prototype", "__proto__"].includes(key) &&
        text(label) &&
        label.trim() !== "",
    )
  );
}
function freezeWorksheet(worksheet: WorksheetState): WorksheetState {
  return Object.freeze({
    ...worksheet,
    order: Object.freeze([...worksheet.order]),
    annotations: Object.freeze({ ...worksheet.annotations }),
    assumptionMarks: Object.freeze(
      Object.fromEntries(
        Object.entries(worksheet.assumptionMarks).map(([key, values]) => [
          key,
          Object.freeze([...values]),
        ]),
      ),
    ),
    table: Object.freeze(worksheet.table.map((row) => Object.freeze([...row]))),
  });
}
/** Strict admission, independent of a server-side content registry or laboratory evaluator. */
export function readCapstoneCapture(input: unknown): CapstoneCapture | null {
  if (!record(input)) return null;
  const fields = [
    "schemaVersion",
    "paper",
    "worksheet",
    "prompt",
    "claims",
    "assumptions",
    "equations",
  ];
  if (
    Object.keys(input).length !== fields.length ||
    fields.some((key) => !Object.hasOwn(input, key)) ||
    input.schemaVersion !== 1 ||
    !CAPSTONE_PAPERS.includes(input.paper as CapstonePaper) ||
    !text(input.prompt) ||
    !labels(input.claims) ||
    !labels(input.assumptions) ||
    !labels(input.equations)
  )
    return null;
  const worksheet = readWorksheet(input.worksheet);
  if (!worksheet) return null;
  const claims = input.claims;
  const assumptions = input.assumptions;
  if (
    worksheet.order.length !== Object.keys(claims).length ||
    worksheet.order.some((id) => !Object.hasOwn(claims, id)) ||
    Object.entries(worksheet.assumptionMarks).some(
      ([id, marks]) =>
        !Object.hasOwn(claims, id) || marks.some((mark) => !Object.hasOwn(assumptions, mark)),
    )
  )
    return null;
  const capture: CapstoneCapture = {
    schemaVersion: 1,
    paper: input.paper as CapstonePaper,
    worksheet,
    prompt: input.prompt,
    claims: { ...claims },
    assumptions: { ...assumptions },
    equations: { ...input.equations },
  };
  if (new TextEncoder().encode(JSON.stringify(capture)).length > CAPSTONE_CAPTURE_LIMITS.bytes)
    return null;
  return Object.freeze({
    ...capture,
    worksheet: freezeWorksheet(worksheet),
    claims: Object.freeze(capture.claims),
    assumptions: Object.freeze(capture.assumptions),
    equations: Object.freeze(capture.equations),
  });
}
export function parseCapstoneCapture(input: unknown, expectedPaper?: string): CapstoneCapture {
  const capture = readCapstoneCapture(input);
  if (!capture || (expectedPaper !== undefined && capture.paper !== expectedPaper))
    throw new CapstoneCaptureError();
  return capture;
}
/** Capture only on explicit request. Later typing must never mutate a saved attempt. */
export function captureCapstone(
  capstone: Capstone,
  worksheet: WorksheetState,
  equations: readonly CaptureEquation[],
): CapstoneCapture {
  return parseCapstoneCapture(
    worksheetMatches(worksheet, capstone)
      ? {
          schemaVersion: 1,
          paper: capstone.paper,
          worksheet,
          prompt: capstone.explanationPrompt,
          claims: Object.fromEntries(capstone.claims.map((claim) => [claim.id, claim.text])),
          assumptions: Object.fromEntries(
            capstone.assumptions.map((item) => [item.id, item.statement]),
          ),
          equations: Object.fromEntries(equations.map((item) => [item.equationId, item.title])),
        }
      : null,
  );
}
/** Fixed public destination; no entry id or private words ever travel in a link. */
export function capstoneCaptureHref(capture: CapstoneCapture): string {
  const admitted = parseCapstoneCapture(capture);
  return `/capstones/${admitted.paper}/#capstone-worksheet`;
}

export type CapstoneRestoreReview = Readonly<{
  capture: CapstoneCapture;
  base: string;
}>;
export function reviewCapstoneRestore(
  capture: CapstoneCapture,
  current: WorksheetState,
): CapstoneRestoreReview {
  return Object.freeze({ capture: parseCapstoneCapture(capture), base: JSON.stringify(current) });
}
/** Recheck at confirmation: the current worksheet and the saved snapshot may both have changed. */
export function confirmCapstoneRestore(
  review: CapstoneRestoreReview,
  current: WorksheetState,
  saved: unknown,
  capstone: Capstone,
): Readonly<{ ok: true; worksheet: WorksheetState } | { ok: false; message: string }> {
  if (JSON.stringify(current) !== review.base)
    return {
      ok: false,
      message:
        "Your worksheet changed after this preview. Nothing was replaced. Review the snapshot again.",
    };
  const capture = readCapstoneCapture(saved);
  if (!capture || JSON.stringify(capture) !== JSON.stringify(review.capture))
    return {
      ok: false,
      message:
        "That notebook snapshot changed or was removed. Nothing was replaced. Open a new preview.",
    };
  if (capture.paper !== capstone.paper || !worksheetMatches(capture.worksheet, capstone))
    return {
      ok: false,
      message:
        "This snapshot does not match this edition's claims and assumptions. Keep its export; nothing was replaced.",
    };
  // Return a detached editable copy, leaving the notebook's snapshot untouched.
  const worksheet = readWorksheet(capture.worksheet);
  return worksheet
    ? { ok: true, worksheet }
    : { ok: false, message: "This worksheet could not be restored." };
}

/** A script-free, lossless reading of the attempt, shared by the notebook, preview and HTML export. */
export function capstoneCaptureText(input: CapstoneCapture): string {
  const capture = parseCapstoneCapture(input);
  const state = capture.worksheet;
  const lines = [
    "Your reconstruction",
    "",
    capture.prompt,
    "",
    "Reference wording below is as saved with this private attempt. The edition may have changed.",
    "This is your work, not an assessment or a record of a laboratory calculation.",
    "",
    "Your claim order",
  ];
  for (const [index, id] of state.order.entries()) {
    lines.push(`${index + 1}. ${capture.claims[id]} [${id}]`);
    const marks = state.assumptionMarks[id] ?? [];
    lines.push(marks.length ? "Assumptions you selected:" : "No assumptions selected.");
    for (const mark of marks) lines.push(`  ${capture.assumptions[mark]} [${mark}]`);
    lines.push("");
  }
  lines.push("Your equation annotations");
  const notes = Object.entries(state.annotations);
  if (!notes.length) lines.push("No annotations saved.");
  for (const [id, value] of notes)
    lines.push(`${capture.equations[id] ?? "Other saved annotation"} [${id}]`, value, "");
  lines.push("Your explanation", state.explanation || "No explanation saved.", "", "Your table");
  if (!state.table.length) lines.push("No table saved.");
  for (const [row, cells] of state.table.entries()) {
    lines.push(`Row ${row + 1}`);
    for (const [col, value] of cells.entries()) lines.push(`  Column ${col + 1}: ${value}`);
  }
  lines.push("", "All assumptions available when saved");
  for (const [id, value] of Object.entries(capture.assumptions)) lines.push(`${value} [${id}]`);
  return `${lines.join("\n")}\n`;
}
