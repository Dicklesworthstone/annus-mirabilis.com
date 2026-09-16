import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendLogLine,
  evidenceDirFor,
  logPathFor,
  newLogRunId,
  writeEvidenceFile,
} from "./logLine.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SUITE = "scaffold-static-output";
const BEAD_ID = "am-scaf-nextjs-app-bu2";
const USER_AGENT = "OpenAI File Downloader, XaiImageApiFetch/1.0";
const DEFAULT_HOME_PAGE_TEXT = "in preparation";

// ---------------------------------------------------------------------------
// Pure functions over parsed inputs (an HTML string, an origin, a fetched
// resource). No filesystem, network, or process access below this line
// except inside the CLI section at the bottom of the file.
// ---------------------------------------------------------------------------

export type CrossOriginReference = {
  tag: "script" | "link" | "img";
  attribute: "src" | "href";
  url: string;
  origin: string;
};

const TAG_ATTRIBUTE: Record<CrossOriginReference["tag"], CrossOriginReference["attribute"]> = {
  script: "src",
  link: "href",
  img: "src",
};

function extractAttribute(tagSource: string, attribute: string): string | undefined {
  const pattern = new RegExp(`\\b${attribute}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = pattern.exec(tagSource);
  if (!match) return undefined;
  return match[2] ?? match[3] ?? match[4];
}

/**
 * Only `<script src>`, `<link href>`, and `<img src>` make a request; a
 * plain `<a href>` is a hyperlink, not a request, and is never scanned.
 */
export function findCrossOriginReferences(
  html: string,
  pageOrigin: string,
): CrossOriginReference[] {
  const pageOriginValue = new URL(pageOrigin).origin;
  const found: CrossOriginReference[] = [];
  const tagPattern = /<(script|link|img)\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html)) !== null) {
    const tagName = match[1];
    if (!tagName) continue;
    const tag = tagName.toLowerCase() as CrossOriginReference["tag"];
    const attribute = TAG_ATTRIBUTE[tag];
    const url = extractAttribute(match[0], attribute);
    if (!url) continue;
    let resolved: URL;
    try {
      resolved = new URL(url, pageOrigin);
    } catch {
      continue;
    }
    if (resolved.origin !== pageOriginValue) {
      found.push({ tag, attribute, url, origin: resolved.origin });
    }
  }
  return found;
}

export type FetchedResource = {
  url: string;
  status: number;
  headers: Readonly<Record<string, string>>;
  body: string;
};

export type StaticOutputCheckResult = { id: string; outcome: "pass" | "fail"; message: string };

export function checkExpectedStatus(
  resource: FetchedResource,
  id: string,
  expectedStatus: number,
): StaticOutputCheckResult {
  const outcome = resource.status === expectedStatus ? "pass" : "fail";
  return {
    id,
    outcome,
    message:
      outcome === "pass"
        ? `${resource.url} returned ${resource.status}`
        : `${resource.url} returned ${resource.status}, expected ${expectedStatus}`,
  };
}

export function checkBodyContains(
  resource: FetchedResource,
  id: string,
  expectedSubstring: string,
): StaticOutputCheckResult {
  const outcome = resource.body.includes(expectedSubstring) ? "pass" : "fail";
  return {
    id,
    outcome,
    message:
      outcome === "pass"
        ? `${resource.url} body contains ${JSON.stringify(expectedSubstring)}`
        : `${resource.url} body does not contain ${JSON.stringify(expectedSubstring)}`,
  };
}

export function checkNoCrossOriginReferences(
  resource: FetchedResource,
  id: string,
  pageOrigin: string,
): StaticOutputCheckResult {
  const references = findCrossOriginReferences(resource.body, pageOrigin);
  const outcome = references.length === 0 ? "pass" : "fail";
  return {
    id,
    outcome,
    message:
      outcome === "pass"
        ? `${resource.url} references no third-party origin`
        : `${resource.url} references third-party origin(s): ${references.map((r) => `${r.tag}[${r.attribute}]=${r.origin}`).join(", ")}`,
  };
}

// ---------------------------------------------------------------------------
// Thin CLI: starts `next start` on a free port against the production
// build, fetches the fixed set of paths over plain HTTP, asserts status
// codes/content/no third-party origin, and stops the server. Never starts
// `next dev`.
// ---------------------------------------------------------------------------

function getFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("could not determine a free port"));
        return;
      }
      const { port } = address;
      server.close(() => resolvePort(port));
    });
  });
}

type ServerHandle = { stop: () => Promise<void>; log: string[] };

async function startNextServer(port: number): Promise<ServerHandle> {
  const log: string[] = [];
  const child = spawn("npx", ["next", "start", "-p", String(port)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk) => log.push(String(chunk)));
  child.stderr?.on("data", (chunk) => log.push(String(chunk)));

  const ready = new Promise<void>((resolveReady, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`next start did not become ready within 30s. Log:\n${log.join("")}`)),
      30_000,
    );
    const onData = (chunk: Buffer) => {
      if (/ready|started server/i.test(String(chunk))) {
        clearTimeout(timeout);
        resolveReady();
      }
    };
    child.stdout?.on("data", onData);
    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`next start exited early with code ${code}. Log:\n${log.join("")}`));
    });
  });
  await ready;

  return {
    log,
    stop: () =>
      new Promise((resolveStop) => {
        child.once("exit", () => resolveStop());
        child.kill("SIGTERM");
      }),
  };
}

async function fetchResource(url: string): Promise<FetchedResource> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  const body = await response.text();
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return { url, status: response.status, headers, body };
}

async function main(): Promise<void> {
  const logRunId = newLogRunId();
  const logPath = logPathFor(SUITE, logRunId, ROOT);
  const evidenceDir = evidenceDirFor(SUITE, logRunId, ROOT);
  const port = await getFreePort();
  const origin = `http://127.0.0.1:${port}`;

  const server = await startNextServer(port);
  try {
    const home = await fetchResource(`${origin}/`);
    const robots = await fetchResource(`${origin}/robots.txt`);
    const sitemap = await fetchResource(`${origin}/sitemap.xml`);
    const unknown = await fetchResource(`${origin}/this-path-does-not-exist-${logRunId}`);

    const checks: StaticOutputCheckResult[] = [
      checkExpectedStatus(home, "home-page-200", 200),
      checkBodyContains(home, "home-page-text", DEFAULT_HOME_PAGE_TEXT),
      checkNoCrossOriginReferences(home, "home-page-no-third-party-origin", origin),
      checkExpectedStatus(robots, "robots-200", 200),
      checkExpectedStatus(sitemap, "sitemap-200", 200),
      checkExpectedStatus(unknown, "unknown-path-404", 404),
    ];

    for (const check of checks) {
      appendLogLine(logPath, {
        suite: SUITE,
        logRunId,
        testId: check.id,
        beadId: BEAD_ID,
        outcome: check.outcome,
        message: check.message,
        extra: { url: home.url, status: home.status },
      });
      if (check.outcome === "fail") {
        writeEvidenceFile(evidenceDir, `${check.id}-status.txt`, String(home.status));
        writeEvidenceFile(
          evidenceDir,
          `${check.id}-headers.json`,
          JSON.stringify(home.headers, null, 2),
        );
        writeEvidenceFile(evidenceDir, `${check.id}-body.txt`, home.body.slice(0, 4096));
      }
    }

    const failures = checks.filter((c) => c.outcome === "fail");
    if (failures.length > 0) {
      writeEvidenceFile(evidenceDir, "next-start-server-log.txt", server.log.join(""));
      for (const failure of failures) console.error(`${failure.id}: ${failure.message}`);
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify({ outcome: "pass", checks: checks.length, logPath }));
  } finally {
    await server.stop();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
