# Brownian Motion Notation Concordance Verification Ledger

**Paper:** `brownian-motion` (*Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen*, Ann. Phys. (4) 17, 549–560, 1905)  
**Bibliographic key:** `ap-17-549`  
**Concordance file:** `content/notation/brownian-motion.yaml`  
**Bead:** `am-not-entries-brownian-1rq`  
**Date of Authoring:** 2026-09-17  

---

## 1. Honesty Constraint and Verification Status

> [!IMPORTANT]
> **No pinned facsimile scan and no reviewed diplomatic German ledger is currently committed in this repository.**
> Under the core engineering doctrines of Annus Mirabilis:
> - Absence is recorded; invented matches or memory-derived verifications are not admitted.
> - Where the specification requires verification against the physical facsimile, all entries are typed with `verification.status: "pending"`.
> - When the high-resolution Annalen der Physik (4) 17 facsimile is pinned and diplomatic transcription ledgers are reviewed, each entry will be verified against the physical page images.

---

## 2. Dangerous and Caution Collisions

### Danger Collision: $k$ (Viscosity vs Boltzmann's Constant)
- **Symbol:** $k$
- **Printed Meaning (§3, p. 554; §5, p. 559):** Fluid dynamic viscosity ($\eta$).
- **Modern Confusion:** A modern reader reflexively reads $k$ as Boltzmann's constant $k_B$.
- **Concordance Binding:** `quantityId: viscosity`, `operation.rename.symbol: "\\eta"`, `collision.kind: "danger"`.
- **First-use Anchors:** `bm-s3-p2` (§3), `bm-s5-p2` (§5).
- **Warning Callout:** *"DANGER COLLISION: Einstein's $k$ in paper 2 and the doctoral dissertation is fluid dynamic viscosity $\eta$, NEVER Boltzmann's constant $k_B$."*

### Caution Collision: $\kappa$ (Half of Boltzmann's Constant)
- **Symbol:** $\kappa$
- **Printed Meaning (§2, p. 551):** Statistical entropy constant satisfying $2\kappa N = R$, meaning $\kappa = \frac{R}{2N} = \frac{1}{2}k_B$.
- **Concordance Binding:** `quantityId: boltzmannConstant`, `scale: { num: 1, den: 2 }`, group rename $2\kappa \to k_B$, scaled rename $\kappa \to \frac{1}{2}k_B$.
- **Warning Callout:** *"Einstein defines $\kappa$ such that $2\kappa N = R$, meaning $\kappa = \frac{1}{2}k_B$. The group $2\kappa$ renames to $k_B$."*

### Caution Collision: $\lg$ (Natural Logarithm)
- **Symbol:** $\lg$
- **Printed Meaning (§2, p. 551):** Natural logarithm (base $e$).
- **Modern Standard Note:** ISO 80000-2 / DIN 1302 note: Einstein's $\lg$ is the natural logarithm $\ln$, not common (base-10) logarithm $\log_{10}$.

### Other Scoped Collisions
- **$P$ (Particle Radius vs Pressure):** In §3 (p. 554), $P$ is the spherical particle radius (renamed to $a$). Collides with pressure $P$ and work function $P$ in Paper 1.
- **$\nu$ (Number Density vs Frequency):** In §1 (p. 550), $\nu = n/V^*$ is number density (particles per unit volume, renamed to $n$). Collides with frequency $\nu$ in Papers 1 & 3.
- **$p_\nu$ vs $p$:** In §2 (p. 551), $p_\nu$ denotes generalized state variables (phase coordinates), distinct from osmotic pressure $p$ in §§1–2.
- **$\varphi_\nu$ vs $\varphi(\Delta)$:** In §2 (p. 551), $\varphi_\nu$ is the phase-space coordinate velocity $dp_\nu/dt$, distinct from §4's transition kernel $\varphi(\Delta)$.
- **$\mu$ (Particle Mass vs Mobility / Micron):** In §3 (p. 555), $\mu$ is the mass of a suspended particle ($m$), not mechanical mobility $\mu$ or the unit micron.
- **$\tau$ (Observation Interval vs Moving-Frame Time):** In §4 (p. 556), $\tau$ is a small observation time interval, distinct from moving-frame time $\tau$ in Paper 3 (§3).
- **$f(x,t)$ Normalization:** In §4 (p. 556), $f(x,t)$ has normalization $\int f dx = n$ (total particle count). Renaming to probability density $p(x,t)$ normalized to 1 is a substantive modernization with an explicit modern lens (`bm-prob-density-modernization`).

---

## 3. Full Inventory & Verification Ledger

