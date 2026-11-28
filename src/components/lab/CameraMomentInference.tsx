import type { MomentAnalysis } from "../../experiments/bm07/trajectoryMoments.ts";
import { display } from "./presentation.ts";

export function CameraMomentInference({ analysis }: { analysis: MomentAnalysis }) {
  const request = analysis.assumptions;
  return (
    <section
      aria-label="Inference from adjacent camera displacements"
      data-analysis-model="camera-lag-one"
    >
      <h4>What changes when you measure neighboring displacements?</h4>
      <p>
        Selected coordinate {request.axis}. Independently declared drift{" "}
        {display(request.knownDriftMPerS)} m/s. Uniform exposure {display(request.exposureSeconds)}{" "}
        s. Each track has its own estimate.
      </p>
      <p>{analysis.message}</p>
      {analysis.tracks.map((track) => (
        <section key={track.track} aria-label={`Track ${track.track}`}>
          <h5>Track {track.track}</h5>
          {track.kind === "unavailable" ? (
            <p>{track.reason}</p>
          ) : (
            <>
              <p>
                {track.increments} displacements at {display(track.dt ?? 0)} s spacing give{" "}
                {track.neighboringPairs} adjacent pairs. The calculation subtracts the displacement
                predicted by the supplied drift.
              </p>
              <dl>
                <dt>One-step displacement variance</dt>
                <dd>{display(track.variance)} m²</dd>
                <dt>Lag-one displacement covariance</dt>
                <dd>{display(track.covariance)} m²</dd>
              </dl>
              {track.spreadAlone && (
                <p>
                  The variance alone allows diffusion from zero to{" "}
                  {display(track.spreadAlone.maximumDiffusion)} m²/s. The matching localization
                  variance falls from {display(track.spreadAlone.maximumNoiseVariance)} m² to zero.
                </p>
              )}
              <dl>
                <dt>Diffusion estimated with covariance</dt>
                <dd>{display(track.D)} m²/s</dd>
                <dt>Estimated localization variance</dt>
                <dd>{display(track.sigma2)} m²</dd>
              </dl>
              {track.status === "outside-physical-range" && (
                <p className="notice">
                  A fitted value is negative. Finite records can put the two sample moments outside
                  the physical range. The signed result is retained so you can inspect sampling
                  variation and the model assumptions.
                </p>
              )}
              {track.status === "no-spread" && (
                <p>
                  No displacement spread is resolved after subtracting the declared drift. Check
                  spatial resolution before interpreting these zeros.
                </p>
              )}
            </>
          )}
        </section>
      ))}
      <details>
        <summary>How the two measurements constrain the answer</summary>
        <p>
          An error in a shared position enters one displacement with a plus sign and the next with a
          minus sign. Localization error therefore contributes negative covariance. Averaging each
          position over its exposure contributes positive covariance. Adding twice the lag-one
          covariance to the displacement variance cancels both terms. Dividing that sum by twice the
          sampling interval estimates diffusion. The remaining moment, with the exposure duration,
          estimates localization variance.
        </p>
        <p>
          Fitting the drift from these same displacements changes the finite-sample covariance. This
          calculation uses the independent drift you supplied.
        </p>
      </details>
    </section>
  );
}
