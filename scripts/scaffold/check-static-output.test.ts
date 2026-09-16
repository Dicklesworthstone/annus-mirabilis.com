import assert from "node:assert/strict";
import test from "node:test";
import {
  checkBodyContains,
  checkExpectedStatus,
  checkNoCrossOriginReferences,
  findCrossOriginReferences,
} from "./check-static-output.ts";

const ORIGIN = "https://annus-mirabilis.com";

test('<script src="/_next/static/a.js"> and <img src="/icon.png"> pass', () => {
  const html = '<script src="/_next/static/a.js"></script><img src="/icon.png">';
  assert.deepEqual(findCrossOriginReferences(html, ORIGIN), []);
});

test('<script src="https://cdn.example/x.js">, <link href="//fonts.example/css">, and <img src="http://example.org/a.png"> fail naming the origin', () => {
  const html =
    '<script src="https://cdn.example/x.js"></script>' +
    '<link rel="stylesheet" href="//fonts.example/css">' +
    '<img src="http://example.org/a.png">';
  const found = findCrossOriginReferences(html, ORIGIN);
  assert.deepEqual(found, [
    {
      tag: "script",
      attribute: "src",
      url: "https://cdn.example/x.js",
      origin: "https://cdn.example",
    },
    { tag: "link", attribute: "href", url: "//fonts.example/css", origin: "https://fonts.example" },
    { tag: "img", attribute: "src", url: "http://example.org/a.png", origin: "http://example.org" },
  ]);
});

test('a plain <a href="https://github.com/..."> passes because a hyperlink is not a request', () => {
  const html = '<a href="https://github.com/example/example">source</a>';
  assert.deepEqual(findCrossOriginReferences(html, ORIGIN), []);
});

test("checkExpectedStatus passes and fails on the documented status codes", () => {
  const ok = checkExpectedStatus(
    { url: `${ORIGIN}/`, status: 200, headers: {}, body: "" },
    "home-page-200",
    200,
  );
  assert.equal(ok.outcome, "pass");
  const notFound = checkExpectedStatus(
    { url: `${ORIGIN}/missing`, status: 200, headers: {}, body: "" },
    "unknown-path-404",
    404,
  );
  assert.equal(notFound.outcome, "fail");
  assert.match(notFound.message, /expected 404/);
});

test("checkBodyContains passes and fails on the expected substring", () => {
  const pass = checkBodyContains(
    {
      url: `${ORIGIN}/`,
      status: 200,
      headers: {},
      body: "<h1>The edition is in preparation.</h1>",
    },
    "home-page-text",
    "in preparation",
  );
  assert.equal(pass.outcome, "pass");
  const fail = checkBodyContains(
    { url: `${ORIGIN}/`, status: 200, headers: {}, body: "<h1>Coming soon!</h1>" },
    "home-page-text",
    "in preparation",
  );
  assert.equal(fail.outcome, "fail");
});

test("checkNoCrossOriginReferences passes on same-origin markup and fails naming each third-party origin", () => {
  const clean = checkNoCrossOriginReferences(
    {
      url: `${ORIGIN}/`,
      status: 200,
      headers: {},
      body: '<script src="/_next/static/a.js"></script>',
    },
    "home-page-no-third-party-origin",
    ORIGIN,
  );
  assert.equal(clean.outcome, "pass");
  const dirty = checkNoCrossOriginReferences(
    {
      url: `${ORIGIN}/`,
      status: 200,
      headers: {},
      body: '<script src="https://cdn.example/x.js"></script>',
    },
    "home-page-no-third-party-origin",
    ORIGIN,
  );
  assert.equal(dirty.outcome, "fail");
  assert.match(dirty.message, /https:\/\/cdn\.example/);
});
