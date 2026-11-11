import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { evaluatorSources } from "../../../scripts/generate-sr12.mjs";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { BM02_DRAFT_TAPE } from "../bm02/draftTape.ts";
import { SR12_TAPE } from "../sr12/tape.ts";
import { validateControlTape } from "../tapes/schema.ts";
import { checkTapeCompatibility } from "./compatibility.ts";
import { type DraftTapeBinding, draftTapeForSettings, loadDraftTape } from "./draftTape.ts";
import {
  createSessionReplayRunner,
  digestFormOf,
  type LabTapeBinding,
  replayTapeOnSession,
  tapeForSettings,
} from "./sessionTape.ts";
import type { TapeV2 } from "./types.ts";

const experiments = fileURLToPath(new URL("../", import.meta.url));
const bindings: (LabTapeBinding | DraftTapeBinding)[] = [];
for (const entry of readdirSync(experiments, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  for (const file of ["tape.ts", "draftTape.ts"]) {
    const path = resolve(experiments, entry.name, file);
    if (!existsSync(path)) continue;
    const module = await import(pathToFileURL(path).href);
    for (const [name, value] of Object.entries(module)) {
      if (
        name.endsWith("_TAPE") &&
        value !== null &&
        typeof value === "object" &&
        "environment" in value &&
        "defaults" in value &&
        "validate" in value
      )
        bindings.push(value as LabTapeBinding | DraftTapeBinding);
    }
  }
}

describe("laboratory replay source identity", () => {
  test("every concrete shared-link binding records a real source digest", () => {
    expect(bindings.length).toBeGreaterThan(0);
    const laboratories = new Set<string>();
    for (const binding of bindings) {
      laboratories.add(binding.environment.experimentId);
      expect(binding.environment.artifactDigest).toMatch(/^host:sha256:[a-f0-9]{64}$/);
      const tape =
        "createSession" in binding
          ? tapeForSettings(binding, binding.defaults)
          : draftTapeForSettings(binding, binding.defaults);
      expect(tape).not.toBeNull();
      expect(tape?.modelIdentity.artifactDigest).toBe(binding.environment.artifactDigest);
    }
    console.log(
      `[tape source identities] ${bindings.length} bindings / ${laboratories.size} laboratories`,
    );
  });

  test("published host recordings pin the evaluator that reproduces their unchanged checkpoints", () => {
    const directory = fileURLToPath(
      new URL("../../../content/experiments/tapes/", import.meta.url),
    );
    let records = 0;
    let checkpoints = 0;
    for (const file of readdirSync(directory).filter((file) => file.endsWith(".yaml"))) {
      const record = validateControlTape(parseYaml(readFileSync(resolve(directory, file), "utf8")));
      const binding = bindings.find(
        (candidate): candidate is LabTapeBinding =>
          "createSession" in candidate &&
          candidate.environment.experimentId === record.experimentId,
      );
      if (!binding) continue;
      records++;
      expect(record.modelIdentity.artifactDigest).toBe(binding.environment.artifactDigest);
      for (const checkpoint of record.checkpoints) {
        const runner = createSessionReplayRunner(
          binding,
          binding.createSession(`${record.tapeId}-source-verification`),
          digestFormOf(checkpoint.digest),
        );
        runner.applyInitialConditions(record.initialConditions);
        for (const event of record.events) {
          if (event.kind !== "control" || event.actionIndex > checkpoint.actionIndex) continue;
          runner.applyEvent({
            actionIndex: event.actionIndex,
            commandClass: event.commandClass,
            paramId: event.parameterId,
            value: event.value,
          });
        }
        expect(runner.getAcceptedCheckpoint().digest).toBe(checkpoint.digest);
        checkpoints++;
      }
    }
    expect(records).toBeGreaterThan(0);
    expect(checkpoints).toBeGreaterThan(0);
    console.log(
      `[tape source verification] ${checkpoints} recorded checkpoints / ${records} host tapes`,
    );
  });

  test("a recorded identity hashes the actual evaluator and its import closure", async () => {
    const sources = await evaluatorSources();
    expect(
      sources.some(([path]: readonly string[]) => path === "src/physics/reference/fields.ts"),
    ).toBe(true);
    const digest = (changed = false) => {
      const hash = createHash("sha256");
      for (const [path, original] of sources) {
        const text =
          changed && path === "src/physics/reference/fields.ts"
            ? `${original}\n// changed evaluator\n`
            : original;
        hash.update(`${path}\0${Buffer.byteLength(text)}\0`).update(text);
      }
      return `host:sha256:${hash.digest("hex")}`;
    };
    expect(SR12_TAPE.environment.artifactDigest).toBe(digest());
    expect(SR12_TAPE.environment.artifactDigest).not.toBe(digest(true));
  });

  test("missing or different source identity cannot alter the reader's accepted run", () => {
    const current = tapeForSettings(SR12_TAPE, SR12_TAPE.defaults);
    expect(current).not.toBeNull();
    if (!current) return;
    const owner = SR12_TAPE.createSession("source-identity-preserves-accepted-run");
    const before = owner.getSnapshot();
    for (const artifactDigest of [undefined, `host:sha256:${"0".repeat(64)}`]) {
      const tape: TapeV2 = {
        ...current,
        modelIdentity: { ...current.modelIdentity, artifactDigest },
      };
      const result = replayTapeOnSession(SR12_TAPE, owner, tape);
      expect(result).toMatchObject({
        kind: "refusal",
        refusalCode: "tape-artifact-mismatch",
        offerNewRun: true,
      });
      expect(owner.getSnapshot()).toBe(before);
    }
    expect(replayTapeOnSession(SR12_TAPE, owner, current).kind).toBe("success");
  });

  test("a legacy record can be calculated only as an explicitly new run", () => {
    const current = tapeForSettings(SR12_TAPE, SR12_TAPE.defaults);
    expect(current).not.toBeNull();
    if (!current) return;
    const owner = SR12_TAPE.createSession("legacy-source-new-run");
    const before = owner.getSnapshot().accepted?.runId;
    const legacy: TapeV2 = {
      ...current,
      modelIdentity: { modelId: current.modelIdentity.modelId, modelVersion: 1 },
    };
    const result = replayTapeOnSession(SR12_TAPE, owner, legacy, { forceNewRun: true });
    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;
    expect(result.isNewRun).toBe(true);
    expect(result.runId).toBe(owner.getSnapshot().accepted?.runId);
    expect(result.runId).not.toBe(before);
    expect(legacy.modelIdentity.artifactDigest).toBeUndefined();
  });

  test("source-only recordings survive both writers and reject missing source evidence", () => {
    const evaluatorSourceHash = `source:sha256:${"a".repeat(64)}`;
    const live = {
      ...SR12_TAPE,
      environment: { ...SR12_TAPE.environment, artifactDigest: undefined, evaluatorSourceHash },
    };
    const draft = {
      ...BM02_DRAFT_TAPE,
      environment: {
        ...BM02_DRAFT_TAPE.environment,
        artifactDigest: undefined,
        evaluatorSourceHash,
      },
    };
    for (const tape of [
      tapeForSettings(live, live.defaults),
      draftTapeForSettings(draft, draft.defaults),
    ]) {
      expect(tape?.modelIdentity.evaluatorSourceHash).toBe(evaluatorSourceHash);
      if (!tape) continue;
      const environment =
        tape.experimentId === live.environment.experimentId ? live.environment : draft.environment;
      expect(checkTapeCompatibility(tape, environment).compatible).toBe(true);
      for (const hash of [undefined, `source:sha256:${"b".repeat(64)}`]) {
        const result = checkTapeCompatibility(tape, { ...environment, evaluatorSourceHash: hash });
        expect(result).toMatchObject({ compatible: false, refusalCode: "tape-artifact-mismatch" });
      }
    }
  });

  test("settings-only links preserve identity without calculating a replacement", () => {
    const current = draftTapeForSettings(BM02_DRAFT_TAPE, BM02_DRAFT_TAPE.defaults);
    expect(current).not.toBeNull();
    if (!current) return;
    expect(loadDraftTape(BM02_DRAFT_TAPE, current).kind).toBe("loaded");
    const legacy = {
      ...current,
      modelIdentity: { modelId: current.modelIdentity.modelId, modelVersion: 1 },
    };
    expect(loadDraftTape(BM02_DRAFT_TAPE, legacy).kind).toBe("not-restored");
    expect(
      checkTapeCompatibility(current, {
        ...BM02_DRAFT_TAPE.environment,
        artifactDigest: undefined,
      }),
    ).toMatchObject({ compatible: false, refusalCode: "tape-artifact-mismatch" });
  });
});
