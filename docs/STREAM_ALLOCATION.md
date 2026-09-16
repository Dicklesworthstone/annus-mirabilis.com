# Logical Stream Allocation and Kernel Identity Registry

Specification: `am-rt-u64-identities-7ce`  
Mirroring upstream specification: `docs/FRANKENSIM_BINDING.md` §6 (decision c).

---

## 1. Governing Principles

1. **Kernel ID Table Mirroring:** The kernel ID table below mirrors decision (c) of `docs/FRANKENSIM_BINDING.md` byte-for-byte. All production streams use kernel IDs in `0x19050000..0x19050fff`. All test fixtures use reserved IDs in `0x1905f000..0x1905ffff`. Unallocated slots in `0x19051000..0x1905efff` are strictly refused.
2. **Draw Counting vs Step Counting:** Stream index always counts **draws**, never steps. A Gaussian step that consumes two variates (via Box–Muller) advances the stream index by 2. A uniform or coin step advances the stream index by 1.
3. **Distinct Draw Patterns Require Distinct Allocations:** Two allocations may share a stream kernel ID only when their tile formulas differ. No two registered allocations may share both a stream kernel ID and a tile formula. A mode drawing a different set of variates per particle per step must register its own allocation rather than reusing an existing tile scheme.
4. **Display Subsampling and UI Toggles:** Changing observation cadence, adding a plot, switching 2D/3D views, or adjusting camera controls consumes **zero** draws from latent streams.
5. **No Ambient Entropy in Scientific Paths:** Scientific draws use the recorded logical seed. Ambient entropy (`crypto.getRandomValues`) is used only when explicitly initiating a "new trial", and that seed is recorded canonically. "Same seed" replays identically. `Math.random` is never used.
6. **Tile Bijection & Bounds:** Tile formulas must map parameters injectively into `u32` (`0..4294967295`). Declared limits enforce that neither tiles nor draw indices wrap or overflow $2^{64}$.

---

## 2. Machine-Readable Table

```kernel-id-table
schema=am.kernel-id-table.v1
pin=5bbbfae6f7de614422f6f97f5798a3e00f8ad813
streamSemanticsVersion=1
unallocatedGap=0x19051000..0x1905efff

BEGIN block=production
RANGE 0x19050000 0x19050fff

ROW id=0x19050001 idDec=419430401 name=brownian-latent status=active indexRule=draws consumers=bm-01,bm-05,bm-08 allocationIds=bm-01.latent.v1,bm-05.walk.v1,bm-08.latent.v1 tileFormula=bm-01.latent.v1:tile=3*i+axis;bm-05.walk.v1:tile=j;bm-08.latent.v1:tile=(i<<2)|channel notes=channel0=increment,channel1=bridge;BM-01 axis 0=x,1=y,2=z;shared kernel because all three call brownian_frames or the same latent Gaussian path;allocations distinct by tile formula

ROW id=0x19050002 idDec=419430402 name=brownian-localization-noise status=active indexRule=draws consumers=bm-08 allocationIds=bm-08.localization.v1 tileFormula=tile=particle notes=independent epsilon_i per measured position;tile is particle index;not the latent path

ROW id=0x19050003 idDec=419430403 name=synthetic-inference-latent status=active indexRule=draws consumers=bm-07 allocationIds=bm-07.synthetic-latent.v1 tileFormula=tile=(p<<16)|s notes=p=particle,s=substep,s<65536;synthetic inverse exercise latent path;never mixed with measurement-error draws

ROW id=0x19050004 idDec=419430404 name=synthetic-inference-noise status=active indexRule=draws consumers=bm-07 allocationIds=bm-07.synthetic-noise.v1 tileFormula=tile=(p<<16)|s notes=p=particle,s=substep,s<65536;same tile formula as latent is legal because the kernel id differs

ROW id=0x19050005 idDec=419430405 name=lq-05-configuration status=active indexRule=draws consumers=lq-05 allocationIds=lq-05.configuration.v1,lq-05.locked.v1 tileFormula=lq-05.configuration.v1:tile=trial;lq-05.locked.v1:tile=trial|0x80000000 notes=independent point placement vs locked-positions counterexample;changing view or rendering subset consumes zero draws;locked uses the high bit so the tile formula is not tile=trial

ROW id=0x19050006 idDec=419430406 name=exercise-sample-points status=active indexRule=draws consumers=am-disc-exercise-checker-i4h2 allocationIds=exercise.sample-points.v1 tileFormula=tile=v notes=v=zero-based variable index in the part declared variable order;seed=first64(SHA-256(exerciseId/partIndex));candidate j takes index j;ceiling 64 draws;PRODUCTION because the checker ships in the site

ROW id=0x19050007 idDec=419430407 name=synthetic-inference-generator-parameter status=active indexRule=draws consumers=bm-07 allocationIds=bm-07.generator-parameter.v1 tileFormula=tile=0 notes=hidden molecular number drawn log-uniform once per seed;not a particle stream;allocated so BM-07 does not borrow latent or noise

ROW id=0x19050008 idDec=419430408 name=brownian-stationary-feature status=active indexRule=draws consumers=bm-08 allocationIds=bm-08.stationary-feature.v1 tileFormula=tile=clickIndex notes=repeated clicks on a stationary feature for sigma-hat;BM-08 names this as the third stream beside latent and localization

END block=production

BEGIN block=test-fixture
RANGE 0x1905f000 0x1905ffff

ROW id=0x1905f000 idDec=419495936 name=statistical-policy-seeded status=active indexRule=draws consumers=am-ver-statistical-policy-grj allocationIds=statistical-policy.seeded.v1 tileFormula=tile=suiteSalt notes=seeded statistical assertions;suiteSalt is allocation-defined by the policy helper;production allocations never use this id

ROW id=0x1905f001 idDec=419495937 name=runtime-fixture status=active indexRule=draws consumers=src/testing allocationIds=runtime-fixture.v1 tileFormula=tile=allocation-defined notes=runtime fixture experiments under src/testing/;owners take further ids from unused slots in this block, never from production

ROW id=0x1905f002 idDec=419495938 name=exercise-property-test status=active indexRule=draws consumers=am-disc-exercise-checker-i4h2/property.test.ts allocationIds=exercise.property-test.v1 tileFormula=tile=v notes=property-test generator only;not the shipped checker;must not be confused with 0x19050006

END block=test-fixture
```

