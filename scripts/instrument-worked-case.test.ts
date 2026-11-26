import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readInstrumentWorkedCase,
  WORKED_CASE_LIMITS,
  type WorkedCaseMetadata,
} from "./instrument-worked-case.ts";

const metadata: WorkedCaseMetadata = {
  instrumentId: "bm-06",
  mode: null,
  title: "The spreading laboratory",
  notModeled: ["Molecular collisions."],
  sources: [{ href: "/papers/brownian-motion/#s4", label: "Brownian motion, section 4" }],
};

const controls =
  '<label for="temperature">Temperature (K)</label><input id="temperature" value="293.15"/>';
const readouts =
  "<table><caption>One accepted calculation</caption><thead><tr><th>Quantity</th><th>Value</th></tr></thead><tbody><tr><th>Interval probability</th><td>71.94%</td></tr><tr><th>Molecular number</th><td>Requires a known particle radius.</td></tr><tr><th>Diffusivity</th><td>4.294 × 10<sup>−13</sup> m<sup>2</sup>/s</td></tr></tbody></table>";

function laboratory(body = controls + readouts, address = "bm-06") {
  return (
    '<section data-instrument-id="' +
    address +
    '" data-snapshot-version="1" data-accepted-input-revision="0" data-pending="false">' +
    body +
    "</section>"
  );
}

function prepared(body = controls + readouts) {
  const result = readInstrumentWorkedCase(laboratory(body), metadata);
  assert.equal(result.kind, "prepared");
  assert.ok(result.kind === "prepared");
  return result;
}

test("reads actual displayed settings, units, captions and nonnumeric results without recomputing them", () => {
  const result = prepared();
  assert.equal(result.origin, "prepared-default");
  assert.deepEqual(result.settings, [{ label: "Temperature (K)", value: "293.15" }]);
  assert.equal(result.tables[0]?.caption, "One accepted calculation");
  assert.equal(result.tables[0]?.rows[0]?.[1]?.content[0]?.t, "71.94%");
  assert.equal(result.tables[0]?.rows[1]?.[1]?.content[0]?.t, "Requires a known particle radius.");
  assert.deepEqual(result.tables[0]?.rows[2]?.[1]?.content, [
    { t: "4.294 × 10" },
    { t: "−13", s: "sup" },
    { t: " m" },
    { t: "2", s: "sup" },
    { t: "/s" },
  ]);
  assert.deepEqual(result.notModeled, metadata.notModeled);
  assert.deepEqual(result.sources, metadata.sources);
});

test("records range-only controls while preferring an exact typed value to a clamped paired slider", () => {
  const body =
    '<label id="speed-label" for="speed">Speed (fraction of c)</label>' +
    '<input type="range" aria-labelledby="speed-label" value="0.9"/>' +
    '<input id="speed" type="text" value="0.97"/>' +
    '<label for="angle">Angle (degrees)</label><input id="angle" type="range" value="45"/>' +
    readouts;
  assert.deepEqual(prepared(body).settings, [
    { label: "Speed (fraction of c)", value: "0.97" },
    { label: "Angle (degrees)", value: "45" },
  ]);
});

test("keeps selected modes and checkbox state, including settings inside their closed drawer", () => {
  const body =
    "<details><summary>Settings</summary>" +
    '<label for="law">Step law</label><select id="law"><option>Coin</option><option selected="">Gaussian</option></select>' +
    '<label><input type="checkbox"/>Compare with a grid</label>' +
    '<label><input type="radio" name="mode" checked=""/>Analytic</label>' +
    '<label><input type="radio" name="mode"/>Apparatus</label></details>' +
    readouts;
  assert.deepEqual(prepared(body).settings, [
    { label: "Step law", value: "Gaussian" },
    { label: "Compare with a grid", value: "Off" },
    { label: "Analytic", value: "Selected" },
  ]);
});

test("preserves exponent meaning in text-only captions and setting labels", () => {
  const result = prepared(
    '<label for="area">Area (m<sup>2</sup>)</label><input id="area" value="3"/>' +
      readouts.replace(
        "One accepted calculation",
        "Probe at 5 × 10<sup>14</sup> Hz; coordinate x<sub>1</sub>",
      ),
  );
  assert.equal(result.settings[0]?.label, "Area (m^(2))");
  assert.equal(result.tables[0]?.caption, "Probe at 5 × 10^(14) Hz; coordinate x_(1)");
});

