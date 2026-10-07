import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  CAPSTONE_RETURN_PAPERS,
  capstoneReturnHref,
  nextCapstoneReturn,
  withCapstoneReturn,
  worksheetPaper,
} from "./returnRoute.ts";

test("each worksheet has a fixed public destination, never a caller-supplied return URL", () => {
  for (const paper of Object.keys(CAPSTONE_RETURN_PAPERS)) {
    const parsed = worksheetPaper(`/capstones/${paper}/`);
    assert.equal(parsed, paper);
    assert.ok(parsed);
    assert.equal(capstoneReturnHref(parsed), `/capstones/${paper}/#capstone-worksheet`);
  }
  for (const path of ["/capstones/../evil/", "/capstones/brownian/", "/discover/brownian-motion/", "/capstones/__proto__/"]) {
    assert.equal(worksheetPaper(path), null);
  }
});

test("tape encoding, query ordering, repeated unrelated parameters and the source anchor survive exactly", () => {
  const href = "/lab/sr-03/?tape=a%2Fb%2B%3D&x=a+b&x=two#result";
  assert.equal(withCapstoneReturn(href, "special-relativity"),
    "/lab/sr-03/?tape=a%2Fb%2B%3D&x=a+b&x=two&fromCapstone=special-relativity#result");
  const source = "/papers/brownian-motion/view/parallel/#s4-p3";
  assert.equal(withCapstoneReturn(source, "brownian-motion"),
    "/papers/brownian-motion/view/parallel/?fromCapstone=brownian-motion#s4-p3");
});

test("link decoration is idempotent and does not replace another explicit context", () => {
  const once = withCapstoneReturn("/tapes/the-two-pulses/", "mass-energy");
  assert.equal(withCapstoneReturn(once, "mass-energy"), once);
  assert.equal(withCapstoneReturn(once, "special-relativity"), once);
  assert.equal(withCapstoneReturn("/lab/me-01/?", "mass-energy"), "/lab/me-01/?fromCapstone=mass-energy");
});

test("external, private, noncanonical and oversized links are untouched", () => {
  const hrefs = ["https://evil.test/", "//evil.test/lab/me-01/", "javascript:alert(1)",
    "/notebook/", "/your-data/", "/lab/me-01/../me-02/", "/lab/%2fme-01/", "/lab/me-01/\\evil",
    "/lab/me-01/\n", `/lab/me-01/?tape=${"x".repeat(2010)}`];
  for (const href of hrefs) assert.equal(withCapstoneReturn(href, "mass-energy"), href, href);
  assert.equal(withCapstoneReturn("/lab/me-01/", "https://evil.test/"), "/lab/me-01/");
});

test("an admitted context survives a source face change or clarification, but not unrelated navigation", () => {
  const first = nextCapstoneReturn(null, "/papers/special-relativity/view/parallel/", "?fromCapstone=special-relativity");
  assert.deepEqual(first, { paper: "special-relativity", destination: "/papers/special-relativity/" });
  assert.equal(nextCapstoneReturn(first, "/papers/special-relativity/", "?open=foundation:algebra"), first);
  assert.equal(nextCapstoneReturn(first, "/papers/special-relativity/s1/", "?view=german"), first);
  assert.equal(nextCapstoneReturn(first, "/papers/mass-energy/", ""), null);
  assert.equal(nextCapstoneReturn(first, "/notebook/", ""), null);
  assert.equal(nextCapstoneReturn(first, "/capstones/special-relativity/", ""), null);
});

test("invalid or duplicated return parameters clear context, even after a valid visit", () => {
  const first = nextCapstoneReturn(null, "/lab/bm-01/", "?fromCapstone=brownian-motion");
  assert.ok(first);
  for (const query of ["?fromCapstone=https://evil.test", "?fromCapstone=__proto__", "?fromCapstone=",
    "?fromCapstone=brownian-motion&fromCapstone=brownian-motion", "?fromCapstone=mass-energy&" + "x".repeat(4096)]) {
    assert.equal(nextCapstoneReturn(first, "/lab/bm-01/", query), null);
  }
});

test("an enhanced second destination can continue the same worksheet without any saved text", () => {
  const href = withCapstoneReturn("/foundations/probability/?detail=2#worked", "light-quanta");
  const url = new URL(href, "https://annus-mirabilis.com");
  const context = nextCapstoneReturn(null, url.pathname, url.search);
  assert.deepEqual(context, { paper: "light-quanta", destination: "/foundations/probability/" });
  assert.deepEqual([...url.searchParams.keys()], ["detail", "fromCapstone"]);
});
