# Dissertation product reconstruction and the 1911 correction

This receipt covers the numerical exercise in
`src/discovery/connections/dissertationHistorical.ts`. It does not certify a complete
transcription, translation, or independent reconstruction of every experimental input.

## Primary sources and inspection

The original German text is public domain. These are the repository's existing, pinned,
open-terms facsimiles; their acquisition and scan-rights records remain in the paper receipts.

| Source | Pinned file | SHA-256 | Pages used |
|---|---|---|---|
| Einstein, *Eine neue Bestimmung der Moleküldimensionen*, Ann. Phys. (4) 19 (1906), 289-306 | `public/papers/pdfs/ap-19-289.pdf` | `41cc49db4c4e232dba7a3f3d2339f866c46652f34ace3f354e712b5e338a1cf3` | Printed 301, 304-306; PDF 13, 16-18 |
| Einstein, *Berichtigung zu meiner Arbeit*, Ann. Phys. (4) 34 (1911), 591-592 | `public/papers/pdfs/ap-34-591.pdf` | `9fc1fa2fecc9ecab14204f1c1cd8bdb498c5d6041b083396a6a3eef602539798` | Printed 592; PDF 2 |

The numerical readings below were checked visually against rendered page images by
GPT-6 Astra Pro (AI agent) on 2026-11-14. No OCR or embedded PDF text layer was used.
No human review is claimed. The source links on the exercise open these exact pinned PDFs
at the relevant pages.

## The three historical stages

1. **The April 1905 calculation, printed in 1906.** Page 304 gives the two relations
   `NP³ = (3/4π)(m/ρ)(k*/k - 1)` and `NP = RT/(6πkD)`. Page 305 prints the inferred
   products `NP³ = 200` in the paper's CGS convention, and `NP = 2.08 × 10^16`.
   Their SI values are `200 × 10^-6 m³/mol` and `2.08 × 10^14 m/mol`.
   The same page prints the resulting radius `P = 9.9 × 10^-8 cm` and number
   `N = 2.1 × 10^23`. Inverting the two rounded products gives approximately
   `P = 9.806 × 10^-8 cm` and `N = 2.121 × 10^23`; the exercise keeps the calculated
   and printed values separate. It does not invent extra precision in the source.
2. **The January 1906 supplement.** The supplement starts on page 305 and continues
   on page 306. It replaces the observations: Thovert's diffusion value is
   `0.33 cm²/day` at `18.5 °C` and `0.005 mol/litre`; Hosking's interpolated viscosity
   increment is `0.00025` in the paper's CGS viscosity units for a one-percent increase
   in sugar content at that temperature. The printed results are
   `P = 0.78 × 10^-6 mm` and `N = 4.15 × 10^23`. These are printed outputs, not
   independent raw observations. The exercise does not fit omitted solvent constants
   to recover them. In particular, the viscosity increment is not a dimensionless
   specific viscosity.
3. **The January 1911 correction.** Page 592 replaces `k* = k(1 + φ)` by
   `k* = k(1 + 2.5φ)`. It explicitly replaces the supplement's `N = 4.15 × 10^23`
   with `6.56 × 10^23`. Keeping the observations fixed leaves `NP` unchanged and
   divides `NP³` by 2.5, so `P` is divided by `sqrt(2.5)` and `N` multiplied by it.
   Applying this to the supplement gives `N ≈ 6.5617 × 10^23`. The corresponding
   `P ≈ 4.9332 × 10^-8 cm` is calculated here; the correction does not print a radius.

## A corrected receipt reading

The existing `ap-19-289` watch list had described the supplement's radius as
`4.9 × 10^-8 cm`. The pinned page 306 prints **`0.78 × 10^-6 mm`**, equivalent to
`7.8 × 10^-8 cm`. The earlier value belongs to the subsequent coefficient correction,
not to the supplement. The watch-list text is corrected while retaining its pending status.

## What the exercise computes

The molecular-dimensions reference owner solves the independent-product equations
`Na = A` and `bNa³ = C`, with `a² = C/(bA)`, and then `N = A/a`.
The direct observation inverse and the printed-product inverse share the numerical solve.
No modern Avogadro constant, Boltzmann constant, or undocumented gas constant is supplied.

The supplement comparison is explicitly a **coefficient-only correction of a printed
result**, not another determination from raw data. Correcting the original calculation
without replacing its observations gives about `3.35 × 10^23`, not `6.56 × 10^23`.
The separate effect of the new observations is therefore visible.

No confidence interval is assigned to these historical values. The main text combines
viscosity information at 20 °C with diffusion information at 9.5 °C and explicitly
neglects the change in radius; it also warns that the diffusion observations came from
ten-percent solutions where exact validity is not expected. Rounded printed products,
experimental errors, and model discrepancy cannot be represented by a fabricated
statistical interval. Checker tolerances cover the stated numerical rounding only.
