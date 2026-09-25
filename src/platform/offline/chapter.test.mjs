import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { collectChapterFoundations, packageOfflineChapter } from "./chapter.ts";
import { OFFLINE_DETAIL_SOURCE } from "./detail.inline.ts";

export function chapterFixture() {
  const p = (text) => ({ kind: "paragraph", text });
  return {
    paper: {
      id: "brownian-motion",
      title: "Motion and measurement",
      germanTitle: "Über die Bewegung",
      citation: "source",
      description: "An explanation",
      sourceNotice: "Source review is pending.",
      sections: [{ id: "s4", title: "Choose the observable", arguments: ["arg-bm-observable"] }],
    },
    section: { id: "s4", title: "Choose the observable", arguments: ["arg-bm-observable"] },
    arguments: [
      {
        id: "arg-bm-observable",
        paper: "brownian-motion",
        section: "s4",
        title: "Watch the spread",
        question: "What should we measure?",
        recap: "Mean square is useful.",
        citations: ["source"],
        premises: ["Independent steps"],
        limitations: ["Not instantaneous speed"],
        experiments: ["bm-01", "bm-08"],
        help: { why: "squares", missingStep: "squares", example: "squares" },
        readings: {
          overview: [p("A cloud spreads.")],
          full: [
            p("The signed mean may vanish."),
            { kind: "formula", latex: "x^2", spoken: "x squared" },
            { kind: "foundation", id: "squares", returnCaption: "Why use squares?" },
          ],
          steps: [{ kind: "steps", items: ["Square the distances.", "Take their mean."] }],
          margin: [p("A modern qualification.")],
        },
      },
    ],
    foundations: [
      {
        id: "squares",
        title: "Mean squares",
        question: "Why square?",
        summary: "Retain spread.",
        prerequisites: ["arithmetic"],
        explanation: [p("Squares do not cancel.")],
        example: [p("The mean of -1 and 1 is zero; their mean square is one.")],
        stoppingPoint: "No model of collisions is needed.",
        citations: ["source"],
      },
      {
        id: "arithmetic",
        title: "Arithmetic",
        question: "How to take a mean?",
        summary: "Add and divide.",
        prerequisites: [],
        explanation: [p("Add the values.")],
        example: [p("One plus one is two.")],
        stoppingPoint: "This defines the mean.",
        citations: ["source"],
      },
    ],
    citations: [
      {
        id: "source",
        title: "Original source",
        locator: "Section 4, page 559",
        url: "https://example.org/source",
      },
    ],
    equations: [],
    examples: [
      {
        instrumentId: "bm-01",
        sourceDigest: `source:sha256:${"d".repeat(64)}`,
        parameters: { seed: "18446744073709551615", M: 400 },
        rows: [
          { quantity: "sampleMean", value: "-1e-7", unit: "m", status: "value" },
          {
            quantity: "apparentSpeed",
            value: "not applicable",
            unit: "m/s",
            status: "not-applicable",
          },
        ],
        omittedArrays: 2,
      },
    ],
    identity: {
      buildDigest: "a".repeat(64),
      contentRevision: "b".repeat(64),
      translationRevision: null,
      generatedAt: "2026-09-17T12:00:00Z",
      releaseId: null,
    },
    assets: {
      mathCss: ".katex{font-size:1em}",
      printCss: "@media print{p{orphans:2}}",
      notices: ["Fixture license notice"],
    },
    budget: { rawBytes: 2097152, gzipBytes: 700000 },
  };
}
// Structural fixture only: the production adapter calls KaTeX, not this renderer.
export const fixtureMath = () =>
  '<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><msup><mi>x</mi><mn>2</mn></msup></math></span><span class="katex-html" aria-hidden="true">x²</span></span>';
const build = (input = chapterFixture()) => packageOfflineChapter(input, fixtureMath);

