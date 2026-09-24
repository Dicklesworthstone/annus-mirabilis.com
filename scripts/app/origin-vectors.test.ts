/**
 * The app origin's shared vectors (fixtures/origin-vectors.json) agree with the export: every file
 * carries the content type the export gives its extension and the digest of its own body, and
 * every vector names a file the manifest lists. The Swift tests serve the same vectors through the
 * app's scheme handler (bead am-app-scheme-handler-ghuu, requirement 8).
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { contentTypeFor } from "./export-edition.ts";

type OriginVectors = {
  readonly maxPathLength: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly forbiddenHeaders: readonly string[];
  readonly files: readonly {
    readonly path: string;
    readonly body: string;
    readonly contentType: string;
    readonly size: number;
    readonly sha256: string;
  }[];
  readonly vectors: readonly {
    readonly name: string;
    readonly path: string;
    readonly status: number;
    readonly file: string;
    readonly host?: string;
    readonly repeat?: { readonly segment: string; readonly count: number };
  }[];
};

const HERE = dirname(fileURLToPath(import.meta.url));
const VECTORS = JSON.parse(
  readFileSync(join(HERE, "fixtures", "origin-vectors.json"), "utf8"),
) as OriginVectors;

describe("the app origin's shared vectors", () => {
  it("give each file the export's content type and the digest of its own body", () => {
    assert.ok(VECTORS.files.length > 0);
    for (const file of VECTORS.files) {
      assert.equal(file.contentType, contentTypeFor(file.path), file.path);
      const bytes = Buffer.from(file.body, "utf8");
      assert.equal(file.size, bytes.length, file.path);
      assert.equal(file.sha256, createHash("sha256").update(bytes).digest("hex"), file.path);
    }
  });

  it("name a listed file in every vector, and the 404 page for every refusal", () => {
    const listed = new Set(VECTORS.files.map((file) => file.path));
    assert.ok(listed.has("404.html"), "the edition's own 404 page is listed");
    assert.ok(VECTORS.vectors.length > 0);
    for (const vector of VECTORS.vectors) {
      assert.ok(listed.has(vector.file), `${vector.name}: ${vector.file} is not listed`);
      assert.equal(vector.status === 404, vector.file === "404.html", vector.name);
    }
    const served = VECTORS.vectors.filter((vector) => vector.status === 200);
    const refused = VECTORS.vectors.filter((vector) => vector.status === 404);
    assert.ok(served.length > 0 && refused.length > 0, "both kinds are exercised");
  });

  it("cover every content type the edition serves, and an over-long path", () => {
    const servedTypes = new Set(
      VECTORS.vectors
        .filter((vector) => vector.status === 200)
        .map((vector) => VECTORS.files.find((file) => file.path === vector.file)?.contentType),
    );
    for (const type of [
      "text/html; charset=utf-8",
      "text/javascript; charset=utf-8",
      "text/css; charset=utf-8",
      "application/wasm",
      "application/json",
      "font/woff2",
      "image/svg+xml",
      "text/plain; charset=utf-8",
    ]) {
      assert.ok(servedTypes.has(type), `no vector serves ${type}`);
    }
    const long = VECTORS.vectors.find((vector) => vector.repeat !== undefined);
    assert.ok(
      long?.repeat !== undefined &&
        long.path.length + long.repeat.segment.length * long.repeat.count > VECTORS.maxPathLength,
      "the over-long vector is over the limit",
    );
    assert.deepEqual(VECTORS.forbiddenHeaders, ["Set-Cookie"]);
  });
});
