import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { strictParse } from "../src/content/schemas/strictParse.ts";
import { experimentSelectionKey } from "../src/discovery/capstone/experimentLaunch.ts";
import { decodeTapePermalink } from "../src/experiments/permalink/codec.ts";
import { CAPSTONE_PAPERS, buildPresetLaunch } from "./generate-capstone-links.ts";
import { QUERY_BINDINGS, settingsForLab } from "./generate-misconception-links.ts";
import { buildResultProbeLinks } from "./generate-result-probe-links.ts";

test("result probes carry every declared preset setting through the real laboratory decoder", () => {
  const built = buildResultProbeLinks();
  assert.deepEqual(built.problems, []);
  let ready = 0;
  let unavailable = 0;
  let probes = 0;
  const selections = new Set<string>();
  // Read the authored records, not the loader's filtered projection. A dropped probe must fail.
  for (const paper of CAPSTONE_PAPERS) {
    const source = strictParse(readFileSync(`content/results/${paper}.yaml`, "utf8"), "yaml") as {
      cards: { probes: { instrument: string; preset?: string }[] }[];
    };
    assert.ok(source.cards.length > 0);
    for (const card of source.cards) {
      for (const probe of card.probes) {
        probes++;
        if (!probe.preset) continue;
        const key = experimentSelectionKey({
          instrumentId: probe.instrument,
          presetId: probe.preset,
        });
        selections.add(key);
        const launch = built.links[key];
        assert.ok(launch, `${paper}: ${probe.preset} must not be silently dropped`);
        assert.equal(launch.instrumentId, probe.instrument);
        if (launch.status === "unavailable") {
          unavailable++;
          assert.ok(launch.reason.length > 0);
          continue;
        }
        ready++;
        const manifest = strictParse(
          readFileSync(`content/experiments/${probe.instrument}.yaml`, "utf8"),
          "yaml",
        ) as { presets: { presetId: string; parameterValues: Record<string, unknown> }[] };
        const expected = manifest.presets.find((preset) => preset.presetId === probe.preset);
        assert.ok(expected);
        assert.ok(Object.keys(expected.parameterValues).length > 0);
        const url = new URL(launch.href, "https://annus-mirabilis.com");
        assert.equal(url.pathname, `/lab/${probe.instrument}/`);
        const query = QUERY_BINDINGS[probe.instrument];
        let parameters: Record<string, unknown>;
        if (query) {
          const decoded = query.decode(url.search);
          assert.ok(
            decoded.kind === "settings" || decoded.kind === "none",
            JSON.stringify(decoded),
          );
          parameters = (
            decoded.kind === "settings" ? decoded.parameters : query.defaults
          ) as Record<string, unknown>;
        } else {
          const decoded = decodeTapePermalink(launch.href);
          assert.ok(decoded.kind === "success", JSON.stringify(decoded));
          assert.equal(decoded.tape.experimentId, probe.instrument);
          assert.deepEqual(decoded.tape.events, [], "a preset is an opening setup, not a replay");
          parameters = decoded.tape.initialConditions;
        }
        for (const [name, value] of Object.entries(expected.parameterValues)) {
          const wanted = query
            ? settingsForLab(query.defaults, { [name]: value as number | string | boolean })[name]
            : typeof value === "boolean"
              ? String(value)
              : value;
          assert.deepEqual(parameters[name], wanted, `${probe.preset}.${name}`);
        }
      }
    }
  }
  assert.equal(built.probes, probes);
  assert.deepEqual(new Set(Object.keys(built.links)), selections);
  assert.ok(ready > 0, "real result cards must reach accepted settings");
  console.log(
    `result probes: ${probes} examined; ${ready} ready and ${unavailable} unavailable preset references`,
  );
});

test("Brownian query presets preserve the point limit and refuse unknown or invalid settings", () => {
  const launch = buildPresetLaunch("bm-06", { t: 0, gridEnabled: 0 });
  assert.ok(launch.status === "ready");
  assert.equal(launch.kind, "form");
  const query = QUERY_BINDINGS["bm-06"];
  assert.ok(query);
  const decoded = query.decode(new URL(launch.href, "https://example.org").search);
  assert.equal(decoded.kind, "settings");
  const parameters = decoded.parameters as Record<string, unknown>;
  assert.equal(parameters.t, 0);
  assert.equal(parameters.gridEnabled, false);
  for (const settings of [{ missingControl: 2 }, { t: -1 }, { gridEnabled: 2 }, {}]) {
    assert.equal(buildPresetLaunch("bm-06", settings).status, "unavailable");
  }
});
