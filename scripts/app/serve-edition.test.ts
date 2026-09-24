/**
 * The TypeScript edition origin gives every shared origin vector the answer the Swift handler gives
 * (fixtures/origin-vectors.json; EditionOriginTests in ios/): status, the file's bytes and content
 * type, Content-Length, the fixed headers, and never Set-Cookie.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  candidatePaths,
  EDITION_HOST,
  FIXED_HEADERS,
  MAX_PATH_LENGTH,
  serveEdition,
} from "./serve-edition.ts";

type Vectors = {
  readonly maxPathLength: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly forbiddenHeaders: readonly string[];
  readonly files: readonly {
    path: string;
    body: string;
    contentType: string;
    size: number;
    sha256: string;
  }[];
  readonly vectors: readonly {
    name: string;
    path: string;
    status: number;
    file: string;
    host?: string;
    repeat?: { segment: string; count: number };
  }[];
};

const HERE = dirname(fileURLToPath(import.meta.url));
const V = JSON.parse(
  readFileSync(join(HERE, "fixtures", "origin-vectors.json"), "utf8"),
) as Vectors;
const bodies = new Map(V.files.map((file) => [file.path, new TextEncoder().encode(file.body)]));
const read = (path: string) => {
  const body = bodies.get(path);
  if (body === undefined) throw new Error(`read an unlisted file: ${path}`);
  return body;
};

describe("the TypeScript edition origin", () => {
  it("names the same limit and headers as the app and the shared vectors", () => {
    assert.equal(MAX_PATH_LENGTH, V.maxPathLength);
    assert.deepEqual(FIXED_HEADERS, V.headers);
  });

  it("answers every shared vector as the Swift handler does", () => {
    assert.ok(V.vectors.length > 0);
    for (const vector of V.vectors) {
      const path = vector.path + (vector.repeat?.segment.repeat(vector.repeat.count) ?? "");
      const answer = serveEdition(V.files, read, {
        host: vector.host ?? EDITION_HOST,
        percentEncodedPath: path,
      });
      const file = V.files.find((f) => f.path === vector.file);
      assert.ok(file, vector.name);
      assert.equal(answer.status, vector.status, vector.name);
      assert.equal(answer.headers["Content-Type"], file.contentType, vector.name);
      assert.equal(answer.headers["Content-Length"], String(file.size), vector.name);
      for (const [name, value] of Object.entries(V.headers)) {
        assert.equal(answer.headers[name], value, `${vector.name}: ${name}`);
      }
      for (const name of V.forbiddenHeaders) {
        assert.equal(answer.headers[name], undefined, `${vector.name}: ${name}`);
      }
      assert.equal(
        createHash("sha256").update(answer.body).digest("hex"),
        file.sha256,
        vector.name,
      );
    }
  });

  // The vectors cannot see these rules: an unnormalized "../x" is never a listed file, so it gets
  // the 404 page with or without them. EditionPathTests holds the Swift side the same way.
  it("refuses, before any file is chosen, every path the app refuses", () => {
    for (const path of [
      "/../Info.plist",
      "/papers/../../AnnusMirabilis",
      "/./index.html",
      "/%2e%2e/Info.plist",
      "/a%2fb",
      "/a%2Fb",
      "/a%5cb",
      "/a%00b",
      "relative/path",
      `/${"a".repeat(MAX_PATH_LENGTH)}`,
    ]) {
      assert.equal(candidatePaths(path), null, path);
    }
    assert.notEqual(
      candidatePaths(`/${"a".repeat(MAX_PATH_LENGTH - 1)}`),
      null,
      "a path exactly at the limit is served, as in Swift (<=)",
    );
    assert.deepEqual(candidatePaths("/papers"), ["papers", "papers/index.html"]);
    assert.deepEqual(candidatePaths("/papers/"), ["papers/index.html"]);
    assert.deepEqual(candidatePaths(""), ["index.html"]);
  });

  it("refuses a malformed escape, as Swift's removingPercentEncoding does, instead of guessing", () => {
    assert.equal(candidatePaths("/bad%E0%A4%A.html"), null);
    assert.deepEqual(candidatePaths("/fonts/a%20b.woff2"), ["fonts/a b.woff2"]);
  });

  it("answers the edition's own 404 with an empty text page when the edition has none", () => {
    const answer = serveEdition([{ path: "index.html", contentType: "text/html" }], read, {
      host: EDITION_HOST,
      percentEncodedPath: "/missing/",
    });
    assert.equal(answer.status, 404);
    assert.equal(answer.body.byteLength, 0);
    assert.equal(answer.headers["Content-Type"], "text/plain; charset=utf-8");
  });
});
