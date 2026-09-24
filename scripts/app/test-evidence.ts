/**
 * A failing UI test's evidence (bead am-app-test-harness-da6e, requirements 5 to 7). After a UI test
 * run the Apple gate gathers, for each failing test, into
 * artifacts/test-logs/app-evidence/<logRunId>/<test folder>/:
 * - `screen.png` and `orientation.txt`: what HarnessObserver attached at the test's first issue,
 *   exported from the .xcresult;
 * - `events.jsonl` and `dom.html`: what the app kept in its data container (TestEvidence.swift), the
 *   events of every launch the test made, oldest first, and the newest launch's DOM;
 * - `app-log.ndjson`: the app's own log lines for the test's window, from the simulator's log.
 *
 * `checkEvidence` says which items a folder holds and which it lacks, and `failureRecord` writes the
 * test's record in the shared log schema, naming the files. The seeded-failure lane passes only when
 * nothing is lacking.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { type LogEvent, validateEvent } from "../../src/testing/log/schema.ts";

/** HarnessObserver's attachment names (HarnessObserver.swift). */
export const SCREENSHOT_ATTACHMENT = "evidence-screen";
export const ORIENTATION_ATTACHMENT = "evidence-orientation";

/** The folder in the app's Library/Caches that TestEvidence.swift writes to. */
export const APP_EVIDENCE_FOLDER = "AMTestEvidence";

/** The only fields a bridge event may carry: a message's type and outcome, never its body. */
export const BRIDGE_EVENT_FIELDS: readonly string[] = ["at", "kind", "namespace", "status", "type"];

/**
 * A test's folder: the .xcresult identifier without its "()", with anything but letters, digits, dot,
 * dash and underscore replaced by "_". TestEvidence.folder(for:) makes the same name in Swift, and
 * fixtures/evidence-folders.json holds the two to the same answers.
 */
export function evidenceFolderName(testIdentifier: string): string {
  const id = testIdentifier.replace(/\(\)$/, "");
  return id === "" ? "unnamed" : id.replace(/[^A-Za-z0-9._-]/g, "_");
}

/** A PNG's pixel size from its header, or null when the bytes are not a PNG. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((byte, index) => bytes[index] !== byte)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

type ManifestEntry = {
  readonly testIdentifier: string;
  readonly attachments: readonly {
    readonly exportedFileName: string;
    readonly suggestedHumanReadableName: string;
  }[];
};

export type GatherOptions = {
  /** `xcresulttool export attachments` output: manifest.json and the files. */
  readonly attachmentsDir: string;
  /** The app's Library/Caches/AMTestEvidence, or null when the app's container was not found. */
  readonly appEvidenceDir: string | null;
  readonly testIdentifier: string;
  readonly dest: string;
  /** The app's log lines between two instants, as ndjson. */
  readonly appLog: (start: Date, end: Date) => string;
  /** The window when the app kept no events: the whole run. */
  readonly fallbackWindow: { readonly start: Date; readonly end: Date };
};

/** Copies a failing test's evidence into `dest`. Nothing is removed from where it came from. */
export function gatherEvidence(options: GatherOptions): void {
  const { attachmentsDir, appEvidenceDir, testIdentifier, dest } = options;
  mkdirSync(dest, { recursive: true });
  const manifestPath = join(attachmentsDir, "manifest.json");
  const manifest = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestEntry[])
    : [];
  const attachments = manifest.find(
    (entry) => entry.testIdentifier === testIdentifier,
  )?.attachments;
  for (const [prefix, file] of [
    [SCREENSHOT_ATTACHMENT, "screen.png"],
    [ORIENTATION_ATTACHMENT, "orientation.txt"],
  ] as const) {
    const found = attachments?.find((a) => a.suggestedHumanReadableName.startsWith(prefix));
    if (found !== undefined) {
      copyFileSync(join(attachmentsDir, found.exportedFileName), join(dest, file));
    }
  }

  const launches =
    appEvidenceDir === null
      ? []
      : (() => {
          const folder = join(appEvidenceDir, evidenceFolderName(testIdentifier));
          return existsSync(folder)
            ? readdirSync(folder)
                .sort()
                .map((launch) => join(folder, launch))
            : [];
        })();
  const events = launches
    .map((launch) => join(launch, "events.jsonl"))
    .filter((file) => existsSync(file))
    .map((file) => readFileSync(file, "utf8"))
    .join("");
  if (events !== "") writeFileSync(join(dest, "events.jsonl"), events);
  const newestDom = launches
    .map((launch) => join(launch, "dom.html"))
    .filter((file) => existsSync(file))
    .at(-1);
  if (newestDom !== undefined) copyFileSync(newestDom, join(dest, "dom.html"));

  const instants = events
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => Date.parse(String((JSON.parse(line) as { at?: unknown }).at)))
    .filter((time) => Number.isFinite(time));
  const start =
    instants.length > 0 ? new Date(Math.min(...instants) - 1000) : options.fallbackWindow.start;
  const end =
    instants.length > 0 ? new Date(Math.max(...instants) + 5000) : options.fallbackWindow.end;
  writeFileSync(join(dest, "app-log.ndjson"), options.appLog(start, end));
}

