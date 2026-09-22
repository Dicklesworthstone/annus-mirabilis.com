import type { Lq03Parameters } from "../../../experiments/lq03/definition.ts";
import type { Lq03Spectrum, Lq03SpectrumLaw } from "../../../experiments/lq03/session.ts";
import { exponentialParts } from "../../../units/scientific.ts";
import "./spectrum.css";

/**
 * The radiation spectrum, drawn. /lab/lq-03/ asked "what does a measured radiation spectrum look
 * like at a given temperature" and answered with a table at one probe frequency: its coordinate,
 * axis-scale and density-convention selects were validated and stored and changed nothing a reader
 * could see. This draws what they choose.
 *
 * Every number here is the session's (src/experiments/lq03/session.ts), which samples the
 * radiation owner; this component only maps base-10 logarithms to pixels. The three laws differ by
 * line pattern and by a label at the curve's end, never by colour alone.
 */

const W = 480;
const H = 300;
const PAD = { left: 58, right: 16, top: 16, bottom: 46 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** Whole class names, so a stylesheet search finds each one. */
const CURVE_CLASS: Readonly<Record<Lq03SpectrumLaw, string>> = {
  planck: "lq03-curve",
  wien: "lq03-curve lq03-curve-wien",
  classical: "lq03-curve lq03-curve-classical",
};

const LAW_LABEL: Readonly<Record<Lq03SpectrumLaw, string>> = {
  planck: "Planck 1900",
  wien: "Wien 1896",
  classical: "Classical §1",
};

const SUPERSCRIPT: Readonly<Record<string, string>> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};
function powerOfTen(exponent: number | string): string {
  return `10${[...String(exponent)].map((ch) => SUPERSCRIPT[ch] ?? ch).join("")}`;
}

/** A number as <Sci> draws it (units/scientific.ts), with the power set in superscript digits. */
function sci(value: number, digits: number): string {
  const parts = exponentialParts(value, digits);
  return parts.kind === "plain" ? parts.text : `${parts.mantissa} × ${powerOfTen(parts.exponent)}`;
}

const CONVENTION_PHRASE: Readonly<Record<Lq03Parameters["convention"], string>> = {
  "per-hz": "per hertz, u_ν",
  "per-m": "per metre of wavelength, u_λ",
  "per-log": "per natural-log interval, ν u_ν = λ u_λ",
  "per-decade": "per decade, ln 10 · ν u_ν",
};
const CONVENTION_UNIT: Readonly<Record<Lq03Parameters["convention"], string>> = {
  "per-hz": "J m⁻³ Hz⁻¹",
  "per-m": "J m⁻⁴",
  "per-log": "J m⁻³",
  "per-decade": "J m⁻³",
};

