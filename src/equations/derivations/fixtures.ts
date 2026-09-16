/**
 * Signature derivation fixtures (five authentic derivations across the four papers)
 * and adversarial fixture chains for compiler and verifier validation (am-eq-derivation-chains-r4c).
 */

import type { Expression } from "../ast.ts";
import type { DerivationChain, DerivationStep, PremiseRef } from "./types.ts";

// Helper to construct symbolic expressions for fixtures
const sym = (termId: string, quantityId: string = termId): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});

const num = (value: string): Expression => ({
  kind: "number",
  value,
});

const prod = (...args: Expression[]): Expression => ({
  kind: "product",
  args,
});

const sum = (...args: Expression[]): Expression => ({
  kind: "sum",
  args,
});

const quot = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});

const rel = (
  operator: "=" | "approx" | "define",
  left: Expression,
  right: Expression,
): Expression => ({
  kind: "relation",
  operator,
  left,
  right,
});

const avg = (argument: Expression): Expression => ({
  kind: "average",
  argument,
});

const fn = (name: "exp" | "ln" | "sin" | "cos", argument: Expression): Expression => ({
  kind: "function",
  name,
  argument,
});

// ---------------------------------------------------------------------------
// 1. Brownian Pedagogical Reconstruction (Variance of a sum of displacements)
// ---------------------------------------------------------------------------
export const fixtureBrownianPedagogicalReconstruction: DerivationChain = Object.freeze({
  id: "chain-bm-pedagogical-variance",
  proofRouteId: "route-bm-pedagogical-variance",
  routeKind: "pedagogical-reconstruction",
  target: "eq-bm-04-variance",
  entryAssumptions: Object.freeze<PremiseRef[]>([
    { ref: "premise-independent-displacements", edgeType: "pedagogical-reconstruction" },
    { ref: "premise-zero-mean-displacements", edgeType: "pedagogical-reconstruction" },
  ]),
  steps: Object.freeze<DerivationStep[]>([
    {
      id: "bm-ped-step-1",
      from: sym("x"),
      to: sym("x_sum"),
      changedSubexpressionIds: ["x"],
      rule: {
        kind: "substitute",
        params: {
          targetId: "x",
          replacement: sym("x_sum"),
          citedEquality: "total displacement is sum of individual steps",
        },
      },
      reasonKind: "definition",
      reasons: {
        r0: "Total displacement is the sum of steps.",
        r1: "Express total displacement x as the sum of n individual independent steps Delta_i.",
        r2: "We model the net displacement x(t) after time t as the sum over n time intervals tau of independent displacement steps Delta_i.",
      },
      tool: "foundation:random-walks",
      premiseRefs: [
        { ref: "premise-independent-displacements", edgeType: "pedagogical-reconstruction" },
      ],
      isMove: false,
      verification: { status: "verified" },
    },
    {
      id: "bm-ped-step-2",
      from: rel("=", sym("x2"), prod(sym("x_sum"), sym("x_sum"))),
      to: rel("=", avg(sym("x2")), avg(prod(sym("x_sum"), sym("x_sum")))),
      changedSubexpressionIds: ["x2"],
      rule: {
        kind: "registered-identity",
        params: { identityId: "linearity-of-average" },
      },
      reasonKind: "probability",
      reasons: {
        r0: "Take the statistical average of both sides.",
        r1: "Apply the expectation operator to compute the mean squared displacement.",
        r2: "Ensemble averaging preserves equality under linearity of statistical expectation.",
      },
      tool: "foundation:mean-variance-rms",
      premiseRefs: [],
      isMove: false,
      verification: { status: "verified" },
    },
    {
      id: "bm-ped-step-3",
      from: rel("=", avg(sym("x2")), avg(prod(sym("x_sum"), sym("x_sum")))),
      to: rel("=", avg(sym("x2")), prod(sym("n"), avg(sym("Delta2")))),
      changedSubexpressionIds: ["x_sum"],
      rule: {
        kind: "registered-identity",
        params: {
          identityId: "independent-zero-mean-product-vanishes",
          citedPremises: ["premise-independent-displacements", "premise-zero-mean-displacements"],
        },
      },
      reasonKind: "probability",
      reasons: {
        r0: "Cross terms average away.",
        r1: "Cross terms <Delta_i Delta_j> vanish because distinct steps are independent with zero mean.",
        r2: "Expanding the squared sum gives n direct terms <Delta_i^2> and n(n-1) cross terms <Delta_i Delta_j>. Because distinct steps are statistically independent with <Delta_i> = 0, every cross term averages to zero.",
      },
      tool: "foundation:probability-independence",
      premiseRefs: [
        { ref: "premise-independent-displacements", edgeType: "pedagogical-reconstruction" },
        { ref: "premise-zero-mean-displacements", edgeType: "pedagogical-reconstruction" },
      ],
      isMove: true,
      moveLabel:
        "Cross terms average away because distinct displacements are independent with zero mean",
      verification: { status: "verified" },
    },
    {
      id: "bm-ped-step-4",
      from: rel("=", avg(sym("x2")), {
        kind: "product",
        opId: "n_Delta2_prod",
        args: [sym("n"), avg(sym("Delta2"))],
      }),
      to: rel("=", avg(sym("x2")), prod(num("2"), sym("D"), sym("t"))),
      changedSubexpressionIds: ["n_Delta2_prod"],
      rule: {
        kind: "substitute",
        params: {
          targetId: "n_Delta2_prod",
          replacement: prod(num("2"), sym("D"), sym("t")),
          citedEquality: "n = t/tau and D = <Delta^2>/(2 tau) gives n <Delta^2> = 2 D t",
        },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "Substitute time t and diffusion coefficient D.",
        r1: "Substitute step count n = t/tau and definition D = <Delta^2> / (2 tau).",
        r2: "With n = t/tau steps elapsed, n <Delta^2> = (t/tau) (2 tau D) = 2 D t.",
      },
      tool: "foundation:diffusion-equation",
      premiseRefs: [{ ref: "def-diffusion-coefficient", edgeType: "pedagogical-reconstruction" }],
      isMove: false,
      verification: { status: "verified" },
    },
    {
      id: "bm-ped-step-5",
      from: rel("=", avg(sym("x2")), prod(num("2"), sym("D"), sym("t"))),
      to: rel(
        "=",
        { kind: "root", radicand: avg(sym("x2")), degree: 2 },
        { kind: "root", radicand: prod(num("2"), sym("D"), sym("t")), degree: 2 },
      ),
      changedSubexpressionIds: ["avg_x2"],
      rule: {
        kind: "monotonic-function",
        params: {
          function: "square-root",
          domain: "x >= 0, t >= 0, D > 0",
          branch: "positive",
          branchCondition: "physical displacement magnitude lambda_x is non-negative",
        },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "Take the square root to find mean displacement lambda_x.",
        r1: "Take the positive square root on the non-negative domain to obtain root-mean-square displacement.",
        r2: "The observable mean displacement lambda_x = sqrt(<x^2>) is the positive square root sqrt(2Dt).",
      },
      tool: "foundation:functions-graphs",
      premiseRefs: [],
      isMove: false,
      verification: { status: "verified" },
    },
  ]),
});

