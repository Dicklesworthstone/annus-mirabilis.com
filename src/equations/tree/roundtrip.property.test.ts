/**
 * Property-based roundtrip test for semantic expression tree authoring grammar.
 *
 * Requirements from am-eq-expression-tree-8kl:
 * "roundtrip.property.test.ts: property test: 500 seeded random trees generated from
 *  fixed seeds ('1', '9007199254740993', '18446744073709551615') verifying
 *  parse(printAuthoring(tree)) === tree via structuralEqual."
 */

import { describe, expect, test } from "bun:test";
import { parseAuthoring } from "./parse.ts";
import { printAuthoring } from "./printAuthoring.ts";
import type { Expression, SymbolNode } from "./types.ts";
import { structuralEqual } from "./walk.ts";

/**
 * 64-bit deterministic SplitMix PRNG.
 */
class SplitMix64 {
  private state: bigint;

  constructor(seed: string) {
    this.state = BigInt(seed);
  }

  nextU64(): bigint {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    return (z ^ (z >> 31n)) & 0xffffffffffffffffn;
  }

  nextInt(max: number): number {
    if (max <= 0) return 0;
    return Number(this.nextU64() % BigInt(max));
  }
}

const SYMBOLS: Record<string, SymbolNode> = {
  x: { kind: "symbol", termId: "eq-test.t.x", quantityId: "x" },
  y: { kind: "symbol", termId: "eq-test.t.y", quantityId: "y" },
  z: { kind: "symbol", termId: "eq-test.t.z", quantityId: "z" },
  t: { kind: "symbol", termId: "eq-test.t.t", quantityId: "t" },
  v: { kind: "symbol", termId: "eq-test.t.v", quantityId: "v" },
};

const SYMBOL_KEYS = Object.keys(SYMBOLS);

function generateRandomTree(rng: SplitMix64, depth = 0, maxDepth = 4): Expression {
  if (depth >= maxDepth) {
    // Generate terminal
    const termKind = rng.nextInt(3);
    if (termKind === 0) {
      const symKey = SYMBOL_KEYS[rng.nextInt(SYMBOL_KEYS.length)]!;
      return SYMBOLS[symKey]!;
    }
    if (termKind === 1) {
      return { kind: "constant", name: "pi" };
    }
    const num = rng.nextInt(50) + 1;
    return { kind: "number", value: String(num) };
  }

  // Non-terminal options
  const choice = rng.nextInt(15);
  switch (choice) {
    case 0:
    case 1: {
      // Fraction (quotient)
      return {
        kind: "quotient",
        style: "fraction",
        numerator: generateRandomTree(rng, depth + 1, maxDepth),
        denominator: generateRandomTree(rng, depth + 1, maxDepth),
      };
    }
    case 2: {
      // Sqrt
      return {
        kind: "root",
        degree: 2,
        radicand: generateRandomTree(rng, depth + 1, maxDepth),
      };
    }
    case 3: {
      // Cube root
      return {
        kind: "root",
        degree: 3,
        radicand: generateRandomTree(rng, depth + 1, maxDepth),
      };
    }
    case 4: {
      // Function
      const fnNames = ["sin", "cos", "exp", "ln"] as const;
      const fn = fnNames[rng.nextInt(fnNames.length)]!;
      return {
        kind: "function",
        name: fn,
        argument: generateRandomTree(rng, depth + 1, maxDepth),
      };
    }
    case 5: {
      // Average
      return {
        kind: "average",
        argument: generateRandomTree(rng, depth + 1, maxDepth),
      };
    }
    case 6: {
      // Norm
      return {
        kind: "norm",
        argument: generateRandomTree(rng, depth + 1, maxDepth),
      };
    }
    case 7: {
      // Group (parenthesized expression, can contain sum)
      const isSum = rng.nextInt(2) === 0;
      if (isSum) {
        return {
          kind: "group",
          argument: {
            kind: "sum",
            args: [
              generateRandomTree(rng, depth + 1, maxDepth),
              generateRandomTree(rng, depth + 1, maxDepth),
            ],
          },
        };
      }
      return {
        kind: "group",
        argument: generateRandomTree(rng, depth + 1, maxDepth),
      };
    }
    case 8: {
      // Derivative (diff)
      const varSym = SYMBOLS[SYMBOL_KEYS[rng.nextInt(SYMBOL_KEYS.length)]!]!;
      return {
        kind: "derivative",
        order: 1,
        partial: false,
        expression: generateRandomTree(rng, depth + 1, maxDepth),
        variable: varSym,
      };
    }
    case 9: {
      // Partial derivative (pdiff)
      const varSym = SYMBOLS[SYMBOL_KEYS[rng.nextInt(SYMBOL_KEYS.length)]!]!;
      return {
        kind: "derivative",
        order: 1,
        partial: true,
        expression: generateRandomTree(rng, depth + 1, maxDepth),
        variable: varSym,
      };
    }
    case 10: {
      // Integral (int)
      const varSym = SYMBOLS[SYMBOL_KEYS[rng.nextInt(SYMBOL_KEYS.length)]!]!;
      return {
        kind: "integral",
        expression: generateRandomTree(rng, depth + 1, maxDepth),
        variable: varSym,
      };
    }
    case 11: {
      // Dot product
      return {
        kind: "dotProduct",
        left: generateRandomTree(rng, depth + 1, maxDepth),
        right: generateRandomTree(rng, depth + 1, maxDepth),
      };
    }
    case 12: {
      // Cross product
      return {
        kind: "crossProduct",
        left: generateRandomTree(rng, depth + 1, maxDepth),
        right: generateRandomTree(rng, depth + 1, maxDepth),
      };
    }
    case 13: {
      // Vector
      return {
        kind: "vector",
        elements: [
          generateRandomTree(rng, depth + 1, maxDepth),
          generateRandomTree(rng, depth + 1, maxDepth),
        ],
      };
    }
    case 14:
    default: {
      // Power with integer exponent on simple atom
      const expVal = String(rng.nextInt(4) + 2);
      const base = generateRandomTree(rng, maxDepth, maxDepth); // atom terminal
      return {
        kind: "power",
        base,
        exponent: { kind: "number", value: expVal },
      };
    }
  }
}

describe("Semantic Expression Tree Roundtrip Property Test", () => {
  const SEEDS = ["1", "9007199254740993", "18446744073709551615"] as const;
  const TREES_PER_SEED = [167, 167, 166]; // Total: 500 trees

  SEEDS.forEach((seed, seedIdx) => {
    const count = TREES_PER_SEED[seedIdx]!;
    test(`roundtrip on seed "${seed}" (${count} trees)`, () => {
      const rng = new SplitMix64(seed);
      for (let i = 0; i < count; i++) {
        const tree = generateRandomTree(rng, 0, 4);
        const authored = printAuthoring(tree, { includeOpIds: false });
        const parsed = parseAuthoring(authored, {
          equationId: "eq-test",
          symbols: SYMBOLS,
        });

        const match = structuralEqual(parsed, tree);
        if (!match) {
          throw new Error(
            `Structural equality failed on seed ${seed}, tree ${i}!\nAuthored: ${authored}\nExpected: ${JSON.stringify(tree)}\nParsed: ${JSON.stringify(parsed)}`,
          );
        }
        expect(match).toBe(true);
      }
    });
  });
});