test("one chapter retains every reading, with full explanation visible without JS", () => {
  const { html } = build();
  for (const text of [
    "A cloud spreads.",
    "The signed mean may vanish.",
    "Square the distances.",
    "A modern qualification.",
  ])
    assert.ok(html.includes(text));
  assert.match(html, /data-reading="0" hidden/);
  assert.match(html, /data-reading="1">/);
  assert.match(html, /data-reading="2" hidden/);
  assert.match(html, /data-reading="3" hidden/);
});
test("foundation closure includes transitive prerequisites and exact local links", () => {
  const input = chapterFixture();
  assert.deepEqual(
    collectChapterFoundations(input.arguments, input.foundations).map((f) => f.id),
    ["arithmetic", "squares"],
  );
  const { html } = build(input);
  assert.match(html, /id="foundation-arithmetic"/);
  assert.match(html, /href="#foundation-squares"/);
  assert.match(html, /No model of collisions is needed/);
});
test("missing and cyclic foundations fail instead of making an offline dead end", () => {
  const input = chapterFixture();
  input.foundations.pop();
  assert.throws(() => build(input), /Missing offline foundation: arithmetic/);
  const cycle = chapterFixture();
  cycle.foundations[1].prerequisites = ["squares"];
  assert.throws(() => build(cycle), /Cyclic offline foundation/);
});
test("duplicate foundations fail", () => {
  const input = chapterFixture();
  input.foundations.push(input.foundations[0]);
  assert.throws(() => build(input), /Duplicate foundation/);
});
test("section is in authored order and refuses absent or foreign arguments", () => {
  const input = chapterFixture();
  input.arguments[0].paper = "mass-energy";
  assert.throws(() => build(input), /mismatched offline argument/);
  input.arguments = [];
  assert.throws(() => build(input), /Missing or mismatched/);
});
test("provenance, German language and missing translation are explicit, with no review notice", () => {
  const { html } = build();
  // The record's source notice ("Source review is pending." in this fixture) is not printed, and
  // nothing says review (D-2026-09-25-no-review-status-banners).
  assert.ok(!html.includes("Source review is pending."), "the source notice is not printed");
  assert.ok(!/review pending|reviewed/.test(html), "no review wording");
  for (const text of [
    'lang="de"',
    "Section 4, page 559",
    "None: this file holds the explanation, not the translation",
    "a".repeat(64),
    "b".repeat(64),
    "Fixture license notice",
  ])
    assert.ok(html.includes(text), text);
});
test("authored strings are escaped, not interpreted as executable markup", () => {
  const input = chapterFixture();
  input.arguments[0].readings.full[0].text = '<img src="https://evil.example" onerror="bad()">';
  input.assets.notices = ["</pre><script>bad()</script>"];
  const { html } = build(input);
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("&lt;/pre&gt;"));
  assert.equal((html.match(/<script>/gu) ?? []).length, 1);
});
test("missing citations fail and executable citation URLs are refused", () => {
  const input = chapterFixture();
  input.citations = [];
  assert.throws(() => build(input), /Missing offline citation/);
  const bad = chapterFixture();
  bad.citations[0].url = "javascript:alert(1)";
  assert.throws(() => build(bad), /HTTPS/);
});
test("credentials in source links are refused", () => {
  const input = chapterFixture();
  input.citations[0].url = "https://user:pass@example.org/";
  assert.throws(() => build(input), /credentials/);
});
test("no stored data is inspected and no active remote resources occur", () => {
  const { html } = build();
  assert.doesNotMatch(
    html,
    /localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|sendBeacon|new Worker|<canvas|<iframe|<img/,
  );
  assert.doesNotMatch(html, /<link[^>]+(?:stylesheet|preload)|<script[^>]+src=/);
  assert.ok(html.includes("connect-src &#39;none&#39;"));
});
test("only one exact, hash-authorized script is embedded", () => {
  const { html, scriptHash } = build();
  assert.equal(html.split("<script>")[1].split("</script>")[0], OFFLINE_DETAIL_SOURCE);
  assert.equal(scriptHash, createHash("sha256").update(OFFLINE_DETAIL_SOURCE).digest("base64"));
  assert.ok(html.includes(scriptHash));
});
test("raw byte sizes, gzip size and content-addressed name describe actual bytes", () => {
  const result = build();
  assert.equal(result.entry.bytes, Buffer.byteLength(result.html));
  assert.ok(result.entry.gzipBytes < result.entry.bytes);
  assert.equal(result.entry.sha256, createHash("sha256").update(result.html).digest("hex"));
  assert.ok(result.entry.path.endsWith(`${result.entry.sha256}.html`));
});
test("the same input yields byte-identical output and a changed reading changes the path", () => {
  assert.deepEqual(build(), build());
  const changed = chapterFixture();
  changed.arguments[0].readings.steps[0].items.push("A new step.");
  assert.notEqual(build(changed).entry.path, build().entry.path);
});
test("size limits fail with the chapter name and contributor breakdown", () => {
  const input = chapterFixture();
  input.budget.rawBytes = 1;
  assert.throws(() => build(input), /brownian-motion\/s4 exceeds budget.*stylesAndFonts/);
  const compressed = chapterFixture();
  compressed.budget.gzipBytes = 1;
  assert.throws(() => build(compressed), /gzip bytes/);
});
test("byte budget equality is accepted", () => {
  const reference = build(),
    input = chapterFixture();
  input.budget = { rawBytes: reference.entry.bytes, gzipBytes: reference.entry.gzipBytes };
  assert.equal(build(input).html, reference.html);
});
test("static examples preserve exact seeds, canonical readouts and typed absence", () => {
  const { html } = build();
  for (const text of [
    "18446744073709551615",
    "-1e-7",
    "not-applicable",
    "Static host-calculated",
    "2 array outputs",
  ])
    assert.ok(html.includes(text));
  assert.match(html, /bm-08.*not included/s);
});
test("styles cannot load external resources or escape their element", () => {
  for (const css of [
    '@import "https://example.org/x.css";',
    "a{background:url(/remote.png)}",
    "</style><script>bad()</script>",
  ]) {
    const input = chapterFixture();
    input.assets.mathCss = css;
    assert.throws(() => build(input), /Offline styles/);
  }
});
test("embedded math fonts are permitted", () => {
  const input = chapterFixture();
  input.assets.mathCss = "@font-face{src:url(data:font/woff2;base64,d09GMg==)}";
  assert.doesNotThrow(() => build(input));
});
test("math must be static HTML plus MathML", () => {
  for (const html of [
    "<span>x</span>",
    '<span class="katex"><math></math><script>bad()</script></span>',
    '<span class="katex" onclick="bad()"><math></math></span>',
    '<span class="katex"><math><a href="https://example.org">x</a></math></span>',
  ]) {
    assert.throws(() => packageOfflineChapter(chapterFixture(), () => html), /static KaTeX/);
  }
});
test("unknown block kinds require a deliberate renderer", () => {
  const input = chapterFixture();
  input.arguments[0].readings.full.push({ kind: "raw-html", text: "raw" });
  assert.throws(() => build(input), /explicit offline renderer/);
});
test("malformed revision identities and invalid content ids are refused", () => {
  const input = chapterFixture();
  input.identity.contentRevision = "unknown";
  assert.throws(() => build(input), /revision identity/);
  const bad = chapterFixture();
  bad.section.id = "../../escape";
  assert.throws(() => build(bad), /content id/);
});
test("base64 slashes and quoted embedded font URLs are not mistaken for network URLs", () => {
  for (const css of [
    "@font-face{src:url(data:font/woff2;base64,d09GMg//AAAA)}",
    '@font-face{src:url("data:font/woff2;base64,d09GMg//AAAA")}',
    "@font-face{src:url('data:font/woff2;base64,d09GMg//AAAA')}",
  ]) {
    const input = chapterFixture();
    input.assets.mathCss = css;
    assert.doesNotThrow(() => build(input));
  }
});