// ---------------------------------------------------------------------------
// 2. Brownian Source Order (Einstein 1905 §4 Diffusion Equation)
// ---------------------------------------------------------------------------
export const fixtureBrownianSourceOrder: DerivationChain = Object.freeze({
  id: "chain-bm-source-diffusion-equation",
  proofRouteId: "route-bm-source-diffusion-equation",
  routeKind: "source-order",
  target: "eq-bm-04-variance",
  entryAssumptions: Object.freeze<PremiseRef[]>([
    { ref: "premise-bm-transition-relation", edgeType: "historical-derivation" },
    { ref: "premise-bm-kernel-symmetry", edgeType: "historical-derivation" },
  ]),
  steps: Object.freeze<DerivationStep[]>([
    {
      id: "bm-src-step-1",
      from: rel("=", sym("f_next"), sym("integral_conv")),
      to: rel("=", sum(sym("f"), prod(sym("tau"), sym("df_dt"))), sym("integral_conv")),
      changedSubexpressionIds: ["f_next"],
      rule: {
        kind: "truncate-series",
        params: { variable: "tau", order: 1, domain: "tau << t", neglected: "O(tau^2)" },
      },
      reasonKind: "approximation",
      reasons: {
        r0: "Expand f(x, t+tau) to first order in tau.",
        r1: "Taylor expand the left-hand side in time interval tau.",
        r2: "Because tau is small compared to observation time t, f(x, t+tau) = f(x,t) + tau (df/dt) + O(tau^2).",
      },
      tool: "foundation:taylor-expansion",
      premiseRefs: [{ ref: "premise-bm-transition-relation", edgeType: "historical-derivation" }],
      isMove: false,
      approximation: { variable: "tau", order: 1, domain: "tau << t", neglected: "O(tau^2)" },
      verification: { status: "authored-unverified", reviewRecordId: "rr-bm-04-taylor-time" },
    },
    {
      id: "bm-src-step-2",
      from: rel("=", sum(sym("f"), prod(sym("tau"), sym("df_dt"))), sym("integral_conv")),
      to: rel(
        "=",
        sum(sym("f"), prod(sym("tau"), sym("df_dt"))),
        sum(
          prod(sym("f"), sym("int_phi")),
          prod(sym("df_dx"), sym("int_Delta_phi")),
          prod(quot(sym("d2f_dx2"), num("2")), sym("int_Delta2_phi")),
        ),
      ),
      changedSubexpressionIds: ["integral_conv"],
      rule: {
        kind: "truncate-series",
        params: { variable: "Delta", order: 2, domain: "Delta << x", neglected: "O(Delta^3)" },
      },
      reasonKind: "approximation",
      reasons: {
        r0: "Expand f(x+Delta, t) to second order in Delta.",
        r1: "Taylor expand spatial distribution inside the kernel integral.",
        r2: "Expanding f(x+Delta, t) = f(x,t) + Delta (df/dx) + (Delta^2 / 2) (d^2f/dx^2) + O(Delta^3).",
      },
      tool: "foundation:taylor-expansion",
      premiseRefs: [],
      isMove: false,
      approximation: { variable: "Delta", order: 2, domain: "Delta << x", neglected: "O(Delta^3)" },
      verification: { status: "authored-unverified", reviewRecordId: "rr-bm-04-taylor-space" },
    },
    {
      id: "bm-src-step-3",
      from: sum(prod(sym("f"), sym("int_phi")), prod(sym("df_dx"), sym("int_Delta_phi"))),
      to: sum(sym("f"), prod(sym("df_dx"), sym("int_Delta_phi"))),
      changedSubexpressionIds: ["int_phi"],
      rule: {
        kind: "registered-identity",
        params: { identityId: "kernel-normalization" },
      },
      reasonKind: "calculus",
      reasons: {
        r0: "Kernel normalization: integral of phi(Delta) is 1.",
        r1: "The total probability integral of the displacement distribution equals 1.",
        r2: "By probability conservation, int phi(Delta) dDelta = 1, canceling the zeroth order f(x,t) term on both sides.",
      },
      tool: "foundation:integration",
      premiseRefs: [
        { ref: "premise-bm-probability-conservation", edgeType: "historical-derivation" },
      ],
      isMove: false,
      verification: { status: "verified" },
    },
    {
      id: "bm-src-step-4",
      from: sum(sym("f"), prod(sym("df_dx"), sym("int_Delta_phi"))),
      to: sym("f"),
      changedSubexpressionIds: ["int_Delta_phi"],
      rule: {
        kind: "registered-identity",
        params: { identityId: "odd-moments-symmetric-kernel" },
      },
      reasonKind: "symmetry",
      reasons: {
        r0: "The first moment vanishes by symmetry of phi.",
        r1: "Symmetry phi(Delta) = phi(-Delta) eliminates the odd first moment.",
        r2: "Because positive and negative displacements are equally probable in a resting fluid, int Delta phi(Delta) dDelta = 0 identically.",
      },
      tool: "foundation:gaussian-distributions",
      premiseRefs: [{ ref: "premise-bm-kernel-symmetry", edgeType: "historical-derivation" }],
      isMove: true,
      moveLabel:
        "Symmetry of the displacement distribution φ(Δ) = φ(-Δ) eliminates the first moment",
      verification: { status: "verified" },
    },
    {
      id: "bm-src-step-5",
      from: {
        kind: "relation",
        opId: "bm_diffusion_integral_rel",
        operator: "=",
        left: prod(sym("tau"), sym("df_dt")),
        right: prod(quot(sym("d2f_dx2"), num("2")), sym("int_Delta2_phi")),
      },
      to: rel("=", sym("df_dt"), prod(sym("D"), sym("d2f_dx2"))),
      changedSubexpressionIds: ["bm_diffusion_integral_rel"],
      rule: {
        kind: "substitute",
        params: {
          targetId: "bm_diffusion_integral_rel",
          replacement: rel("=", sym("df_dt"), prod(sym("D"), sym("d2f_dx2"))),
          citedEquality:
            "definition D = (1/tau) int (Delta^2 / 2) phi(Delta) dDelta yields df/dt = D d²f/dx²",
        },
      },
      reasonKind: "definition",
      reasons: {
        r0: "Identify diffusion coefficient D to reach the diffusion equation.",
        r1: "Substitute the integral definition of D to obtain df/dt = D d²f/dx².",
        r2: "Identifying D = (1/tau) int (Delta^2 / 2) phi(Delta) dDelta yields Einstein's celebrated differential equation of diffusion.",
      },
      tool: "foundation:diffusion-equation",
      premiseRefs: [{ ref: "def-diffusion-coefficient", edgeType: "historical-derivation" }],
      isMove: false,
      verification: { status: "verified" },
    },
  ]),
});

