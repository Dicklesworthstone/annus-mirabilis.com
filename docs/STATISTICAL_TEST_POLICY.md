# Statistical Test Policy: Stochastic Evidence and Reproducibility

**Owner:** `am-ver-statistical-policy-grj`  
**Status:** Active, Enforced in CI and Local Quality Gates  
**Applies to:** All stochastic evaluators, random stream samplers, diffusion solvers, and instrument statistical tests.

---

## 1. Executive Summary & Core Doctrine

Statistical tests in Annus Mirabilis verify the physical and mathematical correctness of stochastic simulation algorithms (such as Philox4x32-10 PRNG streams, Brownian diffusion step samplers, and particle ensemble estimators).

### The Prime Directive: Never Rerun to Pass

> **No statistical test may ever be rerun to achieve a passing result.**  
> A test failure in a statistical suite is a physical and numerical signal requiring investigation, not transient test noise to be swallowed by a retry loop.

If a test fails under its fixed seed and prespecified significance level $\alpha$:
1. The test runner halts and records structured failure evidence in JSON.
2. The failure opens an engineering investigation to diagnose the root cause (such as an incorrect variance scaling factor, biased random stream derivation, or off-by-one degrees of freedom).
3. **Seed-hunting (trying different seeds until one passes) is strictly forbidden.** Changing a seed is permissible only when accompanied by an audited commit note explaining why the previous seed violated the prespecified family-wise false alarm rate.

---

## 2. Four Closed Kinds of Statistical Evidence

Every stochastic test must declare its `evidenceKind` from this closed set:

| Evidence Kind | Description | Use Case |
|---|---|---|
| `fixed-random-golden` | Seed-fixed comparison against a tight deterministic envelope or bitwise baseline. | PRNG KAT vectors, deterministic state transitions. |
| `distribution-test` | Formal hypothesis test over an ensemble against theoretical distribution bounds. | Mean, variance, higher moments, histogram fit, and correlation. |
| `exact-transition-sampler` | Validation of an exact analytical jump process where no time-step discretization error exists. | Gaussian jump sampler $x(t) \sim \mathcal{N}(0, 2Dt)$. |
| `deterministic-convergence` | Verification of spatial and temporal convergence rates under discretization refinement. | FTCS diffusion grid convergence, truncation orders. |

---

## 3. Standardized Assertion Helpers

All statistical tests must use the standardized helpers exported from `src/testing/stats/`:

### 3.1 `assertSampleMean`
Tests whether sample mean $\bar{x} = \frac{1}{n}\sum x_i$ falls within critical bounds for expected mean $\mu$:
- **Known $\sigma$:** Uses standard error $SE = \sigma / \sqrt{n}$ and standard normal quantile $z_{1-\alpha/2}$:
  $$\left[ \mu - z_{1-\alpha/2}\frac{\sigma}{\sqrt{n}}, \;\mu + z_{1-\alpha/2}\frac{\sigma}{\sqrt{n}} \right]$$
- **Estimated $s$:** Uses sample standard deviation $s = \sqrt{\frac{1}{n-1}\sum(x_i - \bar{x})^2}$, $SE = s / \sqrt{n}$, and Student-$t$ quantile $t_{n-1, 1-\alpha/2}$:
  $$\left[ \mu - t_{n-1, 1-\alpha/2}\frac{s}{\sqrt{n}}, \;\mu + t_{n-1, 1-\alpha/2}\frac{s}{\sqrt{n}} \right]$$

### 3.2 `assertGaussianVariance`
Tests whether Gaussian sample variance $s^2$ falls within chi-square bounds for true variance $\sigma_0^2$:
$$\left[ \frac{\sigma_0^2 \cdot \chi^2_{\text{df}, \alpha/2}}{\text{df}}, \;\frac{\sigma_0^2 \cdot \chi^2_{\text{df}, 1-\alpha/2}}{\text{df}} \right]$$
where $\text{df} = n - 1$ (or $\text{df} = n$ if the true mean $\mu$ is known).

### 3.3 `assertNonGaussianMeanSquare`
Tests the empirical mean square $M_2 = \frac{1}{n}\sum x_i^2$ for zero-mean non-Gaussian steps against declared second moment $\mu_2 = \sigma^2$ and fourth moment $\mu_4$:
$$\text{Var}(M_2) = \frac{\mu_4 - \sigma^4}{n}$$
- **Deterministic moment case (e.g. coin steps $x \in \{-1, +1\}$):** $\mu_4 = 1, \sigma^2 = 1 \implies \text{Var}(M_2) = 0$. $M_2$ must be exact ($M_2 = 1$).
- **General non-Gaussian case (e.g. uniform steps $x \in [-a, a]$):** $\mu_4 = a^4/5, \sigma^2 = a^2/3 \implies \text{Var}(M_2) = \frac{4}{45n}a^4$.
- **Gaussian case ($x \sim \mathcal{N}(0, \sigma^2)$):** $\mu_4 = 3\sigma^4 \implies \text{Var}(M_2) = \frac{2\sigma^4}{n}$.

