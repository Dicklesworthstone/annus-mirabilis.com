import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import yaml from "js-yaml";
import type { ScientificResult } from "../../experiments/results/types.ts";
import {
  C_SI,
  kineticEnergy,
  longitudinalMass,
  transformAcceleration,
  transformForce,
  transverseMassComoving,
  transverseMassLaboratory,
} from "../../physics/reference/electron.ts";
import { type Expression, walk } from "../ast.ts";
import { expressionToDerivationLatex } from "./mathRenderer.ts";
import { evaluateExpression } from "./spotCheck.ts";
import {
  srElectronChains,
  srElectronDisplayExpression,
  srElectronReadingSet,
  srElectronWork,
} from "./srElectron.ts";
import { structurallyEqual } from "./treeUtils.ts";
import { verifyChain } from "./verifyChain.ts";

function value(result: ScientificResult): number {
  assert.ok(result.status === "value");
  assert.equal(typeof result.value, "number");
  return result.value as number;
}
function near(actual: number, expected: number, relative = 1e-10, absolute = 1e-12) {
  assert.ok(
    Math.abs(actual - expected) <= Math.max(absolute, relative * Math.abs(expected)),
    `${actual} != ${expected}`,
  );
}
function evaluate(tree: Expression, quantities: Readonly<Record<string, number>>) {
  return evaluateExpression(
    tree,
    Object.fromEntries(
      walk(tree)
        .filter((node) => node.kind === "symbol")
        .map((node) => [node.termId, quantities[node.quantityId] as number]),
    ),
  );
}

test("electron chains retain ordered draft steps, marked moves and canonical targets", () => {
  for (const chain of srElectronChains) {
    const report = verifyChain(chain);
    assert.equal(report.passed, true, JSON.stringify(report));
    assert.equal(chain.steps.at(-1)?.id, chain.targetStepId);
    assert.equal(chain.steps.filter((step) => step.isMove).length, 1);
    for (const [index, step] of chain.steps.entries()) {
      assert.equal(step.verification.status, "authored-unverified");
      assert.ok(step.tool?.startsWith("foundation:"));
      if (index) {
        const previous = chain.steps[index - 1];
        assert.ok(previous);
        assert.ok(structurallyEqual(previous.to, step.from));
      }
      for (const tree of [step.from, step.to]) {
        const latex = expressionToDerivationLatex(srElectronDisplayExpression(tree));
        assert.ok(!latex.includes("eq-model-"));
        assert.ok(!latex.includes("accelerationLongitudinal"));
      }
    }
  }
});

test("electron derivations reject every adjacent reorder and missing conclusion", () => {
  for (const chain of srElectronChains) {
    assert.equal(verifyChain({ ...chain, steps: chain.steps.slice(0, -1) }).passed, false);
    for (let i = 0; i < chain.steps.length - 1; i++) {
      const steps = [...chain.steps];
      const first = steps[i];
      const second = steps[i + 1];
      assert.ok(first && second);
      [steps[i], steps[i + 1]] = [second, first];
      assert.equal(verifyChain({ ...chain, steps }).passed, false, `${chain.id} swap ${i}`);
    }
  }
});

test("mass ratios agree with frame transforms and reference owners for signed boosts and forces", () => {
  const mass = 2.7;
  for (const beta of [-0.95, -0.6, 0, 1e-6, 0.6, 0.95]) {
    const gamma = 1 / Math.sqrt(1 - beta * beta);
    for (const sign of [-1, 1]) {
      const acceleration = {
        frame: "laboratory" as const,
        components: { x: sign * 3, y: sign * 7, z: sign * 11 },
      };
      const comoving = transformAcceleration(acceleration, beta, "comoving");
      const restForce = {
        frame: "comoving" as const,
        components: {
          x: mass * comoving.components.x,
          y: mass * comoving.components.y,
          z: mass * comoving.components.z,
        },
      };
      const laboratory = transformForce(restForce, beta, "laboratory");
      const quantities = {
        electronMass: mass,
        lorentzFactor: gamma,
        longitudinalForceComoving: restForce.components.x,
        longitudinalForce: laboratory.components.x,
        transverseForceComoving: restForce.components.y,
        transverseForceLaboratory: laboratory.components.y,
        accelerationLongitudinalComoving: comoving.components.x,
        accelerationTransverseComoving: comoving.components.y,
        accelerationLongitudinalLaboratory: acceleration.components.x,
        accelerationTransverseLaboratory: acceleration.components.y,
      };
      for (const chain of srElectronChains.slice(0, 3))
        for (const step of chain.steps) {
          for (const tree of [step.from, step.to]) {
            assert.equal(tree.kind, "relation");
            if (tree.kind === "relation")
              near(evaluate(tree.left, quantities), evaluate(tree.right, quantities));
          }
        }
      near(
        laboratory.components.x / acceleration.components.x,
        value(longitudinalMass(mass, beta)),
      );
      near(
        restForce.components.y / acceleration.components.y,
        value(transverseMassComoving(mass, beta)),
      );
      near(
        laboratory.components.y / acceleration.components.y,
        value(transverseMassLaboratory(mass, beta)),
      );
      // The z response shares the transverse law even though the source preserves its printed typo.
      near(
        restForce.components.z / acceleration.components.z,
        value(transverseMassComoving(mass, beta)),
      );
    }
  }
});

