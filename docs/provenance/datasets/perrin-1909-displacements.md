# Perrin 1909 displacement table: revision 1

## Source and acquisition

Jean Perrin, *Mouvement brownien et réalité moléculaire*, Annales de chimie et de physique,
eighth series, volume 18 (September 1909), pp. 5–114. The dataset uses the unnumbered
“Première série” table on printed p. 77 and the measurement definition on p. 76.
This is the long memoir, not the separate Le Radium article.

- Bibliography record: `cit-perrin-1909-realite-moleculaire`.
- BnF catalogue: https://gallica.bnf.fr/ark:/12148/bpt6k349481
- PDF acquired 2026-11-11 from the university-hosted copy:
  https://liphy-annuaire.univ-grenoble-alpes.fr/pages_personnelles/bahram_houchmandzadeh/Phys_Stat/Biblio/Perrin_1909_brownian.pdf
- SHA-256: `dcb815eec9365f6eed7ca14b23ad496f6853bf21c080ef1197588d1b4a97d544`.
- Size: 3,613,869 bytes. Page count: 115.
- PDF metadata identifies Bibliothèque nationale de France as creator.
- Printed p. 76 is PDF page 74; printed p. 77 is PDF page 75.

The Gallica endpoint returned HTTP 403. The publicly accessible university copy supplied the
facsimile without bypassing access controls. It was rendered with `pdftoppm`; neither OCR nor
the PDF's embedded text layer was used. The first-series table was visually inspected at
300 dpi after reading the surrounding pages. No human review is claimed.

The dataset's `sourcePageImage` points to the exact PDF page of that facsimile. Local rendered
images existed during inspection, but the execution environment became unavailable before
they could be preserved in the repository. The source URL, PDF digest and page map above
identify the evidence; no local-image availability is claimed.

## What was read

Perrin attributes the measurements to M. Chaudesaigues. Page 77 says the series follows fifty
gamboge grains, each of radius 0.212 micrometre, every thirty seconds for two minutes. For the
first series it states water at 17 °C and viscosity 0.011 in centimetre-gram-second units,
equivalent to 0.0011 Pa·s. The second series has viscosity 0.012 and is excluded from this
record because its temperature is not stated alongside it.

Page 76 defines the one-axis mean square by measuring the horizontal segments, squaring
their lengths, averaging those squares and taking half the average. The table's mean-square
column is therefore an observed aggregate. The molecular numbers in the next column are
inferred quantities and were not used to reconstruct it.

| Elapsed time (s) | Printed mean-square token | Mean square (µm²) | Stored value (m²) |
|---:|:---|---:|---:|
| 30 | 50,2 | 50.2 | 5.02e-11 |
| 60 | 113,5 | 113.5 | 1.135e-10 |
| 90 | 128 | 128 | 1.28e-10 |
| 120 | 144 | 144 | 1.44e-10 |

The column heading prints “ξ² · 10⁻⁸”. Its numerical entries use the 10⁻⁸ cm² scale,
equal to 1 µm² or 10⁻¹² m², consistent with the adjacent mean horizontal displacements
of 8.9, 13.4, 14.2 and 15.2 µm and the definition on p. 76. The negative exponent is
a scale label here, not an instruction to multiply a square-centimetre value by 10⁻⁸.
The SI conversion changes units only. The four rows share the same grains and observation
record; they are not independent repeated experiments.

## Precision and scope

The decimal entries support a half-last-place transcription allowance of 0.05 µm², and
the integer entries 0.5 µm². The dataset stores the larger allowance in SI units and explains
the distinction. This is printed rounding precision, not a measurement confidence interval.
Perrin does not supply separate uncertainty bars for these rows. Pages 78–79 discuss finite
sampling and how position-reading error increases the measured mean square.

The comparison calls the existing audited `diffusion.moments` owner with the diffusivity
from BM-01's accepted snapshot. It does not reconstruct the measurements, fit a slope, or infer
a molecular constant. Its source preset uses the printed physical conditions with modern SI
constants. A visible mismatch notice remains when the current instrument settings differ.

BM-07 also admits `estimateSummaryStatistics` for an explicitly limited interpretation of each
one-axis mean square: the reference owner divides it by twice its own observation interval to
produce an apparent diffusivity. The four rows remain separate. This calculation assumes zero
drift and does not correct position-reading error. It uses no radius, temperature, viscosity,
gas constant or molecular number. The owner receives `independentCoordinateCount: null` for
every row; its interval path consequently reports that no chi-square interval is applicable.
The printed number of grains does not establish the required independent-coordinate count.
No raw-increment model, interval procedure or molecular inversion is admitted by this change;
the calibration list remains empty. The observation data and digitization revision are unchanged.

## Source terms

Source gallica.bnf.fr / Bibliothèque nationale de France.

The 1909 text is in the public domain. No PDF or page image is redistributed by this change.
Gallica describes noncommercial reuse with source attribution at:
https://gallica.bnf.fr/accueil/fr/html/conditions-dutilisation-de-gallica
(accessed 2026-11-11). The rights record retains `source-terms`; it does not apply a new
permissive licence to the scan.

## Revision history

- Revision 1, 2026-11-11, agent:ChatGPT-product-priorities: visual transcription and unit
  conversion of the four first-series observations; explicit source conditions, uncertainty
  limits and page-image locator. No claim of completed human verification.
