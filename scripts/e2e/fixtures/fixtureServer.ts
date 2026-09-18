/**
 * The one fixture server (am-test-e2e-harness-bqmh requirement 8): binds
 * only to 127.0.0.1 and serves the harness's static fixture pages from
 * `src/testing/e2e/fixtures/` at `/`, and each registered application's
 * bundle plus its `staticInputs` at `/apps/<id>/`. Never reachable from the
 * application build — the architecture gate and the initial-route graph
 * check still run on the production build, which never imports this file.
 */

import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";

export type PathHeaders = Readonly<Record<string, string>>;
export type HeaderResolver = (path: string) => PathHeaders;

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".map": "application/json",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

const DEFAULT_HEADERS: PathHeaders = Object.freeze({});

export interface FixtureServerOptions {
  /** Served at `/`: the harness's own static fixture pages. */
  readonly staticRoot: string;
  /** Served at `/apps/<id>/...`: each registered application's bundle and staticInputs. */
  readonly appsRoot: string;
  /**
   * The response headers the real application sends for a given path,
   * read from the same header configuration the Next.js server uses.
   * Defaults to no extra headers when not supplied.
   */
  readonly headersForPath?: HeaderResolver;
}

/** Resolves `requestPath` under `root`; returns `undefined` if it would escape `root` (a `..` traversal or an absolute bypass). */
function resolveWithinRoot(root: string, requestPath: string): string | undefined {
  const decoded = decodeURIComponent(requestPath);
  const resolved = resolve(root, `.${decoded}`);
  if (resolved !== root && !resolved.startsWith(root + sep)) return undefined;
  return resolved;
}

async function readExistingFile(path: string): Promise<Buffer | undefined> {
  try {
    const info = await stat(path);
    if (!info.isFile()) return undefined;
    return await readFile(path);
  } catch {
    return undefined;
  }
}

async function resolveRequestFile(
  options: FixtureServerOptions,
  pathname: string,
): Promise<{ filePath: string; servedPath: string } | undefined> {
  const staticRoot = resolve(options.staticRoot);
  const appsRoot = resolve(options.appsRoot);

  if (pathname.startsWith("/apps/")) {
    const rawAppPath = pathname.slice("/apps".length);
    const appPath = rawAppPath.endsWith("/")
      ? `${rawAppPath}index.html`
      : !rawAppPath.includes(".")
        ? `${rawAppPath}/index.html`
        : rawAppPath;
    const resolved = resolveWithinRoot(appsRoot, appPath);
    if (!resolved) return undefined;
    return { filePath: resolved, servedPath: pathname };
  }

  const staticPath = pathname === "/" ? "/index.html" : pathname;
  const resolved = resolveWithinRoot(staticRoot, staticPath);
  if (!resolved) return undefined;
  return { filePath: resolved, servedPath: pathname };
}

async function handleRequest(
  options: FixtureServerOptions,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const resolved = await resolveRequestFile(options, url.pathname);
  if (!resolved) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const bytes = await readExistingFile(resolved.filePath);
  if (bytes === undefined) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const configuredHeaders = (options.headersForPath ?? (() => DEFAULT_HEADERS))(
    resolved.servedPath,
  );
  res.writeHead(200, { "content-type": contentTypeFor(resolved.filePath), ...configuredHeaders });
  res.end(bytes);
}

export function createFixtureServer(options: FixtureServerOptions): Server {
  return createServer((req, res) => {
    handleRequest(options, req, res).catch((error) => {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end(`Fixture server error: ${error instanceof Error ? error.message : String(error)}`);
    });
  });
}

export interface RunningFixtureServer {
  readonly url: string;
  close(): Promise<void>;
}

/** Starts the server on a free port bound only to 127.0.0.1. */
export async function startFixtureServer(
  options: FixtureServerOptions,
): Promise<RunningFixtureServer> {
  const server = createFixtureServer(options);
  await new Promise<void>((resolveStart, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveStart());
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("fixture server did not report a bound port");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolveClose) => server.close(() => resolveClose())),
  };
}