| Entry ID | Scope | Printed Glyph | Modern Symbol / Group | Canonical Quantity ID | Collision | Status | Facsimile Page (Planned) |
|---|---|---|---|---|---|---|---|
| `bm-s1-v-total-volume` | §1 | $V$ | $V$ | `volume` | none | pending | 549 |
| `bm-s1-vstar-partial-volume` | §1 | $V^*$ | $V^*$ | `volume` | none | pending | 549 |
| `bm-s1-z-solute-amount` | §1 | $z$ | $n_{\text{mol}}$ | `soluteAmount` | none | pending | 549 |
| `bm-s1-p-osmotic-pressure` | §1 | $p$ | $\Pi$ | `osmoticPressure` | caution ($p_\nu$) | pending | 549 |
| `bm-s1-t-temperature` | all | $T$ | $T$ | `temperature` | none | pending | 549 |
| `bm-s1-r-molar-gas-constant` | all | $R$ | $R$ | `molarGasConstant` | none | pending | 549 |
| `bm-s1-n-particle-count` | §1 | $n$ | $N_{\text{particles}}$ | `particleCount` | caution (density $n$) | pending | 550 |
| `bm-s1-nu-number-density` | §1 | $\nu$ | $n$ | `numberDensity` | caution (frequency $\nu$) | pending | 550 |
| `bm-s1-n-avogadro-constant` | all | $N$ | $N_A$ | `avogadroConstant` | caution (field $N$) | pending | 550 |
| `bm-s2-p-nu-state-variable` | §2 | $p_\nu$ | $p_\nu$ | `stateVariable` | caution ($p$) | pending | 551 |
| `bm-s2-nu-index` | §2 | $\nu$ | $\nu$ (index) | role: index | none | pending | 551 |
| `bm-s2-phi-nu-state-variable-rate` | §2 | $\varphi_\nu$ | $\dot{p}_\nu$ | `stateVariableRate` | caution ($\varphi(\Delta)$) | pending | 551 |
| `bm-s2-ebar-system-energy` | §2 | $\bar{E}$ | $\langle E \rangle$ | `systemEnergy` | none | pending | 551 |
| `bm-s2-e-microstate-energy` | §2 | $E$ | $E$ | `microstateEnergy` | none | pending | 551 |
| `bm-s2-s-entropy` | all | $S$ | $S$ | `entropy` | none | pending | 551 |
| `bm-s2-kappa-entropy-constant` | §2 | $\kappa$ | $\tfrac{1}{2}k_B$ | `boltzmannConstant` (scale 1/2) | caution ($k_B$) | pending | 551 |
| `bm-s2-2kappa-group` | §2 | $2\kappa$ | $k_B$ | `boltzmannConstant` | none | pending | 551 |
| `bm-s2-lg-logarithm` | §2 | $\lg$ | $\ln$ | role: operator | ISO note | pending | 551 |
| `bm-s2-f-free-energy` | §2 | $F$ | $F$ | `freeEnergy` | caution (force $F$) | pending | 552 |
| `bm-s2-b-configuration-integral` | §2 | $B$ | $B$ | `configurationIntegral` (symbolic) | none | pending | 552 |
| `bm-s2-j-integral-factor` | §2 | $J$ | $J$ | `configurationIntegralFactor` (symbolic) | none | pending | 552 |
| `bm-s2-delta-variation` | §2 | $\delta$ | $\delta$ | role: operator | none | pending | 552 |
| `bm-s3-k-force-particle` | §3 | $K$ | $F_{\text{ext}}$ | `externalForcePerParticle` | caution ($F$) | pending | 553 |
| `bm-s3-x-coordinate` | all | $x$ | $x$ | role: coordinate | none | pending | 553 |
| `bm-s3-l-column-length` | §3 | $l$ | $L$ | `columnLength` | caution | pending | 553 |
| `bm-s3-k-viscosity` | §3 | $k$ | $\eta$ | `viscosity` | **DANGER** ($k_B$) | pending | 554 |
| `bm-s3-p-particle-radius` | §3 | $P$ | $a$ | `particleRadius` | caution ($p$) | pending | 554 |
| `bm-s3-mu-particle-mass` | §3 | $\mu$ | $m$ | `particleMass` | caution (mobility / $\mu\text{m}$) | pending | 555 |
| `bm-s3-d-diffusion-coefficient` | all | $D$ | $D$ | `diffusionCoefficient` | none | pending | 555 |
| `bm-s3-v-drift-velocity` | §3 | $v$ | $v_{\text{drift}}$ | `driftVelocity` | none | pending | 554 |
| `bm-s3-rn-group-boltzmann` | all | $R/N$ | $k_B$ | `boltzmannConstant` | none | pending | 555 |
| `bm-s4-tau-observation-interval` | §4 | $\tau$ | $\tau$ | `observationInterval` | caution (SR time $\tau$) | pending | 556 |
| `bm-s4-delta-displacement` | §4 | $\Delta$ | $\Delta x$ | `displacementIncrement` | none | pending | 556 |
| `bm-s4-phi-transition-kernel` | §4 | $\varphi(\Delta)$ | $\phi(\Delta x)$ | `transitionKernel` (dim $L^{-1}$) | caution ($\varphi_\nu$, $\varphi$) | pending | 556 |
| `bm-s4-f-number-density` | §4 | $f$ | $n$ | `numberDensity` | modernization note | pending | 556 |
| `bm-s4-t-time` | all | $t$ | $t$ | `elapsedTime` | none | pending | 556 |
| `bm-s5-lambda-rms-displacement` | §5 | $\lambda_x$ | $\sqrt{\langle x^2 \rangle}$ | `rmsDisplacement1d` | none | pending | 559 |
| `bm-s5-poise-water-viscosity` | §5 | $1.35 \times 10^{-2}$ | $1.35 \times 10^{-3}\text{ Pa}\cdot\text{s}$ | `viscosity` (unitConversion) | none | pending | 559 |
| `bm-s5-mikron-unit` | §5 | $\text{Mikron}$ | $10^{-6}\text{ m}$ | role: unit (unitConversion) | none | pending | 559 |
| `bm-s5-sek-unit` | §5 | $\text{Sek.}$ | $\text{s}$ | role: unit (rename) | none | pending | 559 |
