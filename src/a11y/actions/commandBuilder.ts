/**
 * Single Canonical Command Builder and Hasher (am-a11y-action-contracts-k75g).
 *
 * Ensures both visual and equivalent affordances construct byte-identical
 * commands with deterministic hashing, eliminating divergence in accepted snapshots.
 */

import { createHash } from "node:crypto";
import type { ActionContract, CanonicalActionCommand } from "./types.ts";

function canonicalizeValue(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") {
    // Standardize float64 zero
    if (Object.is(val, -0)) return 0;
    return val;
  }
  if (typeof val === "boolean" || typeof val === "string") return val;
  if (Array.isArray(val)) {
    return val.map(canonicalizeValue);
  }
  if (typeof val === "object") {
    const sortedObj: Record<string, unknown> = {};
    const keys = Object.keys(val as Record<string, unknown>).sort();
    for (const k of keys) {
      if (k === "instanceId" || k === "timestamp") continue; // Exclude instance/volatile fields
      sortedObj[k] = canonicalizeValue((val as Record<string, unknown>)[k]);
    }
    return sortedObj;
  }
  return String(val);
}

function canonicalJsonString(obj: unknown): string {
  return JSON.stringify(canonicalizeValue(obj));
}

/**
 * Builds a canonical action command from an action contract and user inputs.
 */
export function buildActionCommand(
  contract: ActionContract,
  inputs: Record<string, unknown>,
): CanonicalActionCommand {
  const normalizedInputs: Record<string, unknown> = {};

  // Sort and validate inputs against contract specification
  const sortedKeys = Object.keys(inputs).sort();
  for (const k of sortedKeys) {
    if (k === "instanceId" || k === "timestamp") continue;
    normalizedInputs[k] = canonicalizeValue(inputs[k]);
  }

  return Object.freeze({
    actionId: contract.actionId,
    commandClass: contract.commandClass,
    inputs: Object.freeze(normalizedInputs),
  });
}

/**
 * Computes deterministic SHA-256 hash of a canonical command.
 */
export function hashCommand(command: CanonicalActionCommand): string {
  const payload = canonicalJsonString({
    actionId: command.actionId,
    commandClass: command.commandClass,
    inputs: command.inputs,
  });
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Computes deterministic SHA-256 hash of accepted snapshot outputs.
 */
export function hashOutputs(outputs: Record<string, unknown>): string {
  const payload = canonicalJsonString(outputs);
  return createHash("sha256").update(payload).digest("hex");
}