test("force changes precede the laboratory coefficient and division guards survive authoring", () => {
  const changed = srElectronChains[2].steps[0];
  assert.ok(changed);
  assert.equal(changed.historicalStatus, "later-force-convention");
  assert.match(changed.reasons.r1, /F′_y = γF_y/);
  for (const chain of srElectronChains)
    for (const step of chain.steps) {
      if (
        step.rule.kind !== "add-subtract-multiply-divide" ||
        step.rule.params.operation !== "divide"
      )
        continue;
      const bad = {
        ...step,
        rule: { ...step.rule, params: { ...step.rule.params, nonzeroCondition: "" } },
      };
      assert.equal(
        verifyChain({
          ...chain,
          steps: chain.steps.map((candidate) => (candidate.id === step.id ? bad : candidate)),
        }).passed,
        false,
      );
    }
});

test("work integral agrees with independent quadrature and stable kinetic-energy owner", () => {
  const mass = 1.7;
  for (const beta of [0, 1e-6, 0.01, 0.6, 0.9, -0.6]) {
    const count = 4000;
    const dx = beta / count;
    const integrand = (b: number) => b / (1 - b * b) ** 1.5;
    let sum = integrand(0) + integrand(beta);
    for (let i = 1; i < count; i++) sum += (i % 2 ? 4 : 2) * integrand(i * dx);
    const integrated = (dx * sum) / 3;
    const result = value(kineticEnergy(mass, beta).exact) / (mass * C_SI * C_SI);
    near(integrated, result, 2e-10, 1e-24);
    const finalStep = srElectronWork.steps.at(-1);
    assert.ok(finalStep && finalStep.to.kind === "relation");
    const endpoint = finalStep.to.right;
    // Direct subtraction is only compared away from zero; the numeric owner retains its stable low-speed form.
    if (Math.abs(beta) > 1e-4)
      near(
        evaluate(endpoint, {
          electronMass: mass,
          speedOfLight: C_SI,
          lorentzFactor: 1 / Math.sqrt(1 - beta * beta),
        }),
        value(kineticEnergy(mass, beta).exact),
      );
  }
  const firstStep = srElectronWork.steps[0];
  assert.ok(firstStep);
  const integralLatex = expressionToDerivationLatex(srElectronDisplayExpression(firstStep.to));
  assert.match(integralLatex, /\\int_\{0\}\^\{v\}/);
  assert.match(integralLatex, /γ\\left\(u\\right\)/);
  const boundaryStep = srElectronWork.steps[3];
  assert.ok(boundaryStep);
  assert.match(boundaryStep.reasons.r2, /initial speed u₀/);
});

test("the equation bead owns exactly the displayed electron R0–R3 readings", () => {
  const owner = yaml.load(
    readFileSync(
      new URL(
        "../../../content/editorial/readings-owners/am-sre-equations-2g3h.yaml",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    targets: { id: string; kind: string; readings: unknown }[];
  };
  for (const step of srElectronChains.flatMap((chain) => chain.steps)) {
    const target = owner.targets.find((entry) => entry.id === step.id);
    assert.equal(target?.kind, "derivation-step");
    assert.deepEqual(target?.readings, srElectronReadingSet(step));
  }
});
