import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  INCOMPLETE_20260915_SIBLINGS,
  REQUIRED_SIBLINGS,
  WITHDRAWN_EXCLUSIONS,
  checkProbeCopy,
  classifyProbeFailure,
  discoverPathDeps,
  documentedExclusion,
  parsePathEntries,
  requiredSiblingNames,
  siblingFromResolved,
  siblingNeeds,
} from "./probeCopy.ts";

const FSQLITE_TRANSCRIPT = `error: failed to load manifest for workspace member
  .../frankensim/crates/fs-flywheel-e2e
Caused by: failed to load manifest for dependency \`fs-ledger\`
Caused by: failed to load manifest for dependency \`fsqlite\`
Caused by: failed to read
  .../frankensqlite/crates/fsqlite/Cargo.toml
Caused by:
  No such file or directory (os error 2)
`;

const FNX_TRANSCRIPT = `error: failed to get \`fnx-classes\` as a dependency of package \`fs-truss v0.0.1\`
Caused by:
  failed to load source for dependency \`fnx-classes\`
Caused by:
  unable to update .../franken_networkx/crates/fnx-classes
Caused by:
  failed to read \`.../franken_networkx/crates/fnx-classes/Cargo.toml\`
Caused by:
  No such file or directory (os error 2)
`;

const ASUPERSYNC_TRANSCRIPT = `error: feature \`native-runtime\` is forbidden on wasm32 browser builds.
   --> .../asupersync/src/lib.rs:129:1
`;

const LLD_TRANSCRIPT = `error: linking with \`rust-lld\` failed: signal: 6 (SIGABRT)
    = note: "rust-lld" "-flavor" "wasm" "--export" "__wbindgen_describe_probe_touch"
dyld: Library not loaded: @rpath/libLLVM.dylib
`;

function fixtureTree() {
  const root = mkdtempSync(join(tmpdir(), "am-probe-copy-"));
  const frankensim = join(root, "frankensim");
  mkdirSync(join(frankensim, "crates/fs-ledger"), { recursive: true });
  mkdirSync(join(frankensim, "crates/fs-truss"), { recursive: true });
  mkdirSync(join(frankensim, "crates/fs-sparse"), { recursive: true });
  mkdirSync(join(frankensim, "crates/fs-ad"), { recursive: true });
  mkdirSync(join(frankensim, "crates/fs-fft"), { recursive: true });
  writeFileSync(join(frankensim, "Cargo.toml"), `[workspace]\nmembers = ["crates/*"]\n`);
  writeFileSync(
    join(frankensim, "crates/fs-ledger/Cargo.toml"),
    `[package]\nname = "fs-ledger"\n[dependencies]\nfsqlite = { path = "../../../frankensqlite/crates/fsqlite", features = ["async-api"] }\n`,
  );
  writeFileSync(
    join(frankensim, "crates/fs-truss/Cargo.toml"),
    `[package]\nname = "fs-truss"\n[dependencies]\nfnx-classes = { path = "../../../franken_networkx/crates/fnx-classes" }\n`,
  );
  writeFileSync(
    join(frankensim, "crates/fs-sparse/Cargo.toml"),
    `[package]\nname = "fs-sparse"\n[dependencies]\nfnx-classes = { path = "../../../franken_networkx/crates/fnx-classes", optional = true }\nfnp-ufunc = { path = "../../../franken_numpy/crates/fnp-ufunc", optional = true }\n[dev-dependencies]\nfsci-sparse = { path = "../../../frankenscipy/crates/fsci-sparse", version = "=0.1.0" }\n`,
  );
  writeFileSync(
    join(frankensim, "crates/fs-ad/Cargo.toml"),
    `[package]\nname = "fs-ad"\n[dependencies]\nft-autograd = { path = "../../../frankentorch/crates/ft-autograd", optional = true }\n`,
  );
  writeFileSync(
    join(frankensim, "crates/fs-fft/Cargo.toml"),
    `[package]\nname = "fs-fft"\n[dependencies]\nasupersync = { path = "../../../asupersync" }\n`,
  );
  return { root, frankensim };
}

function plantSibling(root, name, crateRel) {
  const cargo = join(root, name, crateRel, "Cargo.toml");
  mkdirSync(join(root, name, crateRel), { recursive: true });
  writeFileSync(cargo, `[package]\nname = "${name}-crate"\n`);
}

test("REQUIRED_SIBLINGS includes frankensqlite and frankentorch; the 2026-09-15 list includes neither", () => {
  assert.ok(REQUIRED_SIBLINGS.includes("frankensqlite"));
  assert.ok(REQUIRED_SIBLINGS.includes("frankentorch"));
  assert.equal(INCOMPLETE_20260915_SIBLINGS.includes("frankensqlite"), false);
  assert.equal(INCOMPLETE_20260915_SIBLINGS.includes("frankentorch"), false);
  assert.equal(documentedExclusion("frankentorch"), undefined);
  assert.equal(WITHDRAWN_EXCLUSIONS[0].sibling, "frankentorch");
  assert.match(WITHDRAWN_EXCLUSIONS[0].reason, /RCH-E415/);
  assert.deepEqual([...INCOMPLETE_20260915_SIBLINGS].sort(), ["asupersync", "franken_networkx", "franken_numpy", "frankenscipy"]);
});

test("parsePathEntries records optional = true on the same table and not on a required neighbour", () => {
  const entries = parsePathEntries(`
fnx-classes = { path = "../../../franken_networkx/crates/fnx-classes", optional = true }
fnx-required = { path = "../../../franken_networkx/crates/fnx-runtime" }
fsqlite = { path = "../../../frankensqlite/crates/fsqlite", features = ["async-api"] }
`);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].optional, true);
  assert.equal(entries[1].optional, false);
  assert.equal(entries[2].optional, false);
  assert.equal(entries[2].pathSpec, "../../../frankensqlite/crates/fsqlite");
});