// ---------------------------------------------------------------------------
// 3. Paper 1 Wien Entropy (Heuristic Light-Quanta §1-§4)
// ---------------------------------------------------------------------------
export const fixturePaper1WienEntropy: DerivationChain = Object.freeze({
  id: "chain-lq-wien-entropy",
  proofRouteId: "route-lq-wien-entropy",
  routeKind: "source-order",
  target: "eq-lq-04-entropy-volume",
  entryAssumptions: Object.freeze<PremiseRef[]>([
    { ref: "premise-wien-radiation-law", edgeType: "historical-derivation" },
    { ref: "premise-zero-radiation-entropy-bc", edgeType: "historical-derivation" },
  ]),
  steps: Object.freeze<DerivationStep[]>([
    {
      id: "lq-step-1",
      from: sym("ds_drho"),
      to: prod(
        quot(num("-1"), prod(sym("B"), sym("nu"))),
        fn("ln", quot(sym("rho"), prod(sym("A"), sym("nu3")))),
      ),
      changedSubexpressionIds: ["ds_drho"],
      rule: {
        kind: "substitute",
        params: {
          targetId: "ds_drho",
          replacement: prod(
            quot(num("-1"), prod(sym("B"), sym("nu"))),
            fn("ln", quot(sym("rho"), prod(sym("A"), sym("nu3")))),
          ),
          citedEquality: "Wien's law inverted to express (ds_nu/drho_nu)_nu",
        },
      },
      reasonKind: "physical-premise",
      reasons: {
        r0: "Start from Wien radiation law.",
        r1: "Invert Wien's spectral distribution law to relate entropy derivative to radiation density.",
        r2: "In Wien's high-frequency limit rho_nu = A nu^3 exp(-B nu / T), so 1/T = (ds_nu/drho_nu) = -(1/B nu) ln(rho_nu / A nu^3).",
      },
      premiseRefs: [{ ref: "premise-wien-radiation-law", edgeType: "historical-derivation" }],
      isMove: false,
      verification: { status: "verified" },
    },
    {
      id: "lq-step-2",
      from: prod(
        quot(num("-1"), prod(sym("B"), sym("nu"))),
        fn("ln", quot(sym("rho"), prod(sym("A"), sym("nu3")))),
      ),
      to: {
        kind: "product",
        opId: "s_nu_integral_form",
        args: [
          quot(num("-1"), prod(sym("B"), sym("nu"))),
          sym("rho"),
          sum(fn("ln", quot(sym("rho"), prod(sym("A"), sym("nu3")))), num("-1")),
        ],
      },
      changedSubexpressionIds: ["rho"],
      rule: {
        kind: "integrate",
        params: {
          variable: "rho",
          boundaryCondition: "zero radiation entropy s_nu -> 0 as rho_nu -> 0",
        },
      },
      reasonKind: "calculus",
      reasons: {
        r0: "Integrate with zero-radiation boundary condition.",
        r1: "Integrate with respect to radiation density, fixing constant C(nu) by s_nu(0) = 0.",
        r2: "Integrating -ln(rho/alpha) with respect to rho yields -rho(ln(rho/alpha) - 1) + C(nu). The physical requirement that entropy vanishes when radiation density vanishes forces C(nu) = 0.",
      },
      tool: "foundation:integration",
      premiseRefs: [
        { ref: "premise-zero-radiation-entropy-bc", edgeType: "historical-derivation" },
      ],
      isMove: false,
      verification: { status: "authored-unverified", reviewRecordId: "rr-lq-01-integration" },
    },
    {
      id: "lq-step-3",
      from: {
        kind: "product",
        opId: "s_nu_integral_form",
        args: [
          quot(num("-1"), prod(sym("B"), sym("nu"))),
          sym("rho"),
          sum(fn("ln", quot(sym("rho"), prod(sym("A"), sym("nu3")))), num("-1")),
        ],
      },
      to: prod(quot(sym("E"), prod(sym("B"), sym("nu"))), fn("ln", quot(sym("V"), sym("V0")))),
      changedSubexpressionIds: ["s_nu_integral_form"],
      rule: {
        kind: "substitute",
        params: {
          targetId: "s_nu_integral_form",
          replacement: prod(
            quot(sym("E"), prod(sym("B"), sym("nu"))),
            fn("ln", quot(sym("V"), sym("V0"))),
          ),
          citedEquality:
            "E = V dnu rho_nu at constant total monochromatic energy E gives Delta S = (E / B nu) ln(V/V0)",
        },
      },
      reasonKind: "physical-premise",
      reasons: {
        r0: "Monochromatic radiation entropy scales logarithmically with volume.",
        r1: "Holding total energy E fixed while volume changes from V0 to V gives Delta S = (E / B nu) ln(V/V0).",
        r2: "For monochromatic radiation of fixed energy E in a narrow band, total entropy S = V s_nu. When volume changes from V0 to V at constant E, S(V) - S(V0) = (E / B nu) ln(V/V0), identically matching the entropy of an ideal gas composed of independent quanta.",
      },
      tool: "foundation:logarithms",
      premiseRefs: [
        { ref: "premise-monochromatic-fixed-energy", edgeType: "historical-derivation" },
      ],
      isMove: true,
      moveLabel:
        "Fixed monochromatic energy in variable volume yields logarithmic entropy dependence",
      verification: { status: "verified" },
    },
  ]),
});