test("keeps radio group context so a description frame is not confused with the moving body", () => {
  const result = prepared(
    '<fieldset><legend>Description frame</legend><label><input type="radio" checked=""/>Magnet at rest</label></fieldset>' +
      '<fieldset><legend>Which body moves</legend><label><input type="radio" checked=""/>Magnet moves</label></fieldset>' +
      readouts,
  );
  assert.deepEqual(result.settings, [
    { label: "Description frame: Magnet at rest", value: "Selected" },
    { label: "Which body moves: Magnet moves", value: "Selected" },
  ]);
});

test("requires a real accepted identity and refuses a pending or placeholder-only surface", () => {
  for (const html of [
    '<section data-instrument-id="bm-06">' + controls + readouts + "</section>",
    laboratory().replace('data-pending="false"', 'data-pending="true"'),
    laboratory(
      controls + "<p data-static-worked-case>The static worked case stays in the page.</p>",
    ),
  ])
    assert.equal(readInstrumentWorkedCase(html, metadata).kind, "unavailable");
});

test("a default case cannot stand in for an addressed mode", () => {
  const modeMetadata = { ...metadata, instrumentId: "sr-02", mode: "apparatus" };
  assert.equal(
    readInstrumentWorkedCase(laboratory(undefined, "sr-02"), modeMetadata).kind,
    "unavailable",
  );
  const result = readInstrumentWorkedCase(laboratory(undefined, "sr-02:apparatus"), modeMetadata);
  assert.equal(result.kind, "prepared");
  assert.equal(result.address, "sr-02:apparatus");
});

test("excludes a prediction placeholder, hidden cells and optional data, while keeping accepted response markup", () => {
  const prediction =
    '<section data-predict-placeholder><label for="guess">Guess</label><input id="guess" value="999"/>' +
    readouts.replace("71.94%", "999%") +
    "</section>";
  const body =
    controls +
    prediction +
    '<div hidden="">' +
    readouts +
    "</div><details>" +
    readouts +
    '</details><div data-predict-response="awaiting">' +
    readouts +
    "</div>";
  const result = prepared(body);
  assert.equal(result.tables.length, 1);
  assert.equal(result.settings.length, 1);
  assert.ok(!JSON.stringify(result).includes("999"));
  assert.equal(result.tables[0]?.rows[0]?.[1]?.content[0]?.t, "71.94%");
});

test("a glossary definition list cannot pass as a worked result; a declared derived-output list can", () => {
  const glossary = "<dl><dt>x1</dt><dd>The position of particle 1</dd></dl>";
  assert.equal(
    readInstrumentWorkedCase(laboratory(controls + glossary), metadata).kind,
    "unavailable",
  );
  const values =
    '<dl class="derived-outputs"><dt>Assigned remote time</dt><dd>10 s</dd><dt>One-way speed</dt><dd>Not determined by the round trip.</dd></dl>';
  assert.equal(prepared(controls + values).tables[0]?.rows.length, 2);
  const grouped =
    "<dl data-results><div><dt>Energy change</dt><dd>100 J</dd></div><div><dt>Mass change</dt><dd>1.1 × 10<sup>−15</sup> kg</dd></div></dl>";
  assert.equal(prepared(controls + grouped).tables[0]?.rows.length, 2);
  assert.equal(
    prepared(controls + grouped).tables[0]?.rows[0]?.[0]?.content[0]?.t,
    "Energy change",
  );
});

test("preserves an explicitly typed underdetermined answer even when its wording contains no number or status keyword", () => {
  const explanation =
    "The data constrain a radius–number product, not radius and molecular number separately. Declare an independent radius to condition the estimate.";
  const table =
    '<table><tbody><tr><th>Recovered molecular number</th><td><span data-output="avogadroNumberEstimate" data-result-status="underdetermined">' +
    explanation +
    "</span></td></tr></tbody></table>";
  assert.equal(prepared(controls + table).tables[0]?.rows[0]?.[1]?.content[0]?.t, explanation);
  assert.equal(
    readInstrumentWorkedCase(
      laboratory(controls + table.replace('status="underdetermined"', 'status="unrecognized"')),
      metadata,
    ).kind,
    "unavailable",
  );
});

test("accepts explicitly marked calculation and qualitative statements without turning ordinary teaching prose into results", () => {
  const statement = "The accepted diffusion coefficient is 4.294 × 10<sup>−13</sup> m²/s.";
  assert.equal(
    readInstrumentWorkedCase(laboratory(controls + `<p>${statement}</p>`), metadata).kind,
    "unavailable",
  );
  const result = prepared(controls + `<p data-results="calculation">${statement}</p>`);
  assert.equal(result.tables.length, 0);
  assert.equal(result.statements[0]?.kind, "calculation");
  assert.ok(result.statements[0]?.content.some((run) => run.s === "sup" && run.t === "−13"));
  const qualitative = prepared(
    controls +
      '<p data-results="qualitative">The two descriptions give the same current; this reconstruction computes no field.</p>',
  );
  assert.equal(qualitative.statements[0]?.kind, "qualitative");
  assert.equal(qualitative.tables.length, 0);
  assert.equal(
    readInstrumentWorkedCase(
      laboratory(
        controls +
          `<div data-predict-placeholder><p data-results="calculation">${statement}</p></div>`,
      ),
      metadata,
    ).kind,
    "unavailable",
  );
});

