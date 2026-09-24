/**
 * The association file claims exactly the pages the app carries, and is refused while the team id
 * is the owner's placeholder. The shared vectors (fixtures/route-vectors.json) are checked here on
 * the association side and in the Swift tests on the app's side.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ASSOCIATED_DOMAIN,
  AssociationFileError,
  associationFile,
  associationMatches,
  associationText,
  editionPages,
} from "./association-file.ts";
import { recordedIdentity, TEAM_ID_PLACEHOLDER } from "./identity.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUNDLE_ID = recordedIdentity(REPO)?.bundleId ?? "";
const TEAM = "ABCDE12345";

/** Manifest paths as the export writes them: pages, section pages, embeds, files. */
const FILES = [
  "index.html",
  "404.html",
  "404/index.html",
  "papers/brownian-motion/index.html",
  "papers/brownian-motion/s4/index.html",
  "lab/bm-01/index.html",
  "discover/brownian-motion/index.html",
  "embed/index.html",
  "embed/lab/bm-03/index.html",
  "offline/brownian-motion/s4-5ded94ae.html",
  "search/index-manifest.json",
  "_next/static/chunks/app.js",
];

type Vector = { url: string; association: boolean; why: string };
const VECTORS = JSON.parse(
  readFileSync(join(REPO, "scripts", "app", "fixtures", "route-vectors.json"), "utf8"),
) as Vector[];

const refusal = (code: string) => (error: unknown) =>
  error instanceof AssociationFileError && error.code === code;

describe("the association file", () => {
  const pages = editionPages(FILES);
  const file = associationFile({ teamId: TEAM, bundleId: BUNDLE_ID, pages });

  it("takes pages from the manifest's HTML files, and leaves out 404.html and every file", () => {
    assert.deepEqual(pages, [
      "/",
      "/404/",
      "/discover/brownian-motion/",
      "/embed/",
      "/embed/lab/bm-03/",
      "/lab/bm-01/",
      "/offline/brownian-motion/s4-5ded94ae.html",
      "/papers/brownian-motion/",
      "/papers/brownian-motion/s4/",
    ]);
  });

  it("names the recorded app and claims every page except embeds and the not-found page", () => {
    assert.ok(BUNDLE_ID.length > 0, "docs/DECISIONS.md records no bundle id");
    assert.deepEqual(file.applinks.details[0]?.appIDs, [`${TEAM}.${BUNDLE_ID}`]);
    for (const page of pages) {
      const claimed = !page.startsWith("/embed/") && !page.startsWith("/404/");
      assert.equal(associationMatches(file, page), claimed, page);
    }
    assert.equal(associationMatches(file, "/search/index-manifest.json"), false);
    assert.equal(associationMatches(file, "/_next/static/chunks/app.js"), false);
  });

  it("is the same bytes every time it is generated", () => {
    assert.equal(
      associationText(associationFile({ teamId: TEAM, bundleId: BUNDLE_ID, pages })),
      associationText(
        associationFile({ teamId: TEAM, bundleId: BUNDLE_ID, pages: [...pages].reverse() }),
      ),
    );
  });

  it("agrees with every shared vector on whether the system hands the link to the app", () => {
    assert.ok(VECTORS.some((v) => v.association) && VECTORS.some((v) => !v.association));
    for (const vector of VECTORS) {
      const url = new URL(vector.url);
      const ours =
        url.protocol === "https:" && url.hostname === ASSOCIATED_DOMAIN && url.port === "";
      assert.equal(ours && associationMatches(file, url.pathname), vector.association, vector.url);
    }
  });

  it("refuses the owner's placeholder by name, and anything that is not a team id", () => {
    assert.throws(
      () => associationFile({ teamId: TEAM_ID_PLACEHOLDER, bundleId: BUNDLE_ID, pages }),
      (error: unknown) =>
        refusal("team-id-placeholder")(error) &&
        (error as Error).message.includes("am-app-apple-account-setup-9xi1"),
    );
    for (const teamId of ["abcde12345", "ABCDE1234", "ABCDE123456", ""]) {
      assert.throws(
        () => associationFile({ teamId, bundleId: BUNDLE_ID, pages }),
        refusal("team-id-invalid"),
      );
    }
    assert.throws(
      () => associationFile({ teamId: TEAM, bundleId: BUNDLE_ID, pages: [] }),
      refusal("no-pages"),
    );
  });

  it("is refused for this repository today, whose team id is still the placeholder", () => {
    const identity = recordedIdentity(REPO);
    assert.equal(identity?.teamId, TEAM_ID_PLACEHOLDER);
    assert.throws(
      () => associationFile({ teamId: identity?.teamId ?? "", bundleId: BUNDLE_ID, pages }),
      refusal("team-id-placeholder"),
    );
  });
});