---

## 3. Registered Allocations

| allocationId | stream kernel id | tile formula | draws per scientific step | declared maxima |
|---|---|---|---|---|
| `bm-01.latent.v1` | `0x19050001` | `tile = 3*i + axis` (axis 0,1,2 = x,y,z) | 2 per Gaussian step (step kernel 3) | $M \le 10\,000$ tracers (largest tile 29999); at most $2H/h$ draws per stream |
| `bm-05.walk.v1` | `0x19050001` | `tile = j` for walker j | 1 per coin or uniform step; 2 per Gaussian step | $W \le 10\,000$; $N_{\text{run}} \le 10\,000$; at most $2\times 10^4$ draws per stream |
| `bm-08.latent.v1` | `0x19050001` | `tile = (i << 2) \| channel` (0 = increment, 1 = Brownian-bridge $\xi$) | 2 per Gaussian increment plus 2 per bridge variate | same tracer cap as BM-01; formula differs from `3*i+axis` and from `j` |
| `bm-08.localization.v1` | `0x19050002` | `tile = particle` | 2 per localization normal | particle index within BM-08's work budget |
| `bm-08.stationary-feature.v1` | `0x19050008` | `tile = clickIndex` | 2 per click normal | $n_s$ within BM-08's declared click cap |
| `bm-07.synthetic-latent.v1` | `0x19050003` | `tile = (p << 16) \| s` | 2 per Gaussian substep | $p < 65536, s < 65536$ |
| `bm-07.synthetic-noise.v1` | `0x19050004` | `tile = (p << 16) \| s` | 2 per noise normal | $p < 65536, s < 65536$ |
| `bm-07.generator-parameter.v1` | `0x19050007` | `tile = 0` | draws for one log-uniform hidden N per seed | 1 stream per run |
| `lq-05.configuration.v1` | `0x19050005` | `tile = trial` | draws per independent point (2 uniforms for a 2-D placement) | trials $\le 10^6$ (LQ-05 numeric domain) |
| `lq-05.locked.v1` | `0x19050005` | `tile = trial \| 0x80000000` | 1 shared uniform for all n points | same trial cap; high bit keeps the formula distinct from `tile = trial` |
| `exercise.sample-points.v1` | `0x19050006` | `tile = v` | 1 draw per candidate | 64 draws; 256 variables |
| `statistical-policy.seeded.v1` | `0x1905f000` | `tile = suiteSalt` | as the policy helper declares | reserved block only |
| `runtime-fixture.v1` | `0x1905f001` | allocation-defined | as the fixture declares | reserved block only |
| `exercise.property-test.v1` | `0x1905f002` | `tile = v` | as the property test declares | reserved block only |

---

## 4. Expected Later Allocations

The following entries are documented as expected later allocations. They are not currently registered as active allocations in the runtime registry. When their owning bead lands, each must register its own unique `allocationId` and satisfy the stream allocation invariants.

- **`bm-01:underdamped`**
  - **Owner bead:** `am-later-deep-underdamped-ide4`
  - **Mode ID:** `bm-01:underdamped`
  - **Reason:** Samples an Ornstein–Uhlenbeck position-and-velocity pair per particle per coordinate with an exact discretization; draw pattern differs from bm-01.latent.v1 single Gaussian position step per axis.
  - **Invariant:** Must register its own `allocationId` with its own tile formula, its own draws-per-step count under the draw-counting rule, and its own declared maxima, and must never reuse BM-01's `tile = 3*i + axis` scheme.