// ---------------------------------------------------------------------------
// 4. Paper 4 Two Ledgers (Mass-Energy Equivalence)
// ---------------------------------------------------------------------------
export const fixturePaper4TwoLedgers: DerivationChain = Object.freeze({
  id: "chain-me-two-ledgers",
  proofRouteId: "route-me-two-ledgers",
  routeKind: "source-order",
  target: "eq-me-01-mass-energy",
  entryAssumptions: Object.freeze<PremiseRef[]>([
    {
      ref: "premise-sr-light-energy-transformation",
      edgeType: "historical-derivation",
      admittedImport: {
        sourcePaper: "special-relativity",
        sourceSection: "8",
        sourceEquationId: "eq-sr-08-light-energy",
        admissionRule: "Doppler and aberration transformation of plane light wave energy",
      },
    },
  ]),
  steps: Object.freeze<DerivationStep[]>([
    {
      id: "me-step-1",
      from: sym("H0_minus_E0"),
      to: prod(sym("L"), sum(sym("gamma"), num("-1"))),
      changedSubexpressionIds: ["H0_minus_E0"],
      rule: {
        kind: "substitute",
        params: {
          targetId: "H0_minus_E0",
          replacement: prod(sym("L"), sum(sym("gamma"), num("-1"))),
          citedEquality:
            "(H0 - E0) - (H1 - E1) = L (gamma - 1) from Paper 3 §8 light energy transformation",
        },
      },
      reasonKind: "physical-premise",
      reasons: {
        r0: "Energy difference before and after emission in moving frame.",
        r1: "Using the light energy transformation from Paper 3 §8, (H0 - E0) - (H1 - E1) equals L(gamma - 1).",
        r2: "Einstein compares the energy differences before and after light emission in both frames: (H0 - E0) - (H1 - E1) = L { 1/sqrt(1 - v^2/c^2) - 1 }.",
      },
      tool: "foundation:momentum-energy-light",
      premiseRefs: [
        {
          ref: "premise-sr-light-energy-transformation",
          edgeType: "historical-derivation",
          admittedImport: {
            sourcePaper: "special-relativity",
            sourceSection: "8",
            sourceEquationId: "eq-sr-08-light-energy",
            admissionRule: "Doppler and aberration transformation of plane light wave energy",
          },
        },
      ],
      isMove: false,
      verification: { status: "verified" },
    },
    {
      id: "me-step-2",
      from: prod(sym("L"), sum(sym("gamma"), num("-1"))),
      to: prod(quot(num("1"), num("2")), quot(sym("L"), sym("c2")), sym("v2")),
      changedSubexpressionIds: ["gamma"],
      rule: {
        kind: "truncate-series",
        params: { variable: "v/c", order: 2, domain: "v << c", neglected: "O(v^4/c^4)" },
      },
      reasonKind: "approximation",
      reasons: {
        r0: "Series expansion of gamma - 1 to order (v/c)².",
        r1: "Taylor expand the Lorentz factor gamma - 1 ≈ (1/2)(v/c)² for slow speeds.",
        r2: "Since gamma = (1 - v²/c²)^(-1/2) = 1 + (1/2)(v/c)² + (3/8)(v/c)⁴ + ..., L(gamma - 1) = (1/2)(L/c²) v² up to fourth order.",
      },
      tool: "foundation:taylor-expansion",
      premiseRefs: [],
      isMove: false,
      approximation: { variable: "v/c", order: 2, domain: "v << c", neglected: "O(v^4/c^4)" },
      verification: { status: "authored-unverified", reviewRecordId: "rr-me-01-series-truncation" },
    },
    {
      id: "me-step-3",
      from: {
        kind: "relation",
        opId: "me_step_3_rel",
        operator: "=",
        left: sym("Delta_K"),
        right: prod(quot(num("1"), num("2")), quot(sym("L"), sym("c2")), sym("v2")),
      },
      to: rel("=", sym("Delta_m"), quot(sym("L"), sym("c2"))),
      changedSubexpressionIds: ["me_step_3_rel"],
      rule: {
        kind: "substitute",
        params: {
          targetId: "me_step_3_rel",
          replacement: rel("=", sym("Delta_m"), quot(sym("L"), sym("c2"))),
          citedEquality: "Kinetic energy change Delta K = (1/2) Delta m v² equates Delta m = L/c²",
        },
      },
      reasonKind: "physical-premise",
      reasons: {
        r0: "The lost kinetic energy corresponds to a loss in mass Delta m = L/c².",
        r1: "Equate kinetic energy difference (H - E) with (1/2) m v² to identify inertial mass change.",
        r2: "The quantity H - E differs from rest energy only by the kinetic energy K. Thus K0 - K1 = (1/2) (L/c²) v², proving the body loses inertial mass Delta m = L/c² when radiating energy L.",
      },
      tool: "foundation:momentum-energy-light",
      premiseRefs: [
        { ref: "premise-kinetic-energy-definition", edgeType: "historical-derivation" },
      ],
      isMove: true,
      moveLabel: "Kinetic energy difference identifies loss of inertial mass Δm = L/c²",
      verification: { status: "verified" },
    },
  ]),
});

