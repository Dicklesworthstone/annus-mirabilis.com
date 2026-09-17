import assert from "node:assert/strict";
import test from "node:test";
import { getLogger, newRunIdentity } from "../../testing/log/logger.ts";
import {
  buildCanonicalDocumentUrl,
  getPermalinkRobotsPolicy,
  isSitemapExemptUrl,
} from "./canonical.ts";

const logRunId = newRunIdentity();
const logger = getLogger("permalink", logRunId);

test("permalink.canonical: strips ?tape= and presentation parameters from canonical document URL", () => {
  const tapeUrl =
    "https://annus-mirabilis.com/lab/bm-01?tape=eyJsYWIiOiJibTAxIn0&view=parallel&detail=2#s3-p2";
  const canonical = buildCanonicalDocumentUrl(tapeUrl);
  assert.equal(canonical, "https://annus-mirabilis.com/lab/bm-01#s3-p2");

  const relativeUrl = "/papers/brownian-motion?tape=abc123xyz&view=split";
  const relativeCanonical = buildCanonicalDocumentUrl(relativeUrl);
  assert.equal(relativeCanonical, "/papers/brownian-motion");
});

test("permalink.canonical: sets noindex,follow on tape variants and index,follow on canonical routes", () => {
  const withTape = getPermalinkRobotsPolicy("/lab/bm-01?tape=abc123xyz");
  assert.equal(withTape.isNoindex, true);
  assert.equal(withTape.robots, "noindex,follow");
  assert.equal(withTape.canonicalUrl, "/lab/bm-01");

  const cleanDoc = getPermalinkRobotsPolicy("/lab/bm-01");
  assert.equal(cleanDoc.isNoindex, false);
  assert.equal(cleanDoc.robots, "index,follow");
  assert.equal(cleanDoc.canonicalUrl, "/lab/bm-01");
});

test("permalink.canonical: sitemaps exempt tape permalinks and export paths", () => {
  assert.equal(isSitemapExemptUrl("/lab/bm-01?tape=abc"), true);
  assert.equal(isSitemapExemptUrl("/lab/bm-01&tape=abc"), true);
  assert.equal(isSitemapExemptUrl("/notebook/export"), true);
  assert.equal(isSitemapExemptUrl("/artifacts/export.json"), true);

  assert.equal(isSitemapExemptUrl("/lab/bm-01"), false);
  assert.equal(isSitemapExemptUrl("/papers/brownian-motion"), false);

  logger.log({
    testId: "permalink-canonical-and-indexing-policy",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    message: "Canonical URL stripping, noindex policy, and sitemap exclusion verified",
  });
});

test("negative: no private or unknown query parameter survives into the canonical", () => {
  // This was a denylist (tape/view/detail/lens/notation/units), so anything it
  // did not name leaked. `note` is a private reader identifier and reached the
  // canonical, which is a link addressed to crawlers.
  const withNote = buildCanonicalDocumentUrl(
    "https://annus-mirabilis.com/papers/brownian-motion/?note=private&tape=tok#arg-bm-observable",
  );
  assert.equal(withNote, "https://annus-mirabilis.com/papers/brownian-motion/#arg-bm-observable");
  assert.ok(!withNote.includes("note"), "canonical must not carry a note parameter");

  // A parameter nobody has thought of yet must also not survive.
  const withUnknown = buildCanonicalDocumentUrl(
    "https://annus-mirabilis.com/lab/bm-01/?someFutureParam=secret",
  );
  assert.equal(withUnknown, "https://annus-mirabilis.com/lab/bm-01/");
  assert.ok(!withUnknown.includes("secret"), "canonical must not carry an unknown parameter");
});
