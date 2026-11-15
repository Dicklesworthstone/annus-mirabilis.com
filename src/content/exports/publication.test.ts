import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishLiveExportBundle } from "../../../scripts/build-exports.ts";
import { createLiveExportBundle } from "./live.ts";

test("a failed second subtree install restores both previous publication directories and indexes", async () => {
  const root = await mkdtemp(join(process.env.AM_TEST_TMP ?? tmpdir(), "am-export-rollback-"));
  const schemas = join(root, "public/schemas/exports/v1");
  const exports = join(root, "public/exports/v1");
  await mkdir(schemas, { recursive: true });
  await mkdir(exports, { recursive: true });
  await writeFile(join(schemas, "index.json"), "previous schema index\n");
  await writeFile(join(schemas, "previous-schema.json"), "previous schema\n");
  await writeFile(join(exports, "index.json"), "previous export index\n");
  await writeFile(join(exports, "previous-paper.json"), "previous paper\n");

  const prepared = createLiveExportBundle({
    contentRevision: "1".repeat(64),
    profile: "preview",
    papers: [],
    experiments: [],
  });
  const schemasOnly = {
    ...prepared,
    files: prepared.files.filter((file) => file.path.startsWith("/schemas/exports/v1/")),
  };
  expect(schemasOnly.files.length).toBeGreaterThan(0);
  // The first subtree can be installed, but no second staging directory is created.
  await expect(publishLiveExportBundle(root, schemasOnly)).rejects.toMatchObject({ code: "ENOENT" });

  expect((await readdir(schemas)).sort()).toEqual(["index.json", "previous-schema.json"]);
  expect((await readdir(exports)).sort()).toEqual(["index.json", "previous-paper.json"]);
  expect(await readFile(join(schemas, "index.json"), "utf8")).toBe("previous schema index\n");
  expect(await readFile(join(schemas, "previous-schema.json"), "utf8")).toBe("previous schema\n");
  expect(await readFile(join(exports, "index.json"), "utf8")).toBe("previous export index\n");
  expect(await readFile(join(exports, "previous-paper.json"), "utf8")).toBe("previous paper\n");

  const builds = (await readdir(join(root, "generated")))
    .filter((name) => name.startsWith("exports-build-"));
  expect(builds).toHaveLength(1);
  const stage = join(root, "generated", builds[0]!);
  for (const file of schemasOnly.files) {
    expect(await readFile(join(stage, file.path.slice(1)), "utf8")).toBe(file.text);
  }
});
