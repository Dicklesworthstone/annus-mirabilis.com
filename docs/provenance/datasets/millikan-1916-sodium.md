# Provenance: Millikan 1916, sodium, Fig. 6 (dataset `millikan-1916-sodium`)

Receipt for the scan read to restore the Millikan 1916 sodium record withdrawn on 2026-09-24
(am-data-millikan-1916-zh2q; dispatch 249). Written by agent:GreenOx on 2026-09-26. This file is a
dataset receipt, not a facsimile receipt: it lives in `docs/provenance/datasets/`, which the facsimile
receipt loader (`src/content/provenance/loadReceipts.ts`, top level only) does not read.

## Source

- **Article:** R. A. Millikan, "A Direct Photoelectric Determination of Planck's 'h'," *Physical Review*,
  Second Series, Vol. VII, No. 3 (March 1916), pp. 355-388. DOI 10.1103/PhysRev.7.355.
- **Rights of the text:** published in the United States in 1916; public domain in the United States.

## Scan

| Field | Value |
|---|---|
| Host | Internet Archive, item `sim_physical-review_1916-03_7_3` ("The Physical Review 1916-03: Vol 7 Iss 3"), collections `pub_physical-review`, `sim_microfilm`, `periodicals`; source `IA1630503-06`, microfilm |
| Origin URL | `https://archive.org/download/sim_physical-review_1916-03_7_3/sim_physical-review_1916-03_7_3.pdf` |
| Final URL | `https://dn760104.eu.archive.org/0/items/sim_physical-review_1916-03_7_3/sim_physical-review_1916-03_7_3.pdf` |
| Retrieved | 2026-09-26T03:51:49Z, curl with the site's user agent |
| Bytes | 34,237,530 |
| SHA-256 | `162bab3b468db6220ec0fa4cd4332c728f436485a14f13b0d93d94275fdec5da` |
| Host checksums | MD5 `a4d07e99edb563d4cba52f94e2584951` and SHA-1 `ac37d4674104236ff0ca17528f033f010ee4e12e`, both equal to the values Internet Archive publishes for the file (`/metadata/…/files`, file source `derivative`) |
| Pages | 140 (the whole of issue 3) |
| Access | not access-restricted; the file is public |
| Stated terms | the item carries no `rights` or `licenseurl` field. Terms: Internet Archive Terms of Service, `https://archive.org/about/terms.php` (redirects to `/about/terms`), retrieved 2026-09-26; the page is rendered in the browser, so its text is not retrievable with curl. This is the basis on which the pinned Annalen facsimiles, taken from the same Serials-in-Microfilm collection, were recorded as `scan-open-terms` (see `docs/provenance/ap-17-132.md`, `scan.termsStatements`). |
| Not used | HathiTrust answered curl with a Cloudflare challenge (HTTP 403) on 2026-09-26 and was not used. |
| Committed | page images only (below); the PDF is not committed. Its embedded text layer was never read. |

## Page map of the article (PDF page of the scan to printed page)

Read by eye from printed page numbers on 40 dpi contact sheets rendered with `pdftoppm`.

| PDF pages | Printed pages | Notes |
|---|---|---|
| 71-76 | 355-360 | the article opens on p. 355 (PDF 71) |
| 77 | none | blank |
| 78 | none | Plate I (Fig. 1) |
| 79-82 | 361-364 | |
| 83 | none | Plate II (Fig. 3) |
| 84 | none | blank |
| 85-108 | 365-388 | the article ends on p. 388 (PDF 108); p. 389 opens G. L. Wendt |

## What the article prints for sodium

Read visually from 300 dpi `pdftoppm` renders. **There is no Table IV.** The article has Tables I-III:

- **Table I, p. 372:** potentiometer readings (volts) and galvanometer deflections (mm) for the lines
  headed 5,461, 4,339, 4,047, 3,650, 3,126 and 2,535: the photocurrent curves of Fig. 5, not stopping
  potentials.
- **Fig. 6, p. 373:** "The result of plotting the intercepts on the potential axis against the
  frequencies" (p. 372): six circled points, frequency (abscissa, "40×10¹³" to "120") against volts
  ("+ Volts" above 0, "− Volts" below), the fitted line, and an inset working the slope:
  dV/dν = 3/((121.00 − 48.23)×10¹³) = 4.124×10⁻¹⁵, and h = (4.774×10⁻¹⁰ / 300) × 4.124×10⁻¹⁵ = 6.56×10⁻²⁷.
  A dashed line near the origin is marked "ν₀ = 43.9 × 10¹³".
- **p. 372:** "the maximum possible error in locating any of the intercepts is say two hundredths of a
  volt"; every curve save that of λ = 2,535 strikes the potential axis on the side of negative volts
  (e times the contact P.D. acts as a retarding potential).
- **p. 374:** the slope "was fixed primarily by a consideration of the five points corresponding to
  lines 5,461, 4,339, 4,047, 3,651 and 3,125"; "no potential departs from the line by more than .01
  volt"; slope 4.124 × 10⁻¹⁵; with e = 4.774 × 10⁻¹⁰, h = 6.56 × 10⁻²⁷.