export function SpectrumPlot({
  spectrum,
  shown,
  titleId,
}: {
  spectrum: Lq03Spectrum;
  shown: Readonly<Record<Lq03SpectrumLaw, boolean>>;
  titleId: string;
}) {
  const logX = spectrum.axisScale === "logarithmic";
  const logY = spectrum.axisScale === "logarithmic";
  const [xMin, xMax] = spectrum.xRange;
  const [yMin, yMax] = spectrum.yRange;

  // x and y arrive as base-10 logarithms; a linear axis maps their powers.
  const px = (log10x: number) => {
    const t = logX
      ? (log10x - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin))
      : (10 ** log10x - xMin) / (xMax - xMin);
    return PAD.left + t * PLOT_W;
  };
  const py = (log10y: number) => {
    const t = logY ? (log10y - yMin) / (yMax - yMin) : (10 ** log10y - yMin) / (yMax - yMin);
    return PAD.top + (1 - t) * PLOT_H;
  };

  const laws = (["planck", "wien", "classical"] as const).filter((law) => shown[law]);
  const paths = laws.map((law) => {
    let d = "";
    let pen = false;
    for (const point of spectrum.points) {
      const y = point.log10Density[law];
      if (y === null) {
        pen = false;
        continue;
      }
      const X = px(point.log10X);
      const Y = py(y);
      if (!Number.isFinite(X) || !Number.isFinite(Y)) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${X.toFixed(1)} ${Y.toFixed(1)}`;
      pen = true;
    }
    return { law, d };
  });

  const xTicks = logX
    ? spectrum.xDecades.map((e) => ({ at: e, label: powerOfTen(e) }))
    : spectrum.xLinearTicks.map((v) => ({ at: Math.log10(v), label: sci(v, 1) }));
  // A y label within a text line of the x axis would sit on the first x label.
  const yTicks = logY
    ? spectrum.yDecades
        .map((e) => ({ at: e, label: powerOfTen(e) }))
        .filter((tick) => py(tick.at) < PAD.top + PLOT_H - 14)
    : [];
  const probeX = px(spectrum.probeLog10X);
  const band = [px(spectrum.bandLog10X[0]), px(spectrum.bandLog10X[1])].sort((a, b) => a - b);
  const peak = spectrum.peak;
  const clipId = `${titleId}-clip`;
  const unitX = spectrum.coordinate === "frequency" ? "Hz" : "m";
  const xLabel = spectrum.coordinate === "frequency" ? "Frequency ν (Hz)" : "Wavelength λ (m)";
  const scaleWord = spectrum.axisScale === "logarithmic" ? "logarithmic" : "linear";
  const description = `The spectrum at T = ${spectrum.temperature} K: energy density ${
    CONVENTION_PHRASE[spectrum.convention]
  }, against ${spectrum.coordinate}, on ${scaleWord} axes. Planck's curve peaks at ${
    peak ? `${sci(10 ** peak.log10X, 2)} ${unitX}` : "a point outside the drawn range"
  }. Wien's law meets Planck's at high frequency (short wavelength); the classical law meets it at low frequency (long wavelength) and keeps rising where Planck's falls.`;
  const probeInFrame = probeX >= PAD.left && probeX <= PAD.left + PLOT_W;
  // The legend goes on the side away from Planck's peak, where the curves leave room for it.
  const peakOnRight = peak ? px(peak.log10X) > PAD.left + PLOT_W / 2 : false;
  const legendX = peakOnRight ? PAD.left + 10 : PAD.left + PLOT_W - 132;

  return (
    <figure className="lq03-spectrum">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={titleId}>
        <title id={titleId}>{description}</title>
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H} />
          </clipPath>
        </defs>
        <rect
          className="lq03-band"
          x={Math.max(PAD.left, band[0] ?? PAD.left)}
          y={PAD.top}
          width={Math.max(
            0,
            Math.min(PAD.left + PLOT_W, band[1] ?? PAD.left) -
              Math.max(PAD.left, band[0] ?? PAD.left),
          )}
          height={PLOT_H}
        />
        <g className="lq03-axes">
          <line x1={PAD.left} y1={PAD.top + PLOT_H} x2={PAD.left + PLOT_W} y2={PAD.top + PLOT_H} />
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + PLOT_H} />
          {xTicks.map((tick) => (
            <text key={`x${tick.at}`} x={px(tick.at)} y={PAD.top + PLOT_H + 16} textAnchor="middle">
              {tick.label}
            </text>
          ))}
          {yTicks.map((tick) => (
            <text key={`y${tick.at}`} x={PAD.left - 6} y={py(tick.at) + 4} textAnchor="end">
              {tick.label}
            </text>
          ))}
          <text x={PAD.left + PLOT_W / 2} y={H - 6} textAnchor="middle">
            {xLabel}
          </text>
        </g>
        <g clipPath={`url(#${clipId})`}>
          {paths.map(({ law, d }) => (
            <path key={law} className={CURVE_CLASS[law]} d={d} />
          ))}
          {Number.isFinite(probeX) && (
            <line
              className="lq03-probe"
              x1={probeX}
              y1={PAD.top}
              x2={probeX}
              y2={PAD.top + PLOT_H}
            />
          )}
          {peak && shown.planck && (
            <circle className="lq03-peak" cx={px(peak.log10X)} cy={py(peak.log10Density)} r={4} />
          )}
        </g>
        {peak && shown.planck && (
          <text
            x={px(peak.log10X)}
            y={Math.max(PAD.top + 12, py(peak.log10Density) - 10)}
            textAnchor="middle"
          >
            peak
          </text>
        )}
        {probeInFrame && (
          <text
            x={probeX > PAD.left + PLOT_W - 50 ? probeX - 4 : probeX + 4}
            y={PAD.top + PLOT_H - 6}
            textAnchor={probeX > PAD.left + PLOT_W - 50 ? "end" : "start"}
          >
            probe
          </text>
        )}
        <g transform={`translate(${legendX}, ${PAD.top + 14})`}>
          {laws.map((law, i) => (
            <g key={`legend-${law}`} transform={`translate(0, ${i * 18})`}>
              <line className={CURVE_CLASS[law]} x1={0} y1={-4} x2={26} y2={-4} />
              <text x={32} y={0}>
                {LAW_LABEL[law]}
              </text>
            </g>
          ))}
        </g>
      </svg>
      <figcaption>
        Energy density {CONVENTION_PHRASE[spectrum.convention]}, in{" "}
        {CONVENTION_UNIT[spectrum.convention]}, on {scaleWord} axes. The shaded strip is the band;
        the dashed vertical line is the probe frequency.
      </figcaption>
    </figure>
  );
}
