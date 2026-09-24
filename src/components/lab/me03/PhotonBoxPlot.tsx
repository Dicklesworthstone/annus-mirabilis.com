import type { Me03Parameters } from "../../../experiments/me03/definition.ts";
import type { PhotonInBoxResult } from "../../../experiments/me03/session.ts";
import type { RepresentationScale } from "../../../visuals/kit/types.ts";
import "./me03.css";
import { Sci, SciSvg } from "../Sci.tsx";

export interface PhotonBoxPlotProps {
  parameters: Me03Parameters;
  evaluation: PhotonInBoxResult;
  scale: RepresentationScale;
  clipId: string;
}

export function PhotonBoxPlot({ parameters, evaluation, scale, clipId }: PhotonBoxPlotProps) {
  const { boxMass, boxLength, pulseEnergy, assignLightMass, magnification } = parameters;
  const isZero = evaluation.exactRationalCenterOfMassShift.isExactlyZero;

  const width = 640;
  const height = 280;

  // Visual displacement calculation (amplified by magnification for display)
  // Baseline physical displacement is -1.112650056e-17 m for canonical inputs
  const physicalDisplacement = evaluation.displacement;
  // Scaled pixel offset for visualization (clamped for visual stability)
  const drawnShiftPx = Math.max(-80, Math.min(80, physicalDisplacement * magnification * 2e-15));

  return (
    <div
      className="photon-box-visual-wrap"
      data-view-id="me-03-photon-box"
      data-testid="photon-box-plot"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="photon-box-canvas"
        role="img"
        aria-label={`1906 photon-in-a-box thought experiment: M=${boxMass}kg, l=${boxLength}m, E=${pulseEnergy}J, assignLightMass=${assignLightMass}`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="10" y="10" width={width - 20} height={height - 20} rx="6" />
          </clipPath>
        </defs>

        {/* Title and Badges */}
        <text x="25" y="32" fontSize="13" fontWeight="bold" fill="currentColor">
          1906 Photon-in-a-Box Thought Experiment
        </text>
        <text x="25" y="48" fontSize="11" fill="var(--muted)">
          Poincaré (1900) recoil paradox · Einstein (1906) radiation inertia demonstration
        </text>

        {/* Center of Mass Origin Marker */}
        <line
          x1={width / 2}
          y1={65}
          x2={width / 2}
          y2={195}
          stroke="var(--line)"
          strokeDasharray="4 4"
          strokeWidth="1.5"
        />
        <text
          x={width / 2}
          y={60}
          fontSize="10"
          textAnchor="middle"
          fill="var(--muted)"
          fontFamily="monospace"
        >
          Origin (X = 0)
        </text>

        {/* The Rigid Box, drawn shifted by recoil */}
        <g transform={`translate(${drawnShiftPx}, 0)`}>
          <rect
            x={120}
            y={70}
            width={400}
            height={90}
            rx="4"
            fill="none"
            stroke="var(--plot)"
            strokeWidth="2.5"
          />
          {/* Left mirror / wall */}
          <rect x={115} y={75} width={8} height={100} fill="var(--plot)" rx="2" />
          {/* Right mirror / wall */}
          <rect x={517} y={75} width={8} height={100} fill="var(--plot)" rx="2" />

          {/* Box label */}
          <text
            x={320}
            y={105}
            fontSize="11"
            textAnchor="middle"
            fill="var(--plot)"
            fontWeight="600"
          >
            Box (mass M = {boxMass} kg, length ℓ = {boxLength} m)
          </text>

          {/* Light pulse wavepacket traveling right */}
          <g transform="translate(300, 125)">
            <circle cx="0" cy="0" r="8" fill="var(--accent)" opacity="0.8" />
            <path
              d="M -12 0 Q -6 -6 0 0 T 12 0"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
            />
            <text
              x="0"
              y="18"
              fontSize="10"
              textAnchor="middle"
              fill="var(--accent)"
              fontWeight="600"
            >
              Pulse E = {pulseEnergy} J
            </text>
          </g>

          {/* Recoil vector indicator */}
          <g transform="translate(100, 125)">
            <line x1="10" y1="0" x2="-25" y2="0" stroke="var(--accent)" strokeWidth="2" />
            <polygon points="-25,0 -17,-4 -17,4" fill="var(--accent)" />
            <text
              x="-30"
              y="4"
              fontSize="10"
              textAnchor="end"
              fill="var(--accent)"
              fontWeight="bold"
            >
              v_recoil
            </text>
          </g>
        </g>

        {/* System Center-of-Mass Marker */}
        <g transform={`translate(${width / 2 + (isZero ? 0 : drawnShiftPx)}, 175)`}>
          <circle cx="0" cy="0" r="6" fill={isZero ? "var(--plot)" : "var(--accent)"} />
          <polygon points="0,-8 5,-15 -5,-15" fill={isZero ? "var(--plot)" : "var(--accent)"} />
          <text
            x="0"
            y="18"
            fontSize="11"
            textAnchor="middle"
            fontWeight="bold"
            fill={isZero ? "var(--plot)" : "var(--accent)"}
          >
            {isZero ? "CM: Exactly Fixed (0 m)" : "CM Shifted (Violation!)"}
          </text>
        </g>

        {/* Units Strip and Magnification Callout */}
        <g transform="translate(20, 230)">
          <rect
            x="0"
            y="0"
            width={width - 40}
            height="40"
            rx="4"
            fill="var(--wash)"
            stroke="var(--line)"
          />
          <text x="15" y="16" fontSize="10" fill="currentColor" fontWeight="600">
            Units strip (unscaled physical displacement):
          </text>
          <text
            x="15"
            y="30"
            fontSize="11"
            fill="var(--ink)"
            fontFamily="monospace"
            fontWeight="bold"
            data-testid="units-strip-displacement"
          >
            Δx = <SciSvg value={physicalDisplacement} digits={6} /> m
          </text>
          <text x={width - 55} y="24" fontSize="10" textAnchor="end" fill="var(--muted)">
            Magnified <SciSvg value={magnification} />× for visualization (appliesTo:
            centerOfMassShift)
          </text>
        </g>
      </svg>

      {/* Physics Readout Card */}
      <div className="photon-box-telemetry">
        <div className="telemetry-col">
          <p className="telemetry-label">Pulse Momentum:</p>
          <p className="telemetry-value">
            {evaluation.pulseMomentum.status === "value" ? (
              <>
                <Sci value={Number(evaluation.pulseMomentum.value)} digits={6} /> kg·m/s
              </>
            ) : (
              "outside domain"
            )}
          </p>
          <p className="telemetry-label">Recoil Speed:</p>
          <p className="telemetry-value">
            {evaluation.recoilSpeed.status === "value" ? (
              <>
                <Sci value={Number(evaluation.recoilSpeed.value)} digits={6} /> m/s
              </>
            ) : (
              "outside domain"
            )}
          </p>
        </div>

        <div className="telemetry-col">
          <p className="telemetry-label">Flight Time:</p>
          <p className="telemetry-value">
            {evaluation.pulseFlightTime.status === "value" ? (
              <>
                <Sci value={Number(evaluation.pulseFlightTime.value)} digits={6} /> s
              </>
            ) : (
              "outside domain"
            )}
          </p>
          <p className="telemetry-label">Light Mass Assigned:</p>
          <p className="telemetry-value">
            {assignLightMass ? (
              <>
                {evaluation.lightMassAssigned.status === "value" ? (
                  <Sci value={Number(evaluation.lightMassAssigned.value)} digits={6} />
                ) : (
                  "0"
                )}{" "}
                kg (E/c²)
              </>
            ) : (
              "0 kg (none)"
            )}
          </p>
        </div>

        <div className="telemetry-col">
          <p className="telemetry-label">Center of Mass Shift:</p>
          <p
            className={`telemetry-value ${isZero ? "telemetry-value-fixed" : "telemetry-value-violation"}`}
            data-testid="center-of-mass-shift-readout"
          >
            {isZero
              ? "0 m (exact rational zero: 0/1)"
              : `Nonzero: ${evaluation.exactRationalCenterOfMassShift.numerator} / ${evaluation.exactRationalCenterOfMassShift.denominator} m`}
          </p>
          <p className="telemetry-label">Domain Bound E/(Mc²):</p>
          <p className="telemetry-value">
            <Sci value={evaluation.domainRatio} digits={4} /> ≤ <Sci value={1e-3} digits={1} /> (OK)
          </p>
        </div>
      </div>

      {/* Accessible & Print Representation Scale Facts */}
      <section className="scale-facts-section">
        <h4 className="scale-facts-heading">The drawing&apos;s scale</h4>
        <div className="scale-facts-table-wrap">
          <table className="scale-facts-table">
            <tbody>
              <tr className="scale-facts-row">
                <th className="scale-facts-th">Spatial magnification:</th>
                <td className="scale-facts-td">
                  {scale.spatialMagnification.factor}× (applies to:{" "}
                  <code>{scale.spatialMagnification.appliesTo}</code>)
                </td>
              </tr>
              <tr className="scale-facts-row">
                <th className="scale-facts-th">Simulated elapsed time:</th>
                <td className="scale-facts-td">
                  {scale.simulatedElapsedTime.value} {scale.simulatedElapsedTime.unit} (
                  <code>{scale.simulatedElapsedTime.quantityId}</code>)
                </td>
              </tr>
              <tr className="scale-facts-row">
                <th className="scale-facts-th">Playback multiplier:</th>
                <td className="scale-facts-td">{scale.playbackMultiplier}×</td>
              </tr>
              <tr className="scale-facts-row">
                <th className="scale-facts-th">Glyph size:</th>
                <td className="scale-facts-td">
                  {scale.glyphSize.drawnPx} px (represents:{" "}
                  <code>{scale.glyphSize.represents}</code>)
                </td>
              </tr>
              <tr className="scale-facts-row">
                <th className="scale-facts-th">Quantity normalization:</th>
                <td className="scale-facts-td">{scale.quantityNormalization.kind}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="scale-facts-print" data-testid="scale-facts-print">
          Scale: ×{scale.spatialMagnification.factor} ({scale.spatialMagnification.appliesTo}) · Δt:{" "}
          {scale.simulatedElapsedTime.value} {scale.simulatedElapsedTime.unit} ·{" "}
          {scale.playbackMultiplier}× rate · glyph: {scale.glyphSize.drawnPx}px (
          {scale.glyphSize.represents}) · norm: {scale.quantityNormalization.kind}
        </div>
      </section>
    </div>
  );
}
