import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { appendLogLine, logPathFor, newLogRunId } from "./scaffold/logLine.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SUITE = "measure-reading-face";
const BEAD_ID = "am-read-detail-axis-sfc";

/**
 * AGENTS.md's Detail axis budget: "250 kB gzipped for the largest paper's
 * reading face, checked in CI." A reading face is the static HTML for one
 * paper with all readings (R0-R3) embedded; over budget, a section's R2 and
 * R3 texts move to a static JSON fragment loaded on first expansion instead
 * (the fragment writer itself is a separate, not-yet-built piece; this
 * script only measures and gates).
 */
export const READING_FACE_BUDGET_BYTES = 250_000;

export interface ReadingFaceMeasurement {
  readonly rawBytes: number;
  readonly gzipBytes: number;
  readonly budgetBytes: number;
  readonly overBudget: boolean;
}

export function measureReadingFace(
  html: string,
  budgetBytes: number = READING_FACE_BUDGET_BYTES,
): ReadingFaceMeasurement {
  const raw = Buffer.from(html, "utf8");
  const gzipBytes = gzipSync(raw, { level: 9 }).length;
  return Object.freeze({
    rawBytes: raw.byteLength,
    gzipBytes,
    budgetBytes,
    overBudget: gzipBytes > budgetBytes,
  });
}

export function formatReadingFaceBudgetMessage(label: string, m: ReadingFaceMeasurement): string {
  return m.overBudget
    ? `${label}: ${m.gzipBytes} bytes gzipped exceeds the ${m.budgetBytes} byte budget (${m.rawBytes} bytes raw).`
    : `${label}: ${m.gzipBytes} bytes gzipped, within the ${m.budgetBytes} byte budget (${m.rawBytes} bytes raw).`;
}

async function main(filePath: string): Promise<void> {
  const logRunId = newLogRunId();
  const logPath = logPathFor(SUITE, logRunId, ROOT);
  const html = await readFile(filePath, "utf8");
  const measurement = measureReadingFace(html);
  const message = formatReadingFaceBudgetMessage(filePath, measurement);
  const outcome = measurement.overBudget ? "fail" : "pass";

  appendLogLine(logPath, {
    suite: SUITE,
    logRunId,
    testId: "reading-face-gzip-budget",
    beadId: BEAD_ID,
    outcome,
    message,
    extra: { filePath, gzipBytes: measurement.gzipBytes, budgetBytes: measurement.budgetBytes },
  });

  if (measurement.overBudget) {
    console.error(message);
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ outcome: "pass", ...measurement, logPath }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("usage: measure-reading-face.ts <path-to-reading-face.html>");
    process.exitCode = 2;
  } else {
    await main(filePath);
  }
}
