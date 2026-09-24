/**
 * The app's edition origin in TypeScript (bead am-app-edition-parity-bwa5, criterion 3): the same
 * answers EditionSchemeHandler gives at am-edition://edition/, so a browser can load the app's
 * edition exactly as the app serves it. It follows EditionCatalog.candidatePaths rule for rule, and
 * scripts/app/fixtures/origin-vectors.json holds the two to the same statuses, bytes and headers
 * (serve-edition.test.ts here, EditionOriginTests in Swift).
 *
 * Usage: `bun scripts/app/serve-edition.ts [--edition <folder of the bundled edition>] [--port 4173]`
 * serves an edition folder (the app's Edition/, or a web build filtered by generated/app-edition)
 * on 127.0.0.1 only.
 */

import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** EditionCatalog.maxPathLength: a longer path is refused before it is decoded. */
export const MAX_PATH_LENGTH = 2048;

/** EditionSchemeHandler.headers: on every response, and no others. */
export const FIXED_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

/** The origin's host: EditionCatalog.host. */
export const EDITION_HOST = "edition";

export type ManifestFile = {
  readonly path: string;
  readonly contentType: string;
};

/**
 * The manifest keys a request path may name, most specific first, or null when the path is refused.
 * EditionCatalog.candidatePaths, rule for rule.
 */
export function candidatePaths(percentEncodedPath: string): string[] | null {
  if (Buffer.byteLength(percentEncodedPath, "utf8") > MAX_PATH_LENGTH) return null;
  const path = percentEncodedPath === "" ? "/" : percentEncodedPath;
  const lowered = path.toLowerCase();
  // An encoded separator or NUL would let a segment smuggle "/" or "\" past the checks below.
  if (["%2f", "%5c", "%00"].some((forbidden) => lowered.includes(forbidden))) return null;
  if (!path.startsWith("/")) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // Swift's removingPercentEncoding answers nil for a malformed escape: refused there too.
    return null;
  }
  if (decoded.includes("\\") || decoded.includes("\0")) return null;
  const segments = decoded.split("/").slice(1);
  if (segments.some((segment) => segment === ".." || segment === ".")) return null;
  const joined = segments.join("/");
  if (joined === "") return ["index.html"];
  if (decoded.endsWith("/")) return [`${joined}index.html`];
  const last = segments.at(-1) ?? "";
  if (last.includes(".")) return [joined];
  return [joined, `${joined}/index.html`];
}

export type EditionResponse = {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
};

/**
 * The answer for one request: a listed file with its manifest content type, or the edition's own
 * 404 page for anything else, a path that tries to leave the edition and another host included.
 */
export function serveEdition(
  files: readonly ManifestFile[],
  read: (path: string) => Uint8Array,
  request: { readonly host: string; readonly percentEncodedPath: string },
): EditionResponse {
  const listed = new Map(files.map((file) => [file.path, file]));
  const candidates =
    request.host === EDITION_HOST ? candidatePaths(request.percentEncodedPath) : null;
  const found = candidates?.map((path) => listed.get(path)).find((file) => file !== undefined);
  const file = found ?? listed.get("404.html");
  const status = found === undefined ? 404 : 200;
  const body = file === undefined ? new Uint8Array() : read(file.path);
  const contentType = file?.contentType ?? "text/plain; charset=utf-8";
  return {
    status,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(body.byteLength),
      ...FIXED_HEADERS,
    },
    body,
  };
}

function main(argv: readonly string[]): void {
  const flag = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const repo = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const generated = join(repo, "generated", "app-edition");
  const manifest = JSON.parse(readFileSync(join(generated, "edition-manifest.json"), "utf8")) as {
    files: ManifestFile[];
  };
  const edition = resolve(
    flag("--edition") ?? readFileSync(join(generated, "edition-source.txt"), "utf8").trim(),
  );
  const port = Number(flag("--port") ?? "4173");
  createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const answer = serveEdition(manifest.files, (path) => readFileSync(join(edition, path)), {
      host: EDITION_HOST,
      percentEncodedPath: url.pathname,
    });
    response.writeHead(answer.status, answer.headers);
    response.end(answer.body);
  }).listen(port, "127.0.0.1", () => {
    process.stdout.write(`serving ${edition} as the app's edition at http://127.0.0.1:${port}/\n`);
  });
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
