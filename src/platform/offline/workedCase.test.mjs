import assert from "node:assert/strict";
import test from "node:test";
import { readInstrumentWorkedCase } from "../../../scripts/instrument-worked-case.ts";
import { chapterFixture, fixtureMath } from "./chapter.test.mjs";
import { packageOfflineChapter } from "./chapter.ts";
import {
  OfflineWorkedCaseError,
  offlineWorkedCaseIndex,
  renderOfflineWorkedCase,
} from "./workedCase.ts";

// A display fixture, not a numerical validation: the real laboratory extractor owns the format.
function prepared() {
  const record = readInstrumentWorkedCase(
    '<section data-instrument-id="bm-06" data-snapshot-version="1" data-accepted-input-revision="0">' +
      '<label for="time">Elapsed time (s)</label><input id="time" value="1"/>' +
      '<label for="seed">Trial seed</label><input id="seed" value="18446744073709551615"/>' +
      "<table><caption>Probability in selected intervals</caption><thead><tr><th>Interval (μm)</th><th>Probability</th></tr></thead>" +
      "<tbody><tr><th>[−1, 1]</th><td>71.94%</td></tr><tr><th>[−2, 2]</th><td>96.9%</td></tr></tbody></table>" +
      "<table><caption>Quantities in this example</caption><tbody><tr><th>Diffusivity</th><td>4.294 × 10<sup>−13</sup> m<sup>2</sup>/s</td></tr>" +
      "<tr><th>Molecular number</th><td>Requires a known radius.</td></tr></tbody></table></section>",
    {
      instrumentId: "bm-06",
      mode: null,
      title: "The spreading laboratory",
      notModeled: ["Molecular collisions."],
      sources: [
        { href: "/papers/brownian-motion/#s4", label: "Brownian motion, section 4" },
        { href: "/papers/brownian-motion/#s5", label: "Brownian motion, section 5" },
        { href: "/papers/mass-energy/#s0", label: "Mass and energy" },
      ],
    },
  );
  assert.equal(record.kind, "prepared");
  return record;
}

const context = {
  origin: "https://annus-mirabilis.com",
  paper: "brownian-motion",
  section: "s4",
  explanationAnchor: "explanation-s4",
};

test("saved examples preserve the actual interval tables, units, settings and nonnumeric explanations", () => {
  const html = renderOfflineWorkedCase(prepared(), "bm-06", context);
  for (const text of [
    "Probability in selected intervals",
    "[−1, 1]",
    "71.94%",
    "96.9%",
    "Elapsed time (s)",
    "18446744073709551615",
    "4.294 × 10<sup>−13</sup> m<sup>2</sup>/s",
    "Requires a known radius.",
    "Not modeled: Molecular collisions.",
    "Static worked example",
  ])
    assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /No numeric value|NaN|<input|<select|<script|<canvas/);
  assert.match(html, /<th scope="col"/);
  assert.match(html, /<th scope="row"/);
});

test("source links stay local only for this chapter and all other links work from disk", () => {
  const html = renderOfflineWorkedCase(prepared(), "bm-06", context);
  assert.match(html, /href="#explanation-s4"/);
  assert.match(html, /href="https:\/\/annus-mirabilis\.com\/papers\/brownian-motion\/#s5"/);
  assert.match(html, /href="https:\/\/annus-mirabilis\.com\/papers\/mass-energy\/#s0"/);
  assert.match(html, /href="https:\/\/annus-mirabilis\.com\/lab\/bm-06\/"/);
  assert.doesNotMatch(html, /href="\/[^/]/);
});

test("unavailable, foreign and mode-specific examples never borrow default numbers", () => {
  const record = prepared();
  for (const candidate of [
    undefined,
    { kind: "unavailable", address: "bm-06", reason: "No prepared record." },
    { ...record, instrumentId: "bm-01" },
    { ...record, address: "bm-01" },
    { ...record, mode: "another-mode" },
    { ...record, origin: "live-result" },
  ]) {
    const html = renderOfflineWorkedCase(candidate, "bm-06", context);
    assert.match(html, /data-prepared-case-unavailable/);
    assert.doesNotMatch(html, /71\.94|96\.9|4\.294/);
    assert.match(html, /Read the full laboratory online/);
  }
});

test("qualitative reconstructions retain their explanation without acquiring a numerical claim", () => {
  const record = prepared();
  const html = renderOfflineWorkedCase(
    {
      ...record,
      tables: [],
      statements: [
        { kind: "qualitative", content: [{ t: "Both descriptions predict the same current." }] },
      ],
    },
    "bm-06",
    context,
  );
  assert.match(html, /Prepared qualitative reconstruction/);
  assert.match(html, /Both descriptions predict the same current/);
  assert.doesNotMatch(html, /<table|Static worked example/);
});

test("authored labels and notes stay inert, and excluded rows are disclosed", () => {
  const record = prepared();
  const html = renderOfflineWorkedCase(
    {
      ...record,
      title: '<img src=x onerror="bad()">',
      notes: ["</p><script>bad()</script>"],
      omittedSettings: 1,
      omittedStatements: 2,
      omittedTables: 3,
      tables: record.tables.map((table) => ({ ...table, omittedRows: 4 })),
    },
    "bm-06",
    { ...context, sourceDigest: "source:sha256:known-evaluator" },
  );
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script/);
  assert.doesNotMatch(html, /<img|<script/);
  for (const text of [
    "1 further settings",
    "2 further accepted readouts",
    "3 further result tables",
    "4 further rows",
    "source:sha256:known-evaluator",
  ])
    assert.ok(html.includes(text), text);
});

