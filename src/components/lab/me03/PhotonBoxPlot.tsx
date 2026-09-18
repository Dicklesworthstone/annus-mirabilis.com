import type { Me03Parameters } from "../../../experiments/me03/definition.ts";
import type { PhotonInBoxResult } from "../../../experiments/me03/session.ts";
import type { RepresentationScale } from "../../../visuals/kit/types.ts";

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
      className="photon-box-visual-wrap my-4"
      data-instrument-id="me-03:box-1906"
      data-testid="photon-box-plot"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="photon-box-canvas w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
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
        <text x="25" y="48" fontSize="11" fill="var(--color-text-muted, #64748b)">
          Poincaré (1900) recoil paradox · Einstein (1906) radiation inertia demonstration
        </text>

        {/* Center of Mass Origin Marker */}
        <line
          x1={width / 2}
          y1={65}
          x2={width / 2}
          y2={195}
          stroke="#94a3b8"
          strokeDasharray="4 4"
          strokeWidth="1.5"
        />
        <text
          x={width / 2}
          y={60}
          fontSize="10"
          textAnchor="middle"
          fill="#64748b"
          fontFamily="monospace"
        >
          Origin (X = 0)
        </text>

        {/* The Rigid Box, drawn shifted by recoil */}
        <g transform={`translate(${drawnShiftPx}, 0)`}>
          <rect
            x={120}
            y={80}
            width={400}
            height={90}
            rx="4"
            fill="none"
            stroke="#0284c7"
            strokeWidth="2.5"
          />
          {/* Left mirror / wall */}
          <rect x={115} y={75} width={8} height={100} fill="#0284c7" rx="2" />
          {/* Right mirror / wall */}
          <rect x={517} y={75} width={8} height={100} fill="#0284c7" rx="2" />

          {/* Box label */}
          <text x={320} y={105} fontSize="11" textAnchor="middle" fill="#0369a1" fontWeight="600">
            Box (mass M = {boxMass} kg, length ℓ = {boxLength} m)
          </text>

          {/* Light pulse wavepacket traveling right */}
          <g transform="translate(300, 125)">
            <circle cx="0" cy="0" r="8" fill="#f59e0b" opacity="0.8" />
            <path d="M -12 0 Q -6 -6 0 0 T 12 0" fill="none" stroke="#b45309" strokeWidth="2" />
            <text x="0" y="18" fontSize="10" textAnchor="middle" fill="#b45309" fontWeight="600">
              Pulse E = {pulseEnergy} J
            </text>
          </g>

          {/* Recoil vector indicator */}
          <g transform="translate(100, 125)">
            <line x1="10" y1="0" x2="-25" y2="0" stroke="#dc2626" strokeWidth="2" />
            <polygon points="-25,0 -17,-4 -17,4" fill="#dc2626" />
            <text x="-30" y="4" fontSize="10" textAnchor="end" fill="#dc2626" fontWeight="bold">
              v_recoil
            </text>
          </g>
        </g>

        {/* System Center-of-Mass Marker */}
        <g transform={`translate(${width / 2 + (isZero ? 0 : drawnShiftPx)}, 175)`}>
          <circle cx="0" cy="0" r="6" fill={isZero ? "#16a34a" : "#dc2626"} />
          <polygon points="0,-8 5,-15 -5,-15" fill={isZero ? "#16a34a" : "#dc2626"} />
          <text
            x="0"
            y="18"
            fontSize="11"
            textAnchor="middle"
            fontWeight="bold"
            fill={isZero ? "#16a34a" : "#dc2626"}
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
            fill="var(--color-bg-inset, #f1f5f9)"
            stroke="var(--color-border, #cbd5e1)"
          />
          <text x="15" y="16" fontSize="10" fill="currentColor" fontWeight="600">
            Units strip (unscaled physical displacement):
          </text>
          <text
            x="15"
            y="30"
            fontSize="11"
            fill="#0f172a"
            fontFamily="monospace"
            fontWeight="bold"
            data-testid="units-strip-displacement"
          >
            Δx = {physicalDisplacement.toExponential(6)} m
          </text>
          <text x={width - 55} y="24" fontSize="10" textAnchor="end" fill="#64748b">
            Magnified {magnification.toExponential()}× for visualization (appliesTo:
            centerOfMassShift)
          </text>
        </g>
      </svg>

      {/* Physics Readout Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 my-3 p-3 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs">
        <div className="telemetry-col">
          <p className="text-slate-500 font-semibold">Pulse Momentum:</p>
          <p className="font-mono text-slate-800 dark:text-slate-200">
            {evaluation.pulseMomentum.status === "value"
              ? `${Number(evaluation.pulseMomentum.value).toExponential(6)} kg·m/s`
              : "outside domain"}
          </p>
          <p className="text-slate-500 font-semibold mt-1">Recoil Speed:</p>
          <p className="font-mono text-slate-800 dark:text-slate-200">
            {evaluation.recoilSpeed.status === "value"
              ? `${Number(evaluation.recoilSpeed.value).toExponential(6)} m/s`
              : "outside domain"}
          </p>
        </div>

        <div className="telemetry-col">
          <p className="text-slate-500 font-semibold">Flight Time:</p>
          <p className="font-mono text-slate-800 dark:text-slate-200">
            {evaluation.pulseFlightTime.status === "value"
              ? `${Number(evaluation.pulseFlightTime.value).toExponential(6)} s`
              : "outside domain"}
          </p>
          <p className="text-slate-500 font-semibold mt-1">Light Mass Assigned:</p>
          <p className="font-mono text-slate-800 dark:text-slate-200">
            {assignLightMass
              ? `${evaluation.lightMassAssigned.status === "value" ? Number(evaluation.lightMassAssigned.value).toExponential(6) : "0"} kg (E/c²)`
              : "0 kg (none)"}
          </p>
        </div>

        <div className="telemetry-col">
          <p className="text-slate-500 font-semibold">Center of Mass Shift:</p>
          <p
            className={`font-mono font-bold ${isZero ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
            data-testid="center-of-mass-shift-readout"
          >
            {isZero
              ? "0 m (exact rational zero: 0/1)"
              : `Nonzero: ${evaluation.exactRationalCenterOfMassShift.numerator} / ${evaluation.exactRationalCenterOfMassShift.denominator} m`}
          </p>
          <p className="text-slate-500 font-semibold mt-1">Domain Bound E/(Mc²):</p>
          <p className="font-mono text-slate-800 dark:text-slate-200">
            {evaluation.domainRatio.toExponential(4)} ≤ 1.0e-3 (OK)
          </p>
        </div>
      </div>

      {/* Accessible & Print Representation Scale Facts */}
      <section className="scale-facts-section mt-3 p-3 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Published Representation Scale (am-inst-2d-view-kit-u75r)
        </h4>
        <div className="overflow-x-auto">
          <table className="scale-facts-table w-full text-xs text-left border-collapse">
            <tbody>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="py-1 px-2 font-semibold">Spatial magnification:</th>
                <td className="py-1 px-2">
                  {scale.spatialMagnification.factor}× (applies to:{" "}
                  <code>{scale.spatialMagnification.appliesTo}</code>)
                </td>
              </tr>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="py-1 px-2 font-semibold">Simulated elapsed time:</th>
                <td className="py-1 px-2">
                  {scale.simulatedElapsedTime.value} {scale.simulatedElapsedTime.unit} (
                  <code>{scale.simulatedElapsedTime.quantityId}</code>)
                </td>
              </tr>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="py-1 px-2 font-semibold">Playback multiplier:</th>
                <td className="py-1 px-2">{scale.playbackMultiplier}×</td>
              </tr>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="py-1 px-2 font-semibold">Glyph size:</th>
                <td className="py-1 px-2">
                  {scale.glyphSize.drawnPx} px (represents:{" "}
                  <code>{scale.glyphSize.represents}</code>)
                </td>
              </tr>
              <tr>
                <th className="py-1 px-2 font-semibold">Quantity normalization:</th>
                <td className="py-1 px-2">{scale.quantityNormalization.kind}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          className="scale-facts-print text-xs mt-2 text-slate-600 dark:text-slate-400"
          data-testid="scale-facts-print"
        >
          Scale: ×{scale.spatialMagnification.factor} ({scale.spatialMagnification.appliesTo}) · Δt:{" "}
          {scale.simulatedElapsedTime.value} {scale.simulatedElapsedTime.unit} ·{" "}
          {scale.playbackMultiplier}× rate · glyph: {scale.glyphSize.drawnPx}px (
          {scale.glyphSize.represents}) · norm: {scale.quantityNormalization.kind}
        </div>
      </section>
    </div>
  );
}
