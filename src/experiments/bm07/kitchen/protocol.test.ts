import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { createKitchenHost } from "./host.ts";
import {
  decodeKitchenRequest,
  decodeKitchenResponse,
  KITCHEN_PROTOCOL,
  type KitchenRequest,
  textDigest,
} from "./protocol.ts";

/**
 * Accept/reject pairs for the seven post-decode checks in `decodeKitchenResponse`
 * (am-copy, under the am-muyh ratchets).
 *
 * These seven were arriving as `throw new TypeError("prose")`, which the refusal
 * scanner reads as bare. They are not internal assertions: `decodeKitchenResponse`
 * validates an untrusted worker message, and AGENTS.md requires the decoder to
 * reject wrong lengths, mismatched units and unrecognized provenance. So the throw
 * stays and now carries a code; what was missing was the test that proves each one
 * fires for its own reason.
 *
 * Every case below starts from a REAL accepted response: the practice CSV is parsed
 * and analyzed by the real host, and exactly one field of its output is then
 * perturbed. Nothing here hand-builds a response shape, so a test cannot pass
 * because its fixture drifted away from what the worker actually sends.
 */

const ROOT = join(import.meta.dirname, "../../../..");
const SOURCE_DIGEST = `source:sha256:${"a".repeat(64)}`;

/** The practice CSV declares no input ranges, so its uncertainty state is `unavailable`. */
function practiceCsv(): string {
  return readFileSync(join(ROOT, "public/edition/kitchen/practice.csv"), "utf8");
}

/**
 * The same observations with the physical input ranges filled in, which is what
 * drives the analyzer to `state: "combined"`. The gas-constant range stays blank
 * on purpose: the modern SI constant is exact and a range on it is refused.
 */
function combinedCsv(): string {
  const patch: Record<string, string> = {
    pixels_per_um_x_interval: "[9.9,10.1]",
    viscosity_interval_mpa_s: "[0.98,1.02]",
    radius_scale_axis: "x",
    physical_input_coverage: "0.99",
    physical_input_provenance: "declared by the practice scenario author",
    radius_um: "0.5",
    radius_provenance: "independent",
    radius_interval_um: "[0.49,0.51]",
    radius_interval_coverage: "0.99",
    temperature_interval_k: "[293.0,293.3]",
  };
  return practiceCsv()
    .split("\n")
    .map((line) => {
      const key = /^# ([a-z_]+)=/.exec(line)?.[1];
      return key && patch[key] !== undefined ? `# ${key}=${patch[key]}` : line;
    })
    .join("\n");
}

type Accepted = { request: KitchenRequest; response: Record<string, unknown> };

async function accepted(csv: string): Promise<Accepted> {
  const token = {
    instanceId: "kitchen-protocol-test",
    experimentId: "bm-07-kitchen",
    runId: "run-1",
    parentRunId: null,
    actionIndex: 1,
    revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
    parameters: {
      sourceId: `sha256:${"b".repeat(64)}`,
      documentDigest: await textDigest(csv),
      track: "",
      axis: "x",
      coverage: 0.95,
      constantSet: "modern-si-2019",
    },
  };
  const input = { version: KITCHEN_PROTOCOL, sourceDigest: SOURCE_DIGEST, token, csv };
  const request = await decodeKitchenRequest(input, SOURCE_DIGEST);
  let captured: unknown = null;
  await createKitchenHost((m) => {
    captured = m;
  }, SOURCE_DIGEST).receive(input);
  const response = captured as Record<string, unknown>;
  const result = response.result as { kind: string; message?: string };
  assert.equal(result.kind, "accepted", `host refused the fixture: ${result.message ?? ""}`);
  return { request, response };
}

/** The outputs array of a cloned response, for perturbation in place. */
function outputsOf(response: Record<string, unknown>): Record<string, unknown>[] {
  const result = response.result as { analysis: { outputs: Record<string, unknown>[] } };
  return result.analysis.outputs;
}

function find(response: Record<string, unknown>, quantityId: string): Record<string, unknown> {
  const output = outputsOf(response).find((o) => o.quantityId === quantityId);
  assert.ok(output, `fixture has no ${quantityId} output`);
  return output;
}

