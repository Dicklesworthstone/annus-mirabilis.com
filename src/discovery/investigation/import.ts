import {
  INVESTIGATION_LIMITS,
  type InvestigationReport,
  type InvestigationSpec,
  parseInvestigationReport,
} from "./core.ts";
import { INVESTIGATIONS } from "./specs.ts";

/** The report's existing byte bound plus the newline its JSON exporter appends. */
export const INVESTIGATION_IMPORT_BYTES = INVESTIGATION_LIMITS.bytes + 1;

export type InvestigationImport =
  | Readonly<{ ok: true; report: InvestigationReport }>
  | Readonly<{
      ok: false;
      reason: "size" | "read" | "json" | "format" | "identity" | "journey";
      message: string;
      /** Always derived from the edition's own specifications, never a URL inside the file. */
      journeyHref?: string;
    }>;

const TOO_LARGE: InvestigationImport = Object.freeze({
  ok: false,
  reason: "size",
  message:
    "This file exceeds the investigation's 256 KiB limit. Choose the investigation JSON downloaded by this edition. Nothing here was replaced.",
});

/**
 * File import uses the existing closed report schema, then checks the relationships a live
 * capture enforces: one task, instrument, laboratory placement and source revision. Old model
 * results remain inspectable as saved work; importing never runs them or treats them as current.
 */
export function parseInvestigationImport(
  raw: string,
  spec: InvestigationSpec,
): InvestigationImport {
  if (new TextEncoder().encode(raw).byteLength > INVESTIGATION_IMPORT_BYTES) return TOO_LARGE;
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      reason: "json",
      message:
        "This file is not readable JSON. Choose Download investigation JSON, rather than the printable HTML file, from the investigation you want to open. Nothing here was replaced.",
    };
  }
  let report: InvestigationReport;
  try {
    report = parseInvestigationReport(input);
  } catch {
    return {
      ok: false,
      reason: "format",
      message:
        "This edition cannot open that investigation format or its saved readings. Keep the original file; it may belong to another edition. Nothing here was replaced.",
    };
  }
  const destination = Object.hasOwn(INVESTIGATIONS, report.paper)
    ? INVESTIGATIONS[report.paper as keyof typeof INVESTIGATIONS]
    : undefined;
  const baseline = report.baseline.reading;
  if (
    !destination ||
    report.promptId !== destination.promptId ||
    report.task.promptId !== report.promptId ||
    report.experimentId !== destination.experimentId ||
    [report.baseline, ...report.observations].some(
      ({ reading }) =>
        reading.experimentId !== report.experimentId ||
        reading.instanceId !== baseline.instanceId ||
        reading.sourceDigest !== baseline.sourceDigest ||
        destination.quantities.some(
          ({ id }) => reading.outputs.filter((output) => output.quantityId === id).length !== 1,
        ),
    )
  ) {
    return {
      ok: false,
      reason: "identity",
      message:
        "The saved task or laboratory readings do not belong to one compatible investigation. Keep the original file; nothing here was replaced.",
    };
  }
  if (
    report.paper !== spec.paper ||
    report.promptId !== spec.promptId ||
    report.experimentId !== spec.experimentId
  ) {
    return {
      ok: false,
      reason: "journey",
      message:
        "This investigation belongs to another discovery journey. Open that journey and choose the file there. Nothing here was replaced.",
      journeyHref: `/discover/${destination.paper}/#${destination.promptId}`,
    };
  }
  return { ok: true, report };
}

/** Check the file's size before reading, then check actual UTF-8 bytes before parsing. No upload. */
export async function readInvestigationImport(
  file: Pick<File, "size" | "text">,
  spec: InvestigationSpec,
): Promise<InvestigationImport> {
  if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > INVESTIGATION_IMPORT_BYTES)
    return TOO_LARGE;
  let raw: string;
  try {
    raw = await file.text();
  } catch {
    return {
      ok: false,
      reason: "read",
      message:
        "This file could not be read. Choose it again from this device. Nothing here was replaced.",
    };
  }
  return parseInvestigationImport(raw, spec);
}