// ---------------------------------------------------------------------------
// 5. Pedagogical Lorentz-Map Construction
// ---------------------------------------------------------------------------
export const fixtureLorentzMapConstruction: DerivationChain = Object.freeze({
  id: "chain-sr-lorentz-boost-construction",
  proofRouteId: "route-sr-lorentz-boost-construction",
  routeKind: "pedagogical-reconstruction",
  target: "eq-sr-03-lorentz-boost",
  entryAssumptions: Object.freeze<PremiseRef[]>([
    { ref: "premise-relativity-principle", edgeType: "pedagogical-reconstruction" },
    { ref: "premise-constancy-light-speed", edgeType: "pedagogical-reconstruction" },
    { ref: "premise-spatial-isotropy", edgeType: "pedagogical-reconstruction" },
  ]),
  steps: Object.freeze<DerivationStep[]>([
    {
      id: "sr-ped-step-1",
      from: sym("x_prime_form"),
      to: prod(sym("a_v"), sum(sym("x"), prod(num("-1"), sym("v"), sym("t")))),
      changedSubexpressionIds: ["x_prime_form"],
      rule: {
        kind: "substitute",
        params: {
          targetId: "x_prime_form",
          replacement: prod(sym("a_v"), sum(sym("x"), prod(num("-1"), sym("v"), sym("t")))),
          citedEquality: "General linear transformation for x' moving at speed v",
        },
      },
      reasonKind: "definition",
      reasons: {
        r0: "Linear transformation form for x' and t'.",
        r1: "Assume linear transformation x' = a(v)(x - vt) and t' = b(v)t + d(v)x.",
        r2: "Spacetime homogeneity requires coordinate transformations between inertial frames to be linear.",
      },
      tool: "foundation:frames-events",
      premiseRefs: [
        { ref: "premise-relativity-principle", edgeType: "pedagogical-reconstruction" },
      ],
      isMove: false,
      verification: { status: "verified" },
    },
    {
      id: "sr-ped-step-2",
      from: sym("t_prime_form"),
      to: sum(
        prod(sym("a_v"), sym("t")),
        prod(quot(prod(num("-1"), sym("a_v"), sym("v")), sym("c2")), sym("x")),
      ),
      changedSubexpressionIds: ["t_prime_form"],
      rule: {
        kind: "substitute",
        params: {
          targetId: "t_prime_form",
          replacement: sum(
            prod(sym("a_v"), sym("t")),
            prod(quot(prod(num("-1"), sym("a_v"), sym("v")), sym("c2")), sym("x")),
          ),
          citedEquality: "Light pulse speed constancy in both frames gives b=a and d=-av/c²",
        },
      },
      reasonKind: "physical-premise",
      reasons: {
        r0: "Constancy of light speed along ±x fixes b and d.",
        r1: "Light pulse conditions x = ct => x' = ct' and x = -ct => x' = -ct' force b = a and d = -av/c².",
        r2: "Ensuring spherical light wave fronts propagate at c in both frames sets b(v) = a(v) and d(v) = -a(v)v/c².",
      },
      tool: "foundation:fields-waves",
      premiseRefs: [
        { ref: "premise-constancy-light-speed", edgeType: "pedagogical-reconstruction" },
      ],
      isMove: false,
      verification: { status: "verified" },
    },
    {
      id: "sr-ped-step-3",
      from: sym("boost_composition"),
      to: rel(
        "=",
        prod(
          sym("a_v"),
          sym("a_minus_v"),
          sum(num("1"), quot(prod(num("-1"), sym("v2")), sym("c2"))),
        ),
        num("1"),
      ),
      changedSubexpressionIds: ["boost_composition"],
      rule: {
        kind: "substitute",
        params: {
          targetId: "boost_composition",
          replacement: rel(
            "=",
            prod(
              sym("a_v"),
              sym("a_minus_v"),
              sum(num("1"), quot(prod(num("-1"), sym("v2")), sym("c2"))),
            ),
            num("1"),
          ),
          citedEquality: "Composing forward boost v with reverse boost -v yields identity",
        },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "Boost composition with inverse velocity.",
        r1: "Applying boost(-v) to boost(v) must return the original coordinates.",
        r2: "Since boost(-v) is the physical inverse of boost(v), direct substitution yields a(v) a(-v) (1 - v²/c²) = 1.",
      },
      premiseRefs: [
        { ref: "premise-relativity-principle", edgeType: "pedagogical-reconstruction" },
      ],
      isMove: false,
      verification: { status: "verified" },
    },
    {
      id: "sr-ped-step-4",
      from: rel(
        "=",
        prod(
          sym("a_v"),
          sym("a_minus_v"),
          sum(num("1"), quot(prod(num("-1"), sym("v2")), sym("c2"))),
        ),
        num("1"),
      ),
      to: rel(
        "=",
        prod(
          prod(sym("a_v"), sym("a_v")),
          sum(num("1"), quot(prod(num("-1"), sym("v2")), sym("c2"))),
        ),
        num("1"),
      ),
      changedSubexpressionIds: ["a_minus_v"],
      rule: {
        kind: "registered-identity",
        params: { identityId: "spatial-isotropy" },
      },
      reasonKind: "symmetry",
      reasons: {
        r0: "Spatial isotropy: a(v) = a(-v).",
        r1: "Spatial isotropy requires scaling to depend only on velocity magnitude, so a(-v) = a(v).",
        r2: "Space is isotropic: reversing the coordinate axis cannot alter scale factors, hence a(v) = a(-v).",
      },
      premiseRefs: [{ ref: "premise-spatial-isotropy", edgeType: "pedagogical-reconstruction" }],
      isMove: false,
      verification: { status: "verified" },
    },
    {
      id: "sr-ped-step-5",
      from: rel(
        "=",
        prod(sym("a_v"), sym("a_v")),
        quot(num("1"), sum(num("1"), quot(prod(num("-1"), sym("v2")), sym("c2")))),
      ),
      to: rel(
        "=",
        { kind: "root", radicand: prod(sym("a_v"), sym("a_v")), degree: 2 },
        {
          kind: "root",
          radicand: quot(num("1"), sum(num("1"), quot(prod(num("-1"), sym("v2")), sym("c2")))),
          degree: 2,
        },
      ),
      changedSubexpressionIds: ["a_v"],
      rule: {
        kind: "monotonic-function",
        params: {
          function: "square-root",
          domain: "v < c",
          branch: "positive",
          branchCondition: "continuity with rest state a(0) = 1",
        },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "Continuity selects positive branch a(v) = 1/√(1 - v²/c²).",
        r1: "Taking square root with branch condition a(0) = 1 gives a(v) = gamma.",
        r2: "Solving a(v)² = 1 / (1 - v²/c²) admits two roots; continuity with the stationary limit a(0) = 1 selects the positive root a(v) = gamma.",
      },
      tool: "foundation:functions-graphs",
      premiseRefs: [],
      isMove: true,
      moveLabel:
        "Continuity with rest state a(0) = 1 selects positive root branch a(v) = 1/√(1 - v²/c²)",
      verification: { status: "verified" },
    },
    {
      id: "sr-ped-step-6",
      from: sym("boost_transform"),
      to: rel(
        "=",
        sum(prod(sym("c2"), sym("t_prime_2")), prod(num("-1"), sym("x_prime_2"))),
        sum(prod(sym("c2"), sym("t2")), prod(num("-1"), sym("x2"))),
      ),
      changedSubexpressionIds: ["boost_transform"],
      rule: {
        kind: "substitute",
        params: {
          targetId: "boost_transform",
          replacement: rel(
            "=",
            sum(prod(sym("c2"), sym("t_prime_2")), prod(num("-1"), sym("x_prime_2"))),
            sum(prod(sym("c2"), sym("t2")), prod(num("-1"), sym("x2"))),
          ),
          citedEquality: "Minkowski spacetime interval invariance c²t'² - x'² = c²t² - x²",
        },
      },
      reasonKind: "identity",
      reasons: {
        r0: "Spacetime interval preservation (modern verification oracle).",
        r1: "The Lorentz transformation preserves the Minkowski quadratic form c²t² - x².",
        r2: "As an independent modern verification oracle, calculating c²t'² - x'² confirms exact algebraic equality with c²t² - x².",
      },
      premiseRefs: [
        { ref: "minkowski-interval-preservation", edgeType: "modern-verification-oracle" },
      ],
      isMove: false,
      verification: { status: "verified" },
    },
  ]),
});

