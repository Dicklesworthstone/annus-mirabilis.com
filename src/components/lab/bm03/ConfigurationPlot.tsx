import type { Bm03Parameters } from "../../../experiments/bm03/definition.ts";
import type { Bm03Evaluation } from "../../../experiments/bm03/session.ts";

export interface ConfigurationPlotProps {
  parameters: Bm03Parameters;
  evaluation: Bm03Evaluation;
  clipId: string;
}

export function ConfigurationPlot({ parameters, evaluation, clipId }: ConfigurationPlotProps) {
  const { Np, volumeRatio, model, step, notation } = parameters;
  const isPrinted = notation === "printed";
  const isLocked = model === "locked-cluster";

  const ratio = Math.max(0.5, Math.min(volumeRatio, 4));

  // Visual container dimensions
  const baseWidth = 140;
  const boxWidth = baseWidth * Math.min(ratio, 2.5);
  const boxHeight = 120;

  return (
    <div
      className="configuration-svg-wrap"
      data-step={step}
      data-model={model}
      data-notation={notation}
    >
      <svg
        viewBox="0 0 540 280"
        className="configuration-canvas"
        role="img"
        aria-label={`Stepwise construction of configuration integral at step ${step}`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="20" y="20" width="500" height="240" rx="8" />
          </clipPath>
          <linearGradient id={`${clipId}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-bg-subtle, #f5f4f0)" />
            <stop offset="100%" stopColor="var(--color-bg-inset, #ebe9e1)" />
          </linearGradient>
        </defs>

        {/* Background container */}
        <rect
          x="10"
          y="10"
          width="520"
          height="260"
          rx="10"
          fill={`url(#${clipId}-grad)`}
          stroke="var(--color-border, #d1cfc7)"
          strokeWidth="1.5"
        />

        {step === "one-particle" && (
          <g className="step-one-particle">
            <text
              x="30"
              y="40"
              className="step-title"
              fontWeight="bold"
              fontSize="14"
              fill="currentColor"
            >
              Step 1: One Particle in Accessible Volume {isPrinted ? "V*" : "V"}
            </text>
            <text x="30" y="60" fontSize="12" fill="var(--color-text-muted, #666)">
              Position options are proportional to the accessible room.
            </text>

            {/* Volume box */}
            <rect
              x="50"
              y="85"
              width={boxWidth}
              height={boxHeight}
              fill="rgba(59, 130, 246, 0.12)"
              stroke="#3b82f6"
              strokeWidth="2"
              rx="6"
            />
            <text
              x={50 + boxWidth / 2}
              y={85 + boxHeight + 20}
              textAnchor="middle"
              fontSize="13"
              fontWeight="bold"
              fill="currentColor"
            >
              {isPrinted ? "V*" : "V"} ({ratio} × V₀)
            </text>

            {/* Single particle */}
            <circle
              cx={50 + boxWidth / 2}
              cy={85 + boxHeight / 2}
              r="8"
              fill="#ef4444"
              stroke="#991b1b"
              strokeWidth="2"
            />
            <text
              x={50 + boxWidth / 2 + 14}
              y={85 + boxHeight / 2 + 4}
              fontSize="11"
              fill="currentColor"
            >
              particle 1 (x₁, y₁, z₁)
            </text>

            {/* Math card */}
            <g transform="translate(320, 85)">
              <rect
                width="190"
                height="120"
                rx="6"
                fill="var(--color-bg-card, #ffffff)"
                stroke="var(--color-border, #ccc)"
              />
              <text x="15" y="30" fontSize="12" fontWeight="bold" fill="currentColor">
                Integral over (x₁, y₁, z₁)
              </text>
              <text x="15" y="60" fontSize="14" fontFamily="monospace" fill="#1e40af">
                {isPrinted ? "B₁ = ∫ dx₁dy₁dz₁ = V*" : "B₁ = ∫ dx₁dy₁dz₁ = V"}
              </text>
              <text x="15" y="90" fontSize="11" fill="var(--color-text-muted, #666)">
                Factor ratio: {ratio}
              </text>
            </g>
          </g>
        )}

        {step === "two-particles" && (
          <g className="step-two-particles">
            <text
              x="30"
              y="40"
              className="step-title"
              fontWeight="bold"
              fontSize="14"
              fill="currentColor"
            >
              Step 2: Two Independent Particles (Arrangement Product)
            </text>
            <text x="30" y="60" fontSize="12" fill="var(--color-text-muted, #666)">
              Independence multiplies choices: 2 options for #1 × 2 options for #2 = 4 combinations.
            </text>

            {/* Arrangement grid representation */}
            <g transform="translate(40, 85)">
              <text x="0" y="-8" fontSize="11" fontWeight="bold" fill="currentColor">
                Position grid (V/V₀ = {ratio} choices each)
              </text>
              <rect
                width="180"
                height="120"
                fill="rgba(59, 130, 246, 0.08)"
                stroke="#3b82f6"
                strokeWidth="1.5"
                rx="4"
              />
              {/* Grid dividing lines */}
              <line x1="90" y1="0" x2="90" y2="120" stroke="#3b82f6" strokeDasharray="3,3" />
              <line x1="0" y1="60" x2="180" y2="60" stroke="#3b82f6" strokeDasharray="3,3" />

              {/* 4 arrangement points */}
              <circle cx="45" cy="30" r="6" fill="#ef4444" />
              <circle cx="135" cy="30" r="6" fill="#ef4444" />
              <circle cx="45" cy="90" r="6" fill="#ef4444" />
              <circle cx="135" cy="90" r="6" fill="#ef4444" />

              <text
                x="90"
                y="145"
                textAnchor="middle"
                fontSize="12"
                fontWeight="bold"
                fill="currentColor"
              >
                {evaluation.exactDecimalString ?? (ratio * ratio).toFixed(2)} arrangement states
              </text>
            </g>

            {/* Math card */}
            <g transform="translate(260, 85)">
              <rect
                width="250"
                height="135"
                rx="6"
                fill="var(--color-bg-card, #ffffff)"
                stroke="var(--color-border, #ccc)"
              />
              <text x="15" y="25" fontSize="12" fontWeight="bold" fill="currentColor">
                Integral over 2 independent particles
              </text>
              <text x="15" y="55" fontSize="13" fontFamily="monospace" fill="#1e40af">
                {isPrinted ? "B₂ = ∫...∫ dx₁...dz₂ = V*²" : "B₂ = ∫...∫ dx₁...dz₂ = V²"}
              </text>
              <text x="15" y="85" fontSize="12" fill="currentColor">
                Volume factor: ({ratio})² = <strong>{evaluation.exactDecimalString ?? "4"}</strong>
              </text>
              <text x="15" y="112" fontSize="11" fill="var(--color-text-muted, #666)">
                {isLocked
                  ? "Locked cluster: options grow only as V/V₀ = 2"
                  : "Independent: options grow as (V/V₀)² = 4"}
              </text>
            </g>
          </g>
        )}

        {step === "many-particles" && (
          <g className="step-many-particles">
            <text
              x="30"
              y="40"
              className="step-title"
              fontWeight="bold"
              fontSize="14"
              fill="currentColor"
            >
              Step 3: {Np.toLocaleString()} Particles & Logarithmic Free Energy
            </text>
            <text x="30" y="60" fontSize="12" fill="var(--color-text-muted, #666)">
              The product V^Np becomes the sum Np · ln V in the free energy logarithm.
            </text>

            {/* Visual particles cloud */}
            <g transform="translate(40, 85)">
              <rect
                width="180"
                height="120"
                fill="rgba(16, 185, 129, 0.08)"
                stroke="#10b981"
                strokeWidth="1.5"
                rx="6"
              />
              {Array.from({ length: Math.min(Np, 24) }, (_, i) => {
                const cx = 20 + ((i * 37 + 13) % 140);
                const cy = 20 + ((i * 53 + 7) % 80);
                return (
                  <circle
                    key={`dot-${Np}-${cx}-${cy}`}
                    cx={cx}
                    cy={cy}
                    r="4"
                    fill="#10b981"
                    opacity="0.8"
                  />
                );
              })}
              <text
                x="90"
                y="145"
                textAnchor="middle"
                fontSize="12"
                fontWeight="bold"
                fill="currentColor"
              >
                {Np > 24 ? `... ${Np.toLocaleString()} particles` : `${Np} particles`}
              </text>
            </g>

            {/* Math card */}
            <g transform="translate(240, 80)">
              <rect
                width="270"
                height="150"
                rx="6"
                fill="var(--color-bg-card, #ffffff)"
                stroke="var(--color-border, #ccc)"
              />
              <text x="15" y="24" fontSize="12" fontWeight="bold" fill="currentColor">
                Logarithmic Configuration Integral
              </text>
              <text x="15" y="50" fontSize="13" fontFamily="monospace" fill="#047857">
                {isPrinted
                  ? "B = V*ⁿ · J  ⟹  lg B = n lg V* + lg J"
                  : "B = V^Np · J  ⟹  ln B = Np ln V + ln J"}
              </text>
              <text x="15" y="78" fontSize="12" fill="currentColor">
                {isPrinted ? "Free energy: F = -2κT lg B" : "Free energy: F = -k_B T ln B"}
              </text>
              <text x="15" y="105" fontSize="12" fill="#b45309">
                {Np <= 12 ? (
                  <>
                    Factor ratio: <strong>{evaluation.exactDecimalString}</strong>
                  </>
                ) : (
                  <>
                    Factor exponent: 10^<strong>{evaluation.log10Exponent.toFixed(4)}</strong> (ln:{" "}
                    {evaluation.naturalLogExponent.toFixed(2)})
                  </>
                )}
              </text>
              <text x="15" y="130" fontSize="11" fill="var(--color-text-muted, #666)">
                J is independent of V under dilution & no external fields.
              </text>
            </g>
          </g>
        )}

        {step === "derivative" && (
          <g className="step-derivative">
            <text
              x="30"
              y="40"
              className="step-title"
              fontWeight="bold"
              fontSize="14"
              fill="currentColor"
            >
              Step 4: Volume Derivative & Ideal Pressure Law
            </text>
            <text x="30" y="60" fontSize="12" fill="var(--color-text-muted, #666)">
              Differentiating -dF/dV drops the volume-independent J and constant offset F₀.
            </text>

            {/* Derivative breakdown */}
            <g transform="translate(30, 80)">
              <rect
                width="480"
                height="150"
                rx="6"
                fill="var(--color-bg-card, #ffffff)"
                stroke="var(--color-border, #ccc)"
              />

              <g transform="translate(20, 30)">
                <text x="0" y="0" fontSize="13" fontWeight="bold" fill="currentColor">
                  Free energy:
                </text>
                <text x="90" y="0" fontSize="13" fontFamily="monospace" fill="#4338ca">
                  {isPrinted
                    ? "F = -2κT n lg V* - 2κT lg J + F₀"
                    : "F = -Np k_B T ln V - k_B T ln J + F₀"}
                </text>
              </g>

              <g transform="translate(20, 65)">
                <text x="0" y="0" fontSize="13" fontWeight="bold" fill="currentColor">
                  Derivative:
                </text>
                <text x="90" y="0" fontSize="13" fontFamily="monospace" fill="#047857">
                  {isPrinted
                    ? "p = -∂F/∂V* = 2κT · (n / V*) + 0 + 0 = (RT / N) · (n / V*)"
                    : "p = -∂F/∂V = Np k_B T / V + 0 + 0 = n k_B T"}
                </text>
              </g>

              {/* Contrast with locked cluster */}
              <g transform="translate(20, 100)">
                <rect
                  width="440"
                  height="35"
                  rx="4"
                  fill={isLocked ? "rgba(239, 68, 68, 0.08)" : "rgba(59, 130, 246, 0.08)"}
                />
                <text
                  x="12"
                  y="22"
                  fontSize="12"
                  fontWeight="bold"
                  fill={isLocked ? "#b91c1c" : "#1d4ed8"}
                >
                  {isLocked
                    ? "Locked cluster: 1 independent unit ⟹ p = k_B T / V (counts units, not constituents)"
                    : `Independent model: ${Np.toLocaleString()} independent units ⟹ p = ${Np.toLocaleString()} k_B T / V`}
                </text>
              </g>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
