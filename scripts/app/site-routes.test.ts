/**
 * The site's routes and the files its pages ask for: what the edition export checks every page
 * against (scripts/app/site-routes.ts).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { editionPageFor, pageAssetReferences, sitemapRoutes } from "./site-routes.ts";

describe("site routes", () => {
  it("names a route's page as the static build writes it", () => {
    assert.equal(editionPageFor("/"), "index.html");
    assert.equal(editionPageFor("/papers/brownian-motion/"), "papers/brownian-motion/index.html");
    assert.equal(editionPageFor("/lab/sr-01"), "lab/sr-01/index.html");
  });

  it("reads only the site's own routes from a sitemap", () => {
    const xml =
      "<urlset><url><loc>https://annus-mirabilis.com/b/</loc></url><url><loc> https://annus-mirabilis.com/a/ </loc></url><url><loc>https://example.com/c/</loc></url></urlset>";
    assert.deepEqual(sitemapRoutes(xml, "https://annus-mirabilis.com"), ["/a/", "/b/"]);
  });
});

describe("the files a page asks for", () => {
  it("lists local assets by src and href, decoded once, and leaves links to pages alone", () => {
    const html = [
      '<script src="/_next/static/chunks/app/%5Bpaper%5D/page-1.js"></script>',
      '<link rel="stylesheet" href="/_next/static/css/site.css?v=2">',
      '<a href="/papers/brownian-motion/">a page</a>',
      '<a href="/papers/pdfs/ap-17-549.pdf#page=2">a facsimile</a>',
      '<img src="https://example.com/remote.png">',
      '<link rel="preload" href="/fonts/%2Fodd%25name.woff2">',
    ].join("");
    assert.deepEqual(pageAssetReferences(html), [
      "_next/static/chunks/app/[paper]/page-1.js",
      "_next/static/css/site.css",
      "fonts//odd%name.woff2",
      "papers/pdfs/ap-17-549.pdf",
    ]);
  });

  it("keeps a reference that does not decode, so it is reported rather than dropped", () => {
    assert.deepEqual(pageAssetReferences('<script src="/bad%E0%A4%A.js"></script>'), [
      "bad%E0%A4%A.js",
    ]);
  });
});