test("siblingFromResolved walks out of frankensim into the archive sibling, never an internal crate", () => {
  const frankensim = "/tmp/probe/frankensim";
  assert.equal(siblingFromResolved(frankensim, "/tmp/probe/frankensqlite/crates/fsqlite"), "frankensqlite");
  assert.equal(siblingFromResolved(frankensim, "/tmp/probe/frankensim/crates/fs-rand"), null);
  assert.equal(siblingFromResolved(frankensim, "/tmp/probe/asupersync"), "asupersync");
});

test("discoverPathDeps classifies frankensqlite as required; frankentorch is optional-only in cargo but still required for the copy", () => {
  const { root, frankensim } = fixtureTree();
  try {
    const deps = discoverPathDeps(frankensim);
    const names = new Set(deps.map((d) => d.sibling));
    assert.ok(names.has("frankensqlite"));
    assert.ok(names.has("franken_networkx"));
    assert.ok(names.has("asupersync"));
    assert.ok(names.has("frankentorch"));
    const needs = Object.fromEntries(siblingNeeds(deps).map((n) => [n.name, n]));
    assert.equal(needs.frankensqlite.required, true);
    assert.equal(needs.frankensqlite.optionalOnly, false);
    assert.equal(needs.frankentorch.optionalOnly, true);
    assert.equal(needs.frankentorch.required, true);
    assert.ok(requiredSiblingNames(deps).includes("frankensqlite"));
    assert.ok(requiredSiblingNames(deps).includes("frankentorch"));
    assert.equal(documentedExclusion("frankentorch"), undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a copy that matches the 2026-09-15 sibling set fails because frankensqlite is absent", () => {
  const { root, frankensim } = fixtureTree();
  try {
    plantSibling(root, "asupersync", ".");
    plantSibling(root, "franken_networkx", "crates/fnx-classes");
    plantSibling(root, "franken_numpy", "crates/fnp-ufunc");
    plantSibling(root, "frankenscipy", "crates/fsci-sparse");
    const deps = discoverPathDeps(frankensim);
    const check = checkProbeCopy(root, deps);
    assert.equal(check.ok, false);
    assert.ok(check.missingRequired.includes("frankensqlite"));
    assert.ok(check.missingRequired.includes("frankentorch"));
    assert.ok(check.missingManifests.some((row) => row.includes("frankensqlite")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a complete copy including frankensqlite passes, and a dummy frankensqlite directory is not enough", () => {
  const { root, frankensim } = fixtureTree();
  try {
    plantSibling(root, "asupersync", ".");
    plantSibling(root, "franken_networkx", "crates/fnx-classes");
    plantSibling(root, "franken_numpy", "crates/fnp-ufunc");
    plantSibling(root, "frankenscipy", "crates/fsci-sparse");
    mkdirSync(join(root, "frankensqlite"), { recursive: true });
    const deps = discoverPathDeps(frankensim);
    const hollow = checkProbeCopy(root, deps);
    assert.equal(hollow.ok, false);
    assert.ok(hollow.missingManifests.some((row) => row.includes("frankensqlite")));
    plantSibling(root, "frankensqlite", "crates/fsqlite");
    const stillMissingTorch = checkProbeCopy(root, deps);
    assert.equal(stillMissingTorch.ok, false);
    assert.ok(stillMissingTorch.missingRequired.includes("frankentorch"));
    plantSibling(root, "frankentorch", "crates/ft-autograd");
    plantSibling(root, "frankentorch", "crates/ft-core");
    const complete = checkProbeCopy(root, deps);
    assert.equal(complete.ok, true);
    assert.deepEqual(complete.missingRequired, []);
    assert.ok(complete.present.includes("frankensqlite"));
    assert.ok(complete.present.includes("frankentorch"));
    assert.deepEqual(complete.missingOptionalDocumented, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("retained fsqlite and fnx-classes transcripts are absent-sibling; asupersync is other; rust-lld is toolchain-lld", () => {
  assert.equal(classifyProbeFailure(FSQLITE_TRANSCRIPT), "absent-sibling");
  assert.equal(classifyProbeFailure(FNX_TRANSCRIPT), "absent-sibling");
  assert.equal(classifyProbeFailure(ASUPERSYNC_TRANSCRIPT), "other");
  assert.equal(classifyProbeFailure(LLD_TRANSCRIPT), "toolchain-lld");
  assert.equal(classifyProbeFailure("error: cannot update the lock file because --locked was passed"), "other");
});

test("a naive implementation that treats every cargo 101 as a missing sibling is rejected", () => {
  const nativeRuntime = classifyProbeFailure(ASUPERSYNC_TRANSCRIPT);
  const lockDrift = classifyProbeFailure("error: cannot update the lock file ... --locked was passed");
  assert.notEqual(nativeRuntime, "absent-sibling");
  assert.notEqual(lockDrift, "absent-sibling");
});

test("RCH-E415 naming frankentorch is an absent-sibling failure, not a compile error", () => {
  const transcript = `RCH-E415 missing-path-dependency: materialization dependency path does not exist: .../frankentorch/crates/ft-autograd`;
  assert.equal(classifyProbeFailure(transcript), "absent-sibling");
});

test("a missing constellation.lock is not an absent sibling even if asupersync compiled", () => {
  const transcript = `   Compiling asupersync v0.5.0 (.../asupersync)
cannot read required GEMM build-identity input .../frankensim/crates/fs-la/../../constellation.lock: No such file or directory (os error 2)
`;
  assert.equal(classifyProbeFailure(transcript), "other");
});