/** Asserts the decoder refuses the perturbed response with exactly this code. */
function refusedWith(
  { request, response }: Accepted,
  perturb: (clone: Record<string, unknown>) => void,
  code: string,
): void {
  const clone = structuredClone(response);
  perturb(clone);
  assert.throws(
    () => decodeKitchenResponse(clone, request),
    (error: unknown) => {
      assert.ok(error instanceof TypeError, `expected a TypeError, got ${String(error)}`);
      const cause = (error as { cause?: { code?: string } }).cause;
      assert.equal(
        cause?.code,
        code,
        `wrong refusal: ${error.message} (code ${String(cause?.code)})`,
      );
      return true;
    },
  );
}

describe("kitchen response decoder refusals (am-copy)", () => {
  test("a real accepted response from the real host decodes", async () => {
    const fixture = await accepted(practiceCsv());
    const { message, document } = decodeKitchenResponse(fixture.response, fixture.request);
    assert.equal((message.result as { kind: string }).kind, "accepted");
    assert.ok(document, "an accepted response carries its parsed document");
    assert.ok(document.points.length > 0, "the practice document has observations");
  });

  test("mismatched-observation-quantity: an output whose unit is not the registered one", async () => {
    const fixture = await accepted(practiceCsv());
    refusedWith(
      fixture,
      (clone) => {
        find(clone, "naiveD").unit = "m^2/s";
      },
      "mismatched-observation-quantity",
    );
  });

  test("malformed-observation-buffer: a buffer-valued output sent as a number", async () => {
    const fixture = await accepted(practiceCsv());
    refusedWith(
      fixture,
      (clone) => {
        find(clone, "pairs").value = 1;
      },
      "malformed-observation-buffer",
    );
  });

  test("wrong-pair-degrees-of-freedom: a pair count that disagrees with the retained pairs", async () => {
    const fixture = await accepted(practiceCsv());
    refusedWith(
      fixture,
      (clone) => {
        const count = find(clone, "pairCount");
        count.value = (count.value as number) + 1;
      },
      "wrong-pair-degrees-of-freedom",
    );
  });

  test("inadmissible-confidence-set: an interval whose lower bound exceeds its upper", async () => {
    const fixture = await accepted(practiceCsv());
    refusedWith(
      fixture,
      (clone) => {
        find(clone, "diffusionInterval").value = Float64Array.of(5, 1);
      },
      "inadmissible-confidence-set",
    );
  });

  test("circular-or-undeclared-radius: a molecular number reported without an independent radius", async () => {
    const fixture = await accepted(practiceCsv());
    const document = decodeKitchenResponse(fixture.response, fixture.request).document;
    assert.notEqual(
      document?.metadata.radius_provenance,
      "independent",
      "this case needs a fixture whose radius is NOT independently calibrated",
    );
    refusedWith(
      fixture,
      (clone) => {
        // An underdetermined output carries `compatibleFamily`/`neededInformation`
        // instead of `value`; the decoder rejects an unknown field before it reaches
        // the radius check, so the status change has to swap the fields too.
        const n = find(clone, "molecularNumber");
        delete n.compatibleFamily;
        delete n.neededInformation;
        n.status = "value";
        n.value = 6.02e23;
      },
      "circular-or-undeclared-radius",
    );
  });

  test("zero-containing-diffusion-set: a combined camera interval whose lower bound is zero", async () => {
    const fixture = await accepted(combinedCsv());
    const analysis = (fixture.response.result as { analysis: { uncertainty: { state: string } } })
      .analysis;
    assert.equal(analysis.uncertainty.state, "combined", "this case needs the combined state");
    refusedWith(
      fixture,
      (clone) => {
        find(clone, "combinedSamplingInterval").value = Float64Array.of(0, 2);
      },
      "zero-containing-diffusion-set",
    );
  });

  test("uncertainty-coverage-disagreement: a combined state with no combined interval", async () => {
    const fixture = await accepted(combinedCsv());
    refusedWith(
      fixture,
      (clone) => {
        // Likewise in reverse: a not-applicable output carries `reason`, not `value`.
        const interval = find(clone, "combinedMolecularInterval");
        delete interval.value;
        interval.status = "not-applicable";
        interval.reason = "withheld by this test to contradict the combined state";
      },
      "uncertainty-coverage-disagreement",
    );
  });
});