test("keeps semantic synthetic-data notes and escapes private-looking markup into text runs", () => {
  const result = prepared(
    controls +
      '<p data-semantic-kind="synthetic-recovery">Recovery of a synthetic generating parameter.</p>' +
      readouts.replace(
        "71.94%",
        '&lt;img src=x onerror=alert(1)&gt;<span aria-hidden="true">999</span>71.94%',
      ),
  );
  assert.deepEqual(result.notes, ["Recovery of a synthetic generating parameter."]);
  const text = result.tables[0]?.rows[0]?.[1]?.content.map((run) => run.t).join("");
  assert.equal(text, "<img src=x onerror=alert(1)>71.94%");
});

test("bounds long tables and reports omitted rows instead of silently presenting a complete table", () => {
  const rows = Array.from(
    { length: WORKED_CASE_LIMITS.rows + 3 },
    (_, i) => "<tr><th>Event " + i + "</th><td>" + i + " s</td></tr>",
  ).join("");
  const result = prepared(controls + "<table><tbody>" + rows + "</tbody></table>");
  assert.equal(result.tables[0]?.rows.length, WORKED_CASE_LIMITS.rows);
  assert.equal(result.tables[0]?.omittedRows, 3);
});

test("discloses an overwide result table instead of silently losing its results", () => {
  const wide =
    "<table><tbody><tr><th>Result</th>" +
    Array.from({ length: WORKED_CASE_LIMITS.columns }, (_, i) => `<td>${i} s</td>`).join("") +
    "</tr></tbody></table>";
  const result = prepared(controls + wide + readouts);
  assert.equal(result.tables.length, 1);
  assert.equal(result.omittedTables, 1);
  assert.equal(readInstrumentWorkedCase(laboratory(controls + wide), metadata).kind, "unavailable");
});

test("an illustration scale is not a physical worked result", () => {
  const scales =
    '<table class="scale-facts-table"><tbody><tr><th>Spatial magnification</th><td>10 pixels per metre</td></tr></tbody></table>';
  assert.equal(
    readInstrumentWorkedCase(laboratory(controls + scales), metadata).kind,
    "unavailable",
  );
  assert.equal(prepared(controls + scales + readouts).tables.length, 1);
});

test("does not publish unbounded cell data or a case without its model limits and source", () => {
  const huge = readouts.replace("71.94%", "7".repeat(WORKED_CASE_LIMITS.bytes));
  assert.equal(readInstrumentWorkedCase(laboratory(controls + huge), metadata).kind, "unavailable");
  assert.equal(
    readInstrumentWorkedCase(laboratory(), { ...metadata, notModeled: [] }).kind,
    "unavailable",
  );
  assert.equal(
    readInstrumentWorkedCase(laboratory(), { ...metadata, sources: [] }).kind,
    "unavailable",
  );
});

test("a declared model-readout scope excludes neighboring observations and retains calibration notes", () => {
  const measured = readouts
    .replace("One accepted calculation", "Historical observations")
    .replace("71.94%", "999%");
  const result = readInstrumentWorkedCase(
    laboratory(
      controls +
        "<section data-worked-case-results>" +
        readouts +
        "</section>" +
        measured,
    ),
    { ...metadata, notes: ["Illustrative inputs with modern SI calibration."] },
  );
  assert.equal(result.kind, "prepared");
  assert.ok(result.kind === "prepared");
  assert.deepEqual(result.settings, [{ label: "Temperature (K)", value: "293.15" }]);
  assert.deepEqual(result.notes, ["Illustrative inputs with modern SI calibration."]);
  assert.equal(result.tables.length, 1);
  assert.equal(result.tables[0]?.caption, "One accepted calculation");
  assert.equal(result.tables[0]?.rows[0]?.[1]?.content[0]?.t, "71.94%");
  assert.ok(!JSON.stringify(result).includes("999%"));
  assert.equal(
    readInstrumentWorkedCase(
      laboratory(controls + "<section data-worked-case-results></section>" + measured),
      metadata,
    ).kind,
    "unavailable",
  );
});