// ---------------------------------------------------------------------------
// Adversarial Fixtures (designed to test verifier and compiler rejection rules)
// ---------------------------------------------------------------------------

/** 1. Integration without integration constant or boundary condition */
export const adversarialIntegrationNoConstantOrBc: DerivationChain = Object.freeze({
  id: "chain-adv-integration-no-bc",
  proofRouteId: "route-adv-integration-no-bc",
  routeKind: "source-order",
  target: "eq-adv-1",
  entryAssumptions: [] as readonly PremiseRef[],
  steps: Object.freeze<DerivationStep[]>([
    {
      id: "adv-step-int-1",
      from: sym("df_dx"),
      to: sym("f"),
      changedSubexpressionIds: ["df_dx"],
      rule: {
        kind: "integrate" as const,
        params: { variable: "x" }, // Missing both constant and boundary condition
      },
      reasonKind: "calculus" as const,
      reasons: {
        r0: "Integrate without constant.",
        r1: "Missing boundary condition.",
        r2: "Invalid integration step.",
      },
      premiseRefs: [],
      isMove: false,
      verification: { status: "authored-unverified", reviewRecordId: "rr-adv-1" },
    },
  ]),
});

/** 2. Historical route citing modern-verification-oracle as derivation premise */
export const adversarialHistoricalCitingModernOracle: DerivationChain = Object.freeze({
  id: "chain-adv-hist-modern-oracle",
  proofRouteId: "route-adv-hist-modern-oracle",
  routeKind: "source-order", // Historical route!
  target: "eq-adv-2",
  entryAssumptions: [] as readonly PremiseRef[],
  steps: Object.freeze<DerivationStep[]>([
    {
      id: "adv-step-oracle-1",
      from: sym("x"),
      to: sym("x_prime"),
      changedSubexpressionIds: ["x"],
      rule: {
        kind: "substitute" as const,
        params: {
          targetId: "x",
          replacement: sym("x_prime"),
          citedEquality: "modern oracle substitution",
        },
      },
      reasonKind: "identity" as const,
      reasons: {
        r0: "Cite modern oracle in 1905 paper.",
        r1: "Illegally using modern verification edge as historical premise.",
        r2: "Violates epistemic edge rules.",
      },
      premiseRefs: [{ ref: "minkowski-tensor-geometry", edgeType: "modern-verification-oracle" }],
      isMove: false,
      verification: { status: "verified" },
    },
  ]),
});

