/**
 * LQ-05 counting-entrance scenario evaluation.
 *
 * Sits behind the experiments seam so the exact-counting entrance receives an evaluated result
 * instead of calling the reference owner itself. AGENTS.md Doctrine 4: kernels own the law, and
 * a reader surface never reaches across the layer that hands it computed state. The reader
 * module src/reader/entrances/lightQuantaExample.ts re-exports this and holds no physics.
 * Spec: am-ymr5.
 */
import {
  enumerateConfigurations,
  independentPointsProbability,
  lockedPositionsProbability,
} from "../../physics/reference/radiation/configurations.ts";
import { LQ05_DEFAULTS } from "./definition.ts";
import { encodeLq05Settings } from "./permalink.ts";

export type TokenSetup = Readonly<{ tokens: number; parts: number; locked: boolean }>;
export type TokenArrangement = Readonly<{ parts: readonly number[]; allLeft: boolean }>;
export type TokenExample = Readonly<{
  setup: TokenSetup;
  arrangements: readonly TokenArrangement[];
  total: number;
  favorable: number;
  probability: number;
  labHref: string;
}>;
export type TokenExampleResult =
  | Readonly<{ kind: "ready"; example: TokenExample }>
  | Readonly<{ kind: "refused"; message: string }>;

/** A bounded teaching projection of the existing exact-count owner, not another probability model. */
export function tokenExample(input: TokenSetup): TokenExampleResult {
  if (
    !input ||
    typeof input.locked !== "boolean" ||
    !Number.isSafeInteger(input.tokens) ||
    input.tokens < 1 ||
    input.tokens > (input.locked ? 10 : 4) ||
    ![2, 3].includes(input.parts)
  ) {
    return {
      kind: "refused",
      message:
        "Use one to four independent tokens, or up to ten together, in two or three equal parts.",
    };
  }
  const setup = Object.freeze({ ...input });
  // A locked group has one independent position. Labelling its members does not add choices.
  const choices = setup.locked ? 1 : setup.tokens;
  const count = enumerateConfigurations(choices, setup.parts);
  if (count.status !== "value")
    return { kind: "refused", message: "The counting owner could not enumerate this example." };
  const probability = setup.locked
    ? lockedPositionsProbability(setup.tokens, 1 / setup.parts).value
    : independentPointsProbability(setup.tokens, 1 / setup.parts).value;
  const arrangements = Array.from({ length: count.totalConfigurations }, (_, index) => {
    // Decode an enumerated label into cell addresses for display only. Counts and probabilities
    // come from the reference owner above; the table is checked against that owner in tests.
    let address = index;
    const positions = Array.from({ length: setup.tokens }, () => {
      if (setup.locked) return index;
      const part = address % setup.parts;
      address = Math.floor(address / setup.parts);
      return part;
    });
    return Object.freeze({
      parts: Object.freeze(positions),
      allLeft: positions.every((part) => part === 0),
    });
  });
  const parameters = {
    ...LQ05_DEFAULTS,
    n: setup.tokens,
    f: 1 / setup.parts,
    locked: setup.locked,
    view: "enumeration" as const,
  };
  return {
    kind: "ready",
    example: Object.freeze({
      setup,
      arrangements: Object.freeze(arrangements),
      total: count.totalConfigurations,
      favorable: count.favorableConfigurations,
      probability,
      labHref: `/lab/lq-05/?${encodeLq05Settings(parameters)}`,
    }),
  };
}

export function requireTokenExample(setup: TokenSetup): TokenExample {
  const result = tokenExample(setup);
  if (result.kind !== "ready") throw new Error(result.message);
  return result.example;
}

export const TOKEN_WORKED_EXAMPLES = Object.freeze([
  ...[1, 2, 3, 4].map((tokens) => requireTokenExample({ tokens, parts: 2, locked: false })),
  ...[2, 10].map((tokens) => requireTokenExample({ tokens, parts: 2, locked: true })),
  ...[1, 2].map((tokens) => requireTokenExample({ tokens, parts: 3, locked: false })),
]);
export const TOKEN_INITIAL = requireTokenExample({ tokens: 2, parts: 2, locked: false });
export const PART_NAMES = Object.freeze(["left", "middle", "right"]);
export function partName(part: number, parts: number): string {
  return parts === 2 ? (part === 0 ? "left" : "right") : (PART_NAMES[part] ?? "unknown");
}