### 3.4 `assertProportion`
Tests empirical success proportion $\hat{p} = k / n$ against binomial / Wilson score bounds around expected probability $p_0$:
$$\left[ p_0 - z_{1-\alpha/2}\sqrt{\frac{p_0(1-p_0)}{n}}, \; p_0 + z_{1-\alpha/2}\sqrt{\frac{p_0(1-p_0)}{n}} \right]$$

### 3.5 `assertHistogramFit`
Computes Pearson chi-square goodness-of-fit for $k$ bins:
$$\chi^2 = \sum_{i=1}^k \frac{(O_i - E_i)^2}{E_i}, \quad E_i = N \cdot p_i$$
Asserts $\chi^2 \le \chi^2_{k-1, 1-\alpha}$.

### 3.6 `assertCorrelationNearZero`
Computes Pearson sample correlation $r$ between two series $X$ and $Y$ and tests independence using Fisher's $z$-transformation:
$$Z = \frac{1}{2}\ln\left(\frac{1+r}{1-r}\right) \sim \mathcal{N}\left(0, \frac{1}{n-3}\right)$$
Asserts $|r| \le \tanh\left(\frac{z_{1-\alpha/2}}{\sqrt{n-3}}\right)$.

### 3.7 `assertMomentGrowth`
Tests Einstein's Brownian displacement law $\langle x^2 \rangle = 2Dt$ for an ensemble of $M$ independent particles:
$$Q = \frac{M\,\widehat{\langle x^2\rangle}}{2Dt} \sim \chi^2_M$$
Asserts:
$$\widehat{\langle x^2\rangle} \in \left[ \frac{2Dt \cdot \chi^2_{M, \alpha/2}}{M}, \;\frac{2Dt \cdot \chi^2_{M, 1-\alpha/2}}{M} \right]$$

---

## 4. Independent Critical Values Table

Critical values are precomputed to 40 decimal places using arbitrary-precision `mpmath` outside the application and stored in `src/testing/stats/critical-values.json`.

### Spot Checks
The test suite validates the loaded table against published reference values:
- $\chi^2_{1, 0.975} = 5.0239$
- $\chi^2_{10, 0.025} = 3.2470$
- $\chi^2_{10, 0.975} = 20.4832$
- $\chi^2_{100, 0.025} = 74.2219$
- $\chi^2_{100, 0.975} = 129.5612$
- $z_{0.9995} = 3.2905$

---

## 5. Family-Wise Error Budget & Bonferroni Control

To prevent spurious test failures during CI runs across hundreds of assertions:
1. Each suite specifies a family-wise false-alarm budget $\alpha_{\text{family}}$ (default $10^{-6}$).
2. The effective per-assertion significance level $\alpha$ is adjusted using the Bonferroni correction:
   $$\alpha = \frac{\alpha_{\text{family}}}{m}$$
   where $m$ is the total number of statistical assertions evaluated in the suite.

---

## 6. Power & Sample Size Determination

Before running an ensemble test, the sample size $n$ must be sized to detect relevant physical discrepancies with high statistical power ($1 - \beta \ge 0.95$):
- **Mean difference $\delta$:**
  $$n \ge \left(\frac{z_{1-\alpha/2} + z_{\text{power}}}{\delta / \sigma}\right)^2$$
- **Relative variance scaling error $\delta$ (e.g. 2% error in $D$):**
  $$n \ge 1 + 2\left(\frac{z_{1-\alpha/2} + z_{\text{power}}}{\ln(1 + \delta)}\right)^2$$
- **Halved RMS scaling error (using $1/2$ instead of $1/\sqrt{2}$):**
  $\delta = (0.25 - 0.5)/0.5 = -0.5 \implies n \ge 162$ samples at $\alpha = 10^{-4}, \text{power} = 0.99$.

Use `assertMinimumSampleSize(actualN, requiredN)` in test setup.

---

## 7. Structured Logging & Retained Evidence

Every statistical assertion automatically emits structured JSONL events via `src/testing/log/logger.ts`:
- **File:** `artifacts/test-logs/statistics/<log-run-id>.jsonl`
- **Fields:** `timestamp`, `suite: "statistics"`, `logRunId`, `testId`, `beadId`, `seed`, `streamVersion`, `outcome`, `durationMs`, `message`.
- **`extra` Object:** `allocationId`, `n`, `statistic`, `observedValue`, `lowerBound`, `upperBound`, `alpha`, `familyWiseBudget`, `power`, `effect`, `evidenceKind`, `criticalValueTableDigest`.

### Retained Failure Evidence
On failure, a structured record is saved to:
`artifacts/test-logs/statistics/<log-run-id>/failures/<testId>.json`
containing complete IEEE-754 bit representations, sample size, critical bounds, table digest, and a single reproduction command.

---

## 8. Enforcement & CI Verification

The `noRetries.test.ts` test scans:
- `bunfig.toml`
- `playwright.config.ts`
- `.github/workflows/*.yml`
- `src/testing/stats/*.ts`

and fails the build if any retry flag (`retries: n`, `--retry`, `retry-times`) is present.
