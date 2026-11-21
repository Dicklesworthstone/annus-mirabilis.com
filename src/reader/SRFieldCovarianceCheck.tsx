"use client";

import { useEffect, useState } from "react";
import type { SRFieldCovarianceReport } from "../equations/derivations/srFieldCovariance.ts";

/** Only dependency selection runs here; the server supplies the exact algebra check. */
export function SRFieldCovarianceCheck({ report }: { readonly report: SRFieldCovarianceReport }) {
  const [curls, setCurls] = useState(true);
  const [electric, setElectric] = useState(true);
  const [magnetic, setMagnetic] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const rows = report.rows.map((row) => ({
    ...row,
    established:
      curls &&
      (row.divergence === "electric" ? electric : row.divergence === "magnetic" ? magnetic : true),
  }));
  return (
    <section
      id="sr-field-covariance-check"
      aria-labelledby="sr-field-covariance-check-title"
      data-field-covariance={report.passed ? "checked" : "unavailable"}
    >
      <h5 id="sr-field-covariance-check-title">Check what the six equations actually require</h5>
      {report.passed ? (
        <>
          <p>
            All six changes of variables and all six residual identities below have an exact
            algebraic check. Each field value and each of its first derivatives is allowed to vary
            independently. The check expands the derivatives and uses β²(1 − v²/V²) = 1; it holds
            for every constant boost with V &gt; 0 and |v| &lt; V. The coordinate map from §3 is a
            premise of this check.
          </p>
          <p>
            An identity between residuals also tells us which premises make a transformed equation
            vanish. Change those premises to see which conclusions remain established for a general
            field and boost.
          </p>
          <fieldset disabled={!hydrated}>
            <legend>Premises used to infer the transformed equations</legend>
            <div>
              <label htmlFor="sr-field-curl-premise">
                <input
                  id="sr-field-curl-premise"
                  type="checkbox"
                  checked={curls}
                  onChange={(event) => setCurls(event.currentTarget.checked)}
                />
                The original six Maxwell–Hertz curl equations hold
              </label>
            </div>
            <div>
              <label htmlFor="sr-field-electric-premise">
                <input
                  id="sr-field-electric-premise"
                  type="checkbox"
                  checked={electric}
                  onChange={(event) => setElectric(event.currentTarget.checked)}
                />
                Electric divergence is zero in the charge-free region
              </label>
            </div>
            <div>
              <label htmlFor="sr-field-magnetic-premise">
                <input
                  id="sr-field-magnetic-premise"
                  type="checkbox"
                  checked={magnetic}
                  onChange={(event) => setMagnetic(event.currentTarget.checked)}
                />
                Magnetic divergence is zero
              </label>
            </div>
          </fieldset>
          <noscript>
            <p>
              All three premises are selected in this reading. Changing the premises and updating
              the conclusions requires JavaScript; the exact identities remain available below.
            </p>
          </noscript>
          <p role="status">
            {rows.filter((row) => row.established).length} of 6 transformed equations follow from
            the selected premises.
          </p>
          <table>
            <caption>Which transformed equations follow?</caption>
            <thead>
              <tr>
                <th scope="col">Component</th>
                <th scope="col">Consequence of the selected premises</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.component}
                  data-covariance-component={row.component}
                  data-established={row.established}
                >
                  <th scope="row">
                    <a href={`#sr-field-component-${row.component.toLowerCase()}`}>
                      {row.component}
                    </a>
                  </th>
                  <td>
                    {row.established
                      ? "Established"
                      : !curls
                        ? "Requires the original curl equation"
                        : row.divergence === "electric"
                          ? "Requires zero electric divergence"
                          : "Requires zero magnetic divergence"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <details>
            <summary>Why the two parallel components need an extra premise</summary>
            <p>
              For X, the transformed residual is β times the original X residual plus β(v/V) times
              the electric divergence. For L, the same statement uses magnetic divergence. Each of
              the other four transformed residuals equals its original residual. These identities
              remain checked when a premise is deselected; the general conclusion that a residual
              vanishes is what changes.
            </p>
            <p>
              For example, take a static electric field X = ax with every other component zero. All
              six original curl equations hold, but the electric divergence is a. The transformed X
              residual is β(v/V)a, which can be nonzero. A zero boost or a field with vanishing
              divergence is a special case; the selected premises above must cover general fields.
            </p>
          </details>
          <p>
            Applying the candidate field transformation and then reversing v also recovers all six
            original components exactly. The physical identification of those candidates with
            measured fields and the normalization of their common factor ψ still require the
            additional premises discussed in step 3.
          </p>
        </>
      ) : (
        <p>
          The exact field-identity check is unavailable. The authored equations and their
          assumptions remain available below; this page does not claim a checked covariance result.
        </p>
      )}
    </section>
  );
}