/** 3. Cyclic route in premise graph */
export const adversarialCyclicRoute: DerivationChain = Object.freeze({
  id: "chain-adv-cyclic-route",
  proofRouteId: "route-adv-cyclic-route",
  routeKind: "pedagogical-reconstruction",
  target: "eq-adv-3",
  entryAssumptions: [] as readonly PremiseRef[],
  steps: Object.freeze<DerivationStep[]>([
    {
      id: "adv-step-cycle-A",
      from: sym("A"),
      to: sym("B"),
      changedSubexpressionIds: ["A"],
      rule: {
        kind: "substitute" as const,
        params: { targetId: "A", replacement: sym("B"), citedEquality: "step A cites C" },
      },
      reasonKind: "algebra" as const,
      reasons: { r0: "Step A", r1: "Step A depends on C", r2: "Circular dependency" },
      premiseRefs: [{ ref: "adv-step-cycle-C", edgeType: "pedagogical-reconstruction" }],
      isMove: false,
      verification: { status: "verified" },
    },
    {
      id: "adv-step-cycle-B",
      from: sym("B"),
      to: sym("C"),
      changedSubexpressionIds: ["B"],
      rule: {
        kind: "substitute" as const,
        params: { targetId: "B", replacement: sym("C"), citedEquality: "step B cites A" },
      },
      reasonKind: "algebra" as const,
      reasons: { r0: "Step B", r1: "Step B depends on A", r2: "Circular dependency" },
      premiseRefs: [{ ref: "adv-step-cycle-A", edgeType: "pedagogical-reconstruction" }],
      isMove: false,
      verification: { status: "verified" },
    },
    {
      id: "adv-step-cycle-C",
      from: sym("C"),
      to: sym("A"),
      changedSubexpressionIds: ["C"],
      rule: {
        kind: "substitute" as const,
        params: { targetId: "C", replacement: sym("A"), citedEquality: "step C cites B" },
      },
      reasonKind: "algebra" as const,
      reasons: { r0: "Step C", r1: "Step C depends on B", r2: "Circular dependency" },
      premiseRefs: [{ ref: "adv-step-cycle-B", edgeType: "pedagogical-reconstruction" }],
      isMove: false,
      verification: { status: "verified" },
    },
  ]),
});

