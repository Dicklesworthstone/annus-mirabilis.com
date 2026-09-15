#!/usr/bin/env node
/**
 * Fixed CPU-bound calibration benchmark for am-gov-decision-device-profiles-1zm.
 *
 * Run the same file on the measurement host and on the reference low-cost
 * Android phone. Choose Chromium Emulation.setCPUThrottlingRate so the
 * throttled host elapsedMs is within 10 percent of the phone elapsedMs.
 *
 * This script never writes perf/profiles.json. Until a phone measurement is
 * recorded, profiles.json keeps calibration as the literal string
 * "provisional" and leaves testerId and date empty.
 *
 * Usage: node perf/benchmark/cpu-calibration.mjs
 *        bun perf/benchmark/cpu-calibration.mjs
 */
import os from "node:os";

const BENCHMARK_ID = "am-cpu-calibration-v1";
const ITERATIONS = 8_000_000;

function work(iterations) {
  // Numerical LCG plus xorshift. The accumulator is read after the loop so
  // engines cannot delete the body. No Math.random, no I/O, no time source
  // inside the loop.
  let acc = 1;
  for (let i = 0; i < iterations; i++) {
    acc = Math.imul(acc, 1664525) + 1013904223;
    acc ^= acc >>> 13;
    acc = Math.imul(acc, 1274126177);
    acc ^= acc >>> 16;
  }
  return acc;
}

const started = process.hrtime.bigint();
const digest = work(ITERATIONS);
const elapsedNs = process.hrtime.bigint() - started;
const elapsedMs = Number(elapsedNs) / 1e6;

const cpus = os.cpus();
const record = {
  benchmarkId: BENCHMARK_ID,
  iterations: ITERATIONS,
  digest,
  elapsedMs,
  nodeVersion: process.version,
  bunVersion: typeof Bun === "undefined" ? null : Bun.version,
  platform: process.platform,
  arch: process.arch,
  cpuModel: cpus[0] ? cpus[0].model : "",
  cpuCount: cpus.length,
  timestamp: new Date().toISOString(),
  calibration: "provisional",
  testerId: "",
  date: "",
  note: "Host smoke output only. Do not copy elapsedMs into perf/profiles.json until a matching phone run is recorded with a tester id and date.",
};

process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
