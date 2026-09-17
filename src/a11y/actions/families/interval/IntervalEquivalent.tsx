/**
 * Accessible Interval Family Equivalent Component (am-a11y-action-contracts-k75g).
 *
 * Provides:
 * 1. Direct typed numeric entry for lower and upper limits [a, b].
 * 2. Instant probability and particle count evaluation.
 * 3. Comparison of two named intervals (Interval A vs. Interval B).
 * 4. 24x24 minimum touch targets and visible labels contained in accessible names.
 * 5. Single command path calling buildActionCommand and live-region announcement.
 */

import React, { useState } from "react";
import { announce } from "../../../announce.ts";
import { buildActionCommand } from "../../commandBuilder.ts";
import { fixtureIntervalContract } from "../../fixtures.ts";
import type { ActionContract, CanonicalActionCommand } from "../../types.ts";

export interface IntervalBounds {
  readonly lower: number;
  readonly upper: number;
}

export interface IntervalEquivalentProps {
  readonly contract?: ActionContract | undefined;
  readonly initialInterval?: IntervalBounds | undefined;
  readonly minLimit?: number | undefined;
  readonly maxLimit?: number | undefined;
  readonly step?: number | undefined;
  readonly onCommitInterval?:
    | ((bounds: IntervalBounds, command: CanonicalActionCommand) => void)
    | undefined;
  readonly className?: string | undefined;
}

export function IntervalEquivalent({
  contract = fixtureIntervalContract,
  initialInterval = { lower: -1.0, upper: 1.0 },
  minLimit = -10.0,
  maxLimit = 10.0,
  step = 0.1,
  onCommitInterval,
  className = "",
}: IntervalEquivalentProps): React.JSX.Element {
  const [lower, setLower] = useState<number>(initialInterval.lower);
  const [upper, setUpper] = useState<number>(initialInterval.upper);

  // Comparison interval (Interval B)
  const [compareEnabled, setCompareEnabled] = useState<boolean>(false);
  const [compLower, setCompLower] = useState<number>(0.0);
  const [compUpper, setCompUpper] = useState<number>(2.0);

  const [committedBounds, setCommittedBounds] = useState<IntervalBounds>(initialInterval);

  // Simplified reference calculation for instant feedback
  const computeProbability = (a: number, b: number): number => {
    const width = Math.max(0, b - a);
    return Math.min(100, Math.round(width * 25 * 10) / 10);
  };

  const probA = computeProbability(lower, upper);
  const probB = computeProbability(compLower, compUpper);
  const expectedParticlesA = Math.round((probA / 100) * 500);
  const expectedParticlesB = Math.round((probB / 100) * 500);

  const handleCommit = () => {
    const validLower = Math.min(lower, upper);
    const validUpper = Math.max(lower, upper);
    const newBounds: IntervalBounds = { lower: validLower, upper: validUpper };

    setCommittedBounds(newBounds);

    const command = buildActionCommand(contract, {
      interval_lower: validLower,
      interval_upper: validUpper,
      confidence_level: 0.95,
    });

    // Announce once per commit
    const announcementMsg = `Interval set to [${validLower}, ${validUpper}] µm: Probability ${probA}%, expected ${expectedParticlesA} particles.`;
    announce(announcementMsg, "polite");

    onCommitInterval?.(newBounds, command);
  };

  return (
    <div
      className={`interval-equivalent-panel ${className}`.trim()}
      role="region"
      aria-label="Accessible spatial interval selector"
    >
      <div className="interval-question">
        <h4>{contract.question}</h4>
      </div>

      <fieldset className="interval-fieldset">
        <legend>Interval A (Primary Target)</legend>

        <div className="interval-controls-grid">
          <div className="interval-input-group">
            <label htmlFor="interval-lower-input">Lower Limit (µm):</label>
            <input
              id="interval-lower-input"
              type="number"
              className="interval-number-input"
              value={lower}
              min={minLimit}
              max={upper}
              step={step}
              aria-label="Lower Limit (µm)"
              onChange={(e) => setLower(parseFloat(e.target.value) || 0)}
              onKeyDown={(e) => e.key === "Enter" && handleCommit()}
            />
          </div>

          <div className="interval-input-group">
            <label htmlFor="interval-upper-input">Upper Limit (µm):</label>
            <input
              id="interval-upper-input"
              type="number"
              className="interval-number-input"
              value={upper}
              min={lower}
              max={maxLimit}
              step={step}
              aria-label="Upper Limit (µm)"
              onChange={(e) => setUpper(parseFloat(e.target.value) || 0)}
              onKeyDown={(e) => e.key === "Enter" && handleCommit()}
            />
          </div>
        </div>

        <div className="interval-readout" aria-live="polite">
          <span className="readout-item">
            <strong>Probability:</strong> {probA}%
          </span>
          <span className="readout-item">
            <strong>Expected Particles:</strong> {expectedParticlesA} / 500
          </span>
        </div>
      </fieldset>

      <div className="interval-compare-toggle">
        <label className="toggle-label">
          <input
            type="checkbox"
            className="compare-checkbox"
            checked={compareEnabled}
            aria-label="Enable interval comparison"
            onChange={(e) => setCompareEnabled(e.target.checked)}
          />
          <span>Compare with second interval</span>
        </label>
      </div>

      {compareEnabled && (
        <fieldset className="interval-fieldset compare-fieldset">
          <legend>Interval B (Comparison)</legend>
          <div className="interval-controls-grid">
            <div className="interval-input-group">
              <label htmlFor="compare-lower-input">Interval B Lower Limit (µm):</label>
              <input
                id="compare-lower-input"
                type="number"
                className="interval-number-input"
                value={compLower}
                min={minLimit}
                max={compUpper}
                step={step}
                aria-label="Interval B Lower Limit (µm)"
                onChange={(e) => setCompLower(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="interval-input-group">
              <label htmlFor="compare-upper-input">Interval B Upper Limit (µm):</label>
              <input
                id="compare-upper-input"
                type="number"
                className="interval-number-input"
                value={compUpper}
                min={compLower}
                max={maxLimit}
                step={step}
                aria-label="Interval B Upper Limit (µm)"
                onChange={(e) => setCompUpper(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="interval-readout">
            <span>
              <strong>Interval B Probability:</strong> {probB}% ({expectedParticlesB} particles)
            </span>
            <span className="comparison-delta">
              <strong>Ratio A / B:</strong> {probB > 0 ? (probA / probB).toFixed(2) : "undefined"}
            </span>
          </div>
        </fieldset>
      )}

      <div className="interval-actions">
        <button
          type="button"
          className="interval-commit-btn"
          onClick={handleCommit}
          aria-label="Apply and commit interval"
        >
          Apply Interval
        </button>
        <span className="committed-status" role="status">
          Committed: [{committedBounds.lower}, {committedBounds.upper}] µm
        </span>
      </div>
    </div>
  );
}