- **Table II, p. 375:** nine slopes, each against 5,461, mean 4.131 × 10⁻¹⁵; the text takes 4.128 × 10⁻¹⁵,
  the mean of 4.124 and 4.131, and h = 6.569 × 10⁻²⁷ erg sec.
- **Table III, p. 375:** lithium, not sodium.
- **p. 382:** line 2,535 "corresponds to ν = 118.2 × 10¹³"; "With line 2,535 Fig. 5 shows that the
  observed V₀ for sodium was .52 volt".
- **p. 383:** "measured contact E.M.F. at this time was 2.51 volts (see p. 382 and Fig. 6)".

So the sodium points appear only as plotted points on Fig. 6, and only the 2,535 point also has a
printed value. The plotted quantity is the intercept on the potential axis: signed and uncorrected
for the contact E.M.F. It is not a stopping-potential magnitude.

**Wavelengths as printed.** Table I heads its columns 5,461, 4,339, 4,047, 3,650, 3,126 and 2,535 (Å).
The text prints the fifth line as 3,125 (pp. 372, 374, 382) and once as 3,120 (p. 375), and the
fourth once as 3,651 (p. 374). The record keeps Table I's spellings and notes the others.

## Digitization of Fig. 6

- **Digitizer:** agent:GreenOx (Claude Opus 5.5), 2026-09-26. An agent's reading, not a human review.
- **Image:** p. 373 rendered at 600 dpi with `pdftoppm`, turned upright (90° clockwise), cropped to the
  figure and its labels: `public/figures/datasets/millikan-1916-sodium/p373-fig6-600dpi.webp`
  (lossless WebP, 4250 × 2250 px; the crop begins at (1150, 1000) of the upright page render).
  Coordinates below are pixels of that committed image.
- **Calibration, from the printed labels:** the ruled lines were located as darkness peaks across the
  plot (vertical spacing 21.31 px, horizontal 21.19 px). The frequency labels 50, 70, 80, 90, 100, 110
  and 120 each sit on a ruled line, exactly 20 lines per 10 units, so each ruled line is 0.5 × 10¹³ Hz.
  The label 50 is centred at x = 932.5. The volt labels 0, 1 and 2 are centred at y = 555.5, 1191.5
  and 1820.0, 30 ruled lines per volt, so each line is 1/30 V. Zero is the heavy axis line at y = 558,
  and "− Volts" lies below it. Checks: the "1" and "2" label centres read −0.994 V and −1.985 V. Each
  reading is interpolated between the two detected ruled lines nearest it, so a lattice that drifts
  across the sheet (up to 10 px against the labels at 120) does not drift the reading.
- **Point centres,** located by eye on zoomed crops, each confirmed with a crosshair drawn at the
  chosen centre. A ring-template search was tried first and rejected: the ruled lines and the drawn line
  pulled it 15-40 px off the circles. Reading uncertainty is ±4 px, which is ±0.10 × 10¹³ Hz and
  ±0.007 V:

| Line (Table I) | Centre (x, y) | ν read (10¹³ Hz) | c/λ, c = 3×10¹⁰ | V read (volts, signed) |
|---|---|---|---|---|
| 5,461 | (1133, 1863) | 54.74 | 54.94 | −2.050 |
| 4,339 | (1753, 1508) | 69.25 | 69.14 | −1.492 |
| 4,047 | (1961, 1388) | 74.12 | 74.13 | −1.300 |
| 3,650 | (2302, 1145) | 82.12 | 82.19 | −0.919 |
| 3,126 | (2897, 803) | 96.14 | 95.97 | −0.380 |
| 2,535 | (3834, 231) | 118.17 | 118.34 | +0.517 |

- **Checks against the printed values:** the 2,535 point reads ν = 118.17 × 10¹³ and V = +0.517 V, where
  p. 382 prints 118.2 × 10¹³ and .52 volt. Every read frequency agrees with c/λ to within 0.20 × 10¹³
  (0.36 percent), the reading resolution. The withdrawn record's 312.6 nm row was off by 2.72 percent.
  A least-squares line through the five points Millikan names (all but 2,535), on c/λ frequencies, has
  slope 4.103 × 10⁻¹⁵ V s, 0.51 percent below his printed 4.124 × 10⁻¹⁵. Its residuals are +0.013,
  −0.012, −0.025, +0.025 and −0.001 V, and the 2,535 point lies 0.022 V below it. On the read
  frequencies the slope is 4.075 × 10⁻¹⁵ V s and the largest residual 0.030 V. The scatter is larger
  than his ".01 volt" and than this reading's ±0.007 V, and it is what the printed figure gives. No
  point was adjusted toward the line.
- **Not a data point:** a solid, uncircled dot at (2828, 729) reads ν = 94.50 × 10¹³, V = −0.263 V,
  0.12 V above the line. It is not one of the six circled points and is left out.

## History

- Revision 1 (2026-09-16, digitizer "Editorial Team") was withdrawn on 2026-09-24 (TanElk, dispatch 135;
  TopazPrairie). Its six rows could not be traced to the printed page, and its cited page image
  `millikan-1916-p373.png` never existed. Its values were positive "stopping potentials" (0.475-3.092 V)
  attributed to a Table IV that the article does not have.
- Revision 2 is this digitization of Fig. 6, from the scan above.