export type EvidenceItem = {
  readonly item: string;
  readonly present: boolean;
  readonly detail: string;
};

function lines(file: string): Record<string, unknown>[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return { unreadable: line.slice(0, 80) };
      }
    });
}

/** Each evidence item a failing test should leave, and whether `dir` holds it. */
export function checkEvidence(dir: string, xcresultPath: string): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const add = (item: string, present: boolean, detail: string) =>
    items.push({ item, present, detail });

  add("xcresult", existsSync(xcresultPath), xcresultPath);

  const screen = join(dir, "screen.png");
  const size = existsSync(screen) ? pngSize(readFileSync(screen)) : null;
  const facing = existsSync(join(dir, "orientation.txt"))
    ? (readFileSync(join(dir, "orientation.txt"), "utf8").trim().split(/\s/)[0] ?? "")
    : "";
  const shaped =
    size !== null &&
    ((facing === "portrait" && size.height > size.width) ||
      (facing === "landscape" && size.width > size.height));
  add(
    "screenshot",
    shaped,
    size === null
      ? "no PNG screenshot"
      : `${size.width}x${size.height}, device ${facing === "" ? "orientation not recorded" : facing}${shaped ? "" : ": the image's shape does not match"}`,
  );

  const dom = existsSync(join(dir, "dom.html")) ? readFileSync(join(dir, "dom.html"), "utf8") : "";
  const domOk = dom.startsWith("<!-- am-test-evidence ") && /<html[\s>]/i.test(dom);
  add("dom", domOk, domOk ? `${dom.length} characters` : "no DOM snapshot");

  const events = lines(join(dir, "events.jsonl"));
  const consoleLines = events.filter((e) => e.kind === "console");
  add("console", consoleLines.length > 0, `${consoleLines.length} console line(s)`);
  const bridge = events.filter((e) => e.kind === "bridge");
  add("runtime events", bridge.length > 0, `${bridge.length} bridge event(s)`);
  const leaking = bridge.filter((e) =>
    Object.keys(e).some((key) => !BRIDGE_EVENT_FIELDS.includes(key)),
  );
  add(
    "no reader data",
    leaking.length === 0,
    leaking.length === 0
      ? `${bridge.length} bridge event(s), types and outcomes only`
      : `a bridge event carries ${Object.keys(leaking[0] ?? {}).join(", ")}`,
  );

  // Only entries count: `log show` can print a header or an error, which is not the app's log.
  const appLog = lines(join(dir, "app-log.ndjson")).filter(
    (entry) => typeof entry.eventMessage === "string",
  );
  add("app log", appLog.length > 0, `${appLog.length} entr(ies) from the app's log`);
  return items;
}

/** The failing test's record in the shared schema, naming its evidence by repository path. */
export function failureRecord(options: {
  readonly repo: string;
  readonly logRunId: string;
  readonly testIdentifier: string;
  readonly failureText: string;
  readonly dir: string;
  readonly xcresultPath: string;
  readonly items: readonly EvidenceItem[];
  readonly now?: Date;
}): LogEvent {
  const path = (file: string) => relative(options.repo, join(options.dir, file));
  return validateEvent({
    timestamp: (options.now ?? new Date()).toISOString(),
    suite: "app-ui",
    logRunId: options.logRunId,
    testId: options.testIdentifier,
    beadId: "am-app-test-harness-da6e",
    outcome: "failed",
    browser: "wkwebview",
    message: options.failureText.slice(0, 2000),
    evidence: {
      screenshot: path("screen.png"),
      dom: path("dom.html"),
      console: path("events.jsonl"),
      files: [path("orientation.txt"), path("app-log.ndjson"), options.xcresultPath],
    },
    extra: {
      missing: options.items.filter((item) => !item.present).map((item) => item.item),
    },
  });
}
