/**
 * ValueWithUncertainty Component (am-ver-precision-display-5e5).
 *
 * Accessible React component for displaying numbers with units, physical uncertainty,
 * guard digits, and constant-set provenance.
 */

import { formatCleanNumber, formatGuardDigit, formatSignificantFigures } from "./format.ts";
import { spokenQuantity } from "./spoken.ts";
import { formatUncertainty, spokenUncertainty, type UncertaintySpec } from "./uncertainty.ts";
import "./units.css";

export interface ValueWithUncertaintyProps {
  readonly value: number;
  readonly unit?: string;
  readonly uncertainty?: UncertaintySpec;
  readonly sigFigs?: number;
  readonly guardDigit?: boolean;
  readonly constantSetId?: string;
  readonly constantSetLabel?: string;
  readonly locale?: string;
  readonly className?: string;
}

export function ValueWithUncertainty({
  value,
  unit = "",
  uncertainty,
  sigFigs,
  guardDigit = false,
  constantSetId,
  constantSetLabel,
  locale = "en-US",
  className = "",
}: ValueWithUncertaintyProps): React.JSX.Element {
  let mainText: string;
  let guardDigitChar = "";

  if (sigFigs !== undefined) {
    if (guardDigit) {
      const guardResult = formatGuardDigit(value, sigFigs, { locale });
      mainText = guardResult.mainText;
      guardDigitChar = guardResult.guardDigit;
    } else {
      mainText = formatSignificantFigures(value, sigFigs, { locale });
    }
  } else {
    mainText = formatCleanNumber(value, 6, locale);
  }

  const formatOptions = {
    ...(sigFigs !== undefined ? { sigFigs } : {}),
    locale,
  };
  const uncertaintyText = uncertainty ? formatUncertainty(uncertainty, formatOptions) : "";
  const spokenValue = spokenQuantity(value, unit);
  const spokenUncertaintyText = uncertainty
    ? spokenUncertainty(uncertainty, unit, formatOptions)
    : "";

  const fullSpokenLabel = [
    spokenValue,
    spokenUncertaintyText,
    constantSetLabel ? `under ${constantSetLabel}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const cleanUnit = unit && unit !== "1" && unit !== "dimensionless" ? unit : "";
  const constantLabel = constantSetLabel ?? constantSetId;

  return (
    <span
      role="img"
      className={`value-with-uncertainty ${className}`.trim()}
      aria-label={fullSpokenLabel}
      data-value={value}
      data-unit={cleanUnit || undefined}
      data-uncertainty-kind={uncertainty?.kind}
      data-constant-set={constantSetId}
      data-locale={locale}
    >
      <span className="value-main" aria-hidden="true">
        {mainText}
      </span>
      {guardDigitChar && (
        <span
          className="guard-digit"
          title="Guard digit (one extra digit for calculation audit)"
          aria-hidden="true"
        >
          {guardDigitChar}
        </span>
      )}
      {cleanUnit && (
        <span className="value-unit" aria-hidden="true">
          {cleanUnit}
        </span>
      )}
      {uncertaintyText && (
        <span className="value-uncertainty" aria-hidden="true">
          {uncertaintyText}
        </span>
      )}
      {constantLabel && (
        <span className="value-constant-set" aria-hidden="true">
          {`(${constantLabel})`}
        </span>
      )}
    </span>
  );
}
