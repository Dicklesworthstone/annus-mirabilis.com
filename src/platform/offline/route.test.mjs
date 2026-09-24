import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  dynamic,
  dynamicParams,
  GET,
  generateStaticParams,
} from "../../app/offline/[paper]/[file]/index.html/route.ts";
import { offlineDigest } from "./chapter.ts";
import { publishOfflineChapters } from "./server.ts";

test("static route downloads exact admitted bytes, refuses retained files, and rejects tampering", async () => {
  const originalCwd = process.cwd(),
    originalProfile = process.env.AM_RELEASE_PROFILE;
  const root = await mkdtemp(resolve(tmpdir(), "offline-route-"));
  await mkdir(resolve(root, "generated/content"), { recursive: true });
  await writeFile(
    resolve(root, "generated/content/index.json"),
    JSON.stringify({ buildDigest: "a".repeat(64) }),
  );
  const html = '<!doctype html><html lang="en"><body>λ and μ</body></html>';
  const sha256 = offlineDigest(html);
  const entry = {
    paper: "brownian-motion",
    section: "s4",
    title: "Section 4",
    sha256,
    contentRevision: "b".repeat(64),
    bytes: Buffer.byteLength(html),
    gzipBytes: 50,
    path: `/offline/brownian-motion/s4-${sha256}.html`,
  };
  const manifest = {
    schemaVersion: 1,
    buildDigest: "a".repeat(64),
    profile: "scaffold",
    chapters: [entry],
  };
  // The URL segment is the chapter's name without ".html": each chapter is exported as a
  // directory index, which static hosts serve at "name/".
  const fileName = entry.path.split("/").pop();
  const params = { paper: entry.paper, file: fileName.replace(/\.html$/, "") };
  const get = (values = params) =>
    GET(new Request(`https://example.test${entry.path}`), { params: Promise.resolve(values) });
  try {
    process.chdir(root);
    process.env.AM_RELEASE_PROFILE = "scaffold";
    await publishOfflineChapters(root, manifest, [{ entry, html }]);
    assert.equal(dynamic, "force-static");
    assert.equal(dynamicParams, false);
    assert.deepEqual(await generateStaticParams(), [params]);
    const response = await get();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Length"), String(Buffer.byteLength(html)));
    assert.equal(
      response.headers.get("Content-Disposition"),
      'attachment; filename="brownian-motion-s4.html"',
    );
    assert.equal(response.headers.get("Content-Type"), "text/html; charset=utf-8");
    assert.equal(await response.text(), html);
    assert.equal((await get({ ...params, file: "../../private" })).status, 404);
    await writeFile(resolve(root, "generated/offline", params.paper, fileName), "tampered");
    await assert.rejects(get(), /integrity/);
    await publishOfflineChapters(root, { ...manifest, chapters: [] }, []);
    assert.deepEqual(await generateStaticParams(), []);
    assert.equal((await get()).status, 404);
  } finally {
    process.chdir(originalCwd);
    if (originalProfile === undefined) delete process.env.AM_RELEASE_PROFILE;
    else process.env.AM_RELEASE_PROFILE = originalProfile;
  }
});
