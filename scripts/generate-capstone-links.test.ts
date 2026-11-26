import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { strictParse } from "../src/content/schemas/strictParse.ts";
import { loadTeachingTapes } from "../src/content/teachingTapes.ts";
import {
  experimentSelectionKey,
  selectedExperimentLaunch,
} from "../src/discovery/capstone/experimentLaunch.ts";
import { loadCapstone } from "../src/discovery/capstone/loadCapstone.ts";
import { withCapstoneReturn } from "../src/discovery/capstone/returnRoute.ts";
import { createMe03Session } from "../src/experiments/me03/session.ts";
import { ME03_TAPE } from "../src/experiments/me03/tape.ts";
import {
  decodeTapePermalink,
  MAX_PERMALINK_URL_LENGTH,
} from "../src/experiments/permalink/codec.ts";
import { restoreTape } from "../src/experiments/permalink/sessionTape.ts";
import { SR01_DEFAULTS } from "../src/experiments/sr01/definition.ts";
import { decodeSr01Settings } from "../src/experiments/sr01/permalink.ts";
import {
  buildCapstoneLinks,
  buildMarginComparisonLinks,
  buildPresetLaunch,
  CAPSTONE_PAPERS,
  declaredPreset,
} from "./generate-capstone-links.ts";

test("every real capstone launches its declared settings, not a substituted default", () => {
  const links = buildCapstoneLinks();
  const tapes = loadTeachingTapes().tapes;
  let examined = 0;
  for (const paper of CAPSTONE_PAPERS) {
    const selections = loadCapstone(paper).capstone.presets;
    assert.ok(selections.length > 0, `${paper} must exercise its laboratory selections`);
    for (const selection of selections) {
      examined++;
      const link = links[experimentSelectionKey(selection)];
      assert.ok(
        link?.status === "ready",
        `${paper}: ${JSON.stringify(selection)}: ${JSON.stringify(link)}`,
      );
      assert.equal(selectedExperimentLaunch(selection, links).ready, true);
      const href = withCapstoneReturn(link.href, paper);
      assert.ok(
        href.length <= MAX_PERMALINK_URL_LENGTH,
        "navigation context must not break the codec's URL bound",
      );
      const url = new URL(href, "https://annus-mirabilis.com");
      let expected: Readonly<Record<string, unknown>>;
      if (selection.tapeId) {
        const tape = tapes.find((item) => item.tapeId === selection.tapeId);
        assert.ok(tape, selection.tapeId);
        assert.equal(tape.experimentId, selection.instrumentId);
        expected = tape.initialConditions;
      } else {
        const manifest = strictParse(
          readFileSync(`content/experiments/${selection.instrumentId}.yaml`, "utf8"),
          "yaml",
        ) as {
          presets: { presetId: string; parameterValues: Record<string, unknown> }[];
        };
        const preset = manifest.presets.find((item) => item.presetId === selection.presetId);
        assert.ok(preset, selection.presetId);
        expected = preset.parameterValues;
      }
      assert.ok(Object.keys(expected).length > 0, "the comparison must examine declared settings");
      if (selection.instrumentId === "sr-01") {
        const decoded = decodeSr01Settings(url.search);
        assert.notEqual(decoded.kind, "invalid");
        const parameters = (decoded.kind === "settings"
          ? decoded.parameters
          : SR01_DEFAULTS) as unknown as Record<string, unknown>;
        for (const [key, value] of Object.entries(expected))
          assert.deepEqual(parameters[key], value, key);
      } else {
        const decoded = decodeTapePermalink(href);
        assert.ok(decoded.kind === "success", JSON.stringify(decoded));
        assert.equal(decoded.tape.experimentId, selection.instrumentId);
        assert.deepEqual(
          decoded.tape.events,
          [],
          "opening settings are not a replayed walkthrough",
        );
        for (const [key, value] of Object.entries(expected)) {
          assert.deepEqual(
            decoded.tape.initialConditions[key],
            typeof value === "boolean" ? String(value) : value,
            `${paper}: ${selection.instrumentId}.${key}`,
          );
        }
      }
    }
  }
  assert.ok(examined > 0);
  console.log(
    `capstone launches: ${examined} authored selections examined across ${CAPSTONE_PAPERS.length} papers`,
  );
});

test("presets cannot silently add unknown parameters or step outside their owner's domain", () => {
  for (const settings of [{ unrecognizedControl: 2 }, { stationSeparationLs: -1 }, {}]) {
    assert.equal(buildPresetLaunch("sr-01", settings).status, "unavailable");
  }
  assert.equal(buildPresetLaunch("unknown-lab", { value: 2 }).status, "unavailable");
});

test("the margin comparison's two authored presets restore distinct accepted ME-03 modes", () => {
  const links = buildMarginComparisonLinks();
  const generated = JSON.parse(readFileSync("src/generated/margin-comparison-links.json", "utf8"));
  assert.deepEqual(generated, links);
  assert.equal(Object.keys(links).length, 2);
  for (const [presetId, mode, quantity] of [
    ["me-03-box-1906", "box-1906", "centerOfMassShift"],
    ["me-03-four-momentum-opposite-pulses", "four-momentum", "invariantMass"],
  ]) {
    assert.ok(presetId && mode && quantity);
    const selection = { instrumentId: "me-03", presetId };
    const link = links[experimentSelectionKey(selection)];
    assert.ok(link?.status === "ready", JSON.stringify(link));
    assert.equal(link.kind, "session");
    const decoded = decodeTapePermalink(link.href);
    assert.ok(decoded.kind === "success", JSON.stringify(decoded));
    const session = createMe03Session("margin-comparison-" + mode);
    assert.equal(session.acceptedParameters().mode, "1905");
    assert.deepEqual(restoreTape(ME03_TAPE, session, decoded.tape), { kind: "restored" });
    assert.equal(session.acceptedParameters().mode, mode);
    const output = session
      .getSnapshot()
      .accepted?.outputs.find((item) => item.quantityId === quantity);
    assert.ok(output?.status === "value" && typeof output.value === "number");
    if (mode === "box-1906") assert.equal(output.value, 0);
    else assert.ok(output.value > 0, "Two opposite pulses must have nonzero system mass.");
  }
});

test("a comparison cannot advertise a missing preset as a working launch", () => {
  const selection = { instrumentId: "me-03", presetId: "me-03-missing-comparison" };
  const refused = declaredPreset(selection, process.cwd());
  assert.equal(refused.status, "unavailable");
  const selected = selectedExperimentLaunch(selection, {
    [experimentSelectionKey(selection)]: refused,
  });
  assert.equal(selected.ready, false);
  assert.equal(selected.href, "/lab/me-03/");
  assert.match(selected.notice, /usual settings/);
});