test("unsupported worked-case indexes and unsafe source links are refused", () => {
  for (const value of [null, {}, { schemaVersion: 2, cases: {} }, { schemaVersion: 1, cases: [] }])
    assert.throws(
      () => offlineWorkedCaseIndex(value),
      (error) =>
        error instanceof OfflineWorkedCaseError && error.code === "offline-worked-case-schema",
    );
  const record = prepared();
  for (const href of [
    "javascript:alert(1)",
    "http://example.org/source",
    "https://user:password@example.org/source",
  ])
    assert.throws(
      () =>
        renderOfflineWorkedCase(
          { ...record, sources: [{ href, label: "Source" }] },
          "bm-06",
          context,
        ),
      (error) =>
        error instanceof OfflineWorkedCaseError && error.code === "offline-worked-case-link",
    );
});

test("chapter publication uses prepared laboratory views even when no scalar transport example exists", () => {
  const fixture = chapterFixture();
  fixture.arguments[0].experiments = ["bm-06"];
  fixture.examples = [];
  fixture.workedCases = offlineWorkedCaseIndex({
    schemaVersion: 1,
    cases: { "bm-06": prepared() },
  });
  const { html } = packageOfflineChapter(fixture, fixtureMath);
  assert.match(html, /data-prepared-worked-case="bm-06"/);
  assert.match(html, /71\.94%/);
  assert.match(html, /Requires a known radius/);
  assert.match(html, /href="#s4"/);
  assert.doesNotMatch(html, /data-prepared-case-unavailable|This laboratory is not included/);
  assert.equal(packageOfflineChapter(fixture, fixtureMath).html, html);
});

test("an unavailable prepared view does not fall back to an unrelated scalar snapshot", () => {
  const fixture = chapterFixture();
  fixture.workedCases = { schemaVersion: 1, cases: {} };
  const { html } = packageOfflineChapter(fixture, fixtureMath);
  assert.match(html, /data-prepared-case-unavailable/);
  assert.doesNotMatch(html, /-1e-7|sampleMean/);
});

test("malformed spans and omitted counts cannot introduce markup or silently alter a table", () => {
  const record = prepared();
  for (const value of ['1" onmouseover="bad()', 0, -1, 1.5, Infinity]) {
    for (const name of ["colSpan", "rowSpan"]) {
      const changed = structuredClone(record);
      changed.tables[0].rows[0][0][name] = value;
      assert.throws(
        () => renderOfflineWorkedCase(changed, "bm-06", context),
        (error) =>
          error instanceof OfflineWorkedCaseError && error.code === "offline-worked-case-count",
      );
    }
  }
  for (const field of ["omittedSettings", "omittedStatements", "omittedTables"]) {
    for (const value of ["1<script>bad()</script>", -1, Infinity])
      assert.throws(
        () => renderOfflineWorkedCase({ ...record, [field]: value }, "bm-06", context),
        (error) =>
          error instanceof OfflineWorkedCaseError && error.code === "offline-worked-case-count",
      );
  }
  const changed = structuredClone(record);
  changed.tables[0].omittedRows = -1;
  assert.throws(
    () => renderOfflineWorkedCase(changed, "bm-06", context),
    (error) =>
      error instanceof OfflineWorkedCaseError && error.code === "offline-worked-case-count",
  );
});

test("an unsupported statement kind cannot escape its attribute or be relabelled as a calculation", () => {
  const record = prepared();
  const changed = {
    ...record,
    statements: [{ kind: 'calculation" onclick="bad()', content: [{ t: "A readout" }] }],
  };
  assert.throws(
    () => renderOfflineWorkedCase(changed, "bm-06", context),
    (error) =>
      error instanceof OfflineWorkedCaseError && error.code === "offline-worked-case-statement",
  );
});