/** 4. Square root without branch condition */
export const adversarialSquareRootNoBranch: DerivationChain = Object.freeze({
  id: "chain-adv-sqrt-no-branch",
  proofRouteId: "route-adv-sqrt-no-branch",
  routeKind: "pedagogical-reconstruction",
  target: "eq-adv-4",
  entryAssumptions: [] as readonly PremiseRef[],
  steps: Object.freeze<DerivationStep[]>([
    {
      id: "adv-step-sqrt-1",
      from: rel("=", sym("x2"), num("4")),
      to: rel("=", sym("x"), num("2")),
      changedSubexpressionIds: ["x2"],
      rule: {
        kind: "monotonic-function" as const,
        params: {
          function: "square-root",
          domain: "x > 0",
          // Missing branch and branchCondition!
        },
      },
      reasonKind: "algebra" as const,
      reasons: {
        r0: "Square root without branch.",
        r1: "Missing chosen branch and condition.",
        r2: "Invalid square root step.",
      },
      premiseRefs: [],
      isMove: false,
      verification: { status: "verified" },
    },
  ]),
});

/** 5. Lorentz transverse step assuming y'=y, z'=z without derivation premises */
export const adversarialLorentzTransverseNoPremises: DerivationChain = Object.freeze({
  id: "chain-adv-lorentz-transverse-no-premises",
  proofRouteId: "route-adv-lorentz-transverse-no-premises",
  routeKind: "pedagogical-reconstruction",
  target: "eq-adv-5",
  entryAssumptions: [] as readonly PremiseRef[],
  steps: Object.freeze<DerivationStep[]>([
    {
      id: "adv-step-lorentz-transverse-1",
      from: sym("y"),
      to: sym("y_prime"),
      changedSubexpressionIds: ["y"],
      rule: {
        kind: "substitute" as const,
        params: {
          targetId: "y",
          replacement: sym("y_prime"),
          citedEquality: "y'=y copied from answer",
          targetAxis: "y",
        },
      },
      reasonKind: "symmetry" as const,
      reasons: {
        r0: "Copied transverse equality.",
        r1: "Copied y'=y without premises.",
        r2: "Unjustified transverse step.",
      },
      premiseRefs: [], // Missing axis normalization, spatial symmetry, and transverse light propagation!
      isMove: false,
      verification: { status: "verified" },
    },
  ]),
});

/** 6. Mass-energy chain initializing rest energy as Mc² (circular rest energy) */
export const adversarialMassEnergyCircularRestEnergy: DerivationChain = Object.freeze({
  id: "chain-adv-mass-energy-circular",
  proofRouteId: "route-adv-mass-energy-circular",
  routeKind: "source-order",
  target: "eq-adv-mass-energy",
  entryAssumptions: [] as readonly PremiseRef[],
  steps: Object.freeze<DerivationStep[]>([
    {
      id: "adv-step-me-circular-1",
      from: sym("E0"),
      to: prod(sym("M"), sym("c2")),
      changedSubexpressionIds: ["E0"],
      rule: {
        kind: "substitute" as const,
        params: {
          targetId: "E0",
          replacement: prod(sym("M"), sym("c2")),
          citedEquality: "Assume E0 = Mc² at start",
        },
      },
      reasonKind: "physical-premise" as const,
      reasons: {
        r0: "Assume rest energy is Mc².",
        r1: "Circular definition.",
        r2: "Circular proof of E=mc².",
      },
      premiseRefs: [{ ref: "premise-mc2-initialization", edgeType: "historical-derivation" }],
      isMove: false,
      verification: { status: "verified" },
    },
  ]),
});
