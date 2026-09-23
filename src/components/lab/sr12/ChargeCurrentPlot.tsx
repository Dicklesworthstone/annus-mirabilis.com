"use client";

import type { ReactNode } from "react";
import type { PublishedResult } from "../../../experiments/store/instanceStore.ts";
import { display, fixed } from "../presentation.ts";
import "./sr12.css";
import { withScripts } from "../subscripts.tsx";

/** A scalar result's value, or null when the model returned no number. */
function scalarOf(r: PublishedResult | undefined): number | null {
  return r && r.status === "value" && typeof r.value === "number" ? r.value : null;
}

/** The x component of a vector result. Vectors are published as a NumericView, not a
 * Float64Array: the old check tested for Float64Array, never matched, and so always showed its
 * fallback of 1 A/m² in place of the model's J′ₓ. */
function xComponentOf(r: PublishedResult | undefined): number | null {
  if (r?.status !== "value" || typeof r.value === "number") return null;
  return r.value.length > 0 ? r.value.at(0) : null;
}

const sign = (x: number | null) => (x === null || x === 0 ? 0 : x > 0 ? 1 : -1);
const shown = (x: number | null) => (x === null ? "not computed" : display(x));

const MODE_TITLES: Record<string, string> = {
  "neutral-conductor": "A neutral wire carrying a current",
  convection: "A cloud of charge on the move",
  "moving-sphere": "A uniformly charged sphere",
  "gaussian-pulse": "A pulse of charge",
  "current-loop": "A current loop",
};

// One frame's drawing is 260 by 130 units, so at a phone's full width it is drawn at about its
// own size and an 11-unit label reads at about 11px.
const W = 260;
const H = 130;
const label = { fill: "var(--ink)", fontSize: "11px", fontFamily: "var(--font-sans)" } as const;

/** A row of n charges spread evenly along the drawing, each marked + or − so that the sign does
 * not rest on colour alone. */
function ChargeRow({ n, y, positive }: { n: number; y: number; positive: boolean }) {
  const r = positive ? 5.5 : 4.5;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => 12 + ((W - 24) * (i + 0.5)) / n).map((cx) => (
        <g key={`${positive ? "p" : "n"}-${cx.toFixed(2)}`}>
          <circle cx={cx} cy={y} r={r} fill={positive ? "var(--accent)" : "var(--plot)"} />
          <line x1={cx - 2.5} y1={y} x2={cx + 2.5} y2={y} stroke="var(--panel)" strokeWidth={1.4} />
          {positive ? (
            <line
              x1={cx}
              y1={y - 2.5}
              x2={cx}
              y2={y + 2.5}
              stroke="var(--panel)"
              strokeWidth={1.4}
            />
          ) : null}
        </g>
      ))}
    </g>
  );
}

/** A short arrow with a word beside it, pointing left (-1) or right (+1). */
function MotionArrow({ direction, y, words }: { direction: number; y: number; words: string }) {
  if (direction === 0) return null;
  const tail = direction > 0 ? 100 : 160;
  const head = direction > 0 ? 160 : 100;
  return (
    <g>
      <line
        x1={tail}
        y1={y}
        x2={head}
        y2={y}
        stroke="var(--muted)"
        strokeWidth={2}
        markerEnd="url(#sr12-arrow)"
      />
      <text
        x={direction > 0 ? 92 : 168}
        y={y + 4}
        textAnchor={direction > 0 ? "end" : "start"}
        style={label}
      >
        {words}
      </text>
    </g>
  );
}

function ArrowMarker() {
  return (
    <defs>
      <marker
        id="sr12-arrow"
        viewBox="0 0 10 10"
        refX="7"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--muted)" />
      </marker>
    </defs>
  );
}

function Frame({
  title,
  values,
  ariaLabel,
  caption,
  children,
}: {
  title: string;
  values: string | null;
  ariaLabel: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <div className="sr12-frame">
      <p className="sr12-frame-title">{title}</p>
      {values ? <p className="fine sr12-frame-values">{withScripts(values)}</p> : null}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        <ArrowMarker />
        {children}
      </svg>
      <p className="fine sr12-frame-caption">{caption}</p>
    </div>
  );
}

export function ChargeCurrentPlot({
  rhoStationary,
  rhoMoving,
  jStationary,
  jMoving,
  lorentzFactor,
  boostFraction,
  mode,
  loopLegChargePos,
  loopLegChargeNeg,
  loopTotal,
  sphereTotalStationary,
  sphereTotalMoving,
}: {
  rhoStationary: PublishedResult | undefined;
  rhoMoving: PublishedResult | undefined;
  jStationary: PublishedResult | undefined;
  jMoving: PublishedResult | undefined;
  lorentzFactor: PublishedResult | undefined;
  boostFraction: number;
  mode: string;
  loopLegChargePos?: PublishedResult | undefined;
  loopLegChargeNeg?: PublishedResult | undefined;
  loopTotal?: PublishedResult | undefined;
  sphereTotalStationary?: PublishedResult | undefined;
  sphereTotalMoving?: PublishedResult | undefined;
}) {
  const gammaValue = scalarOf(lorentzFactor);
  // Geometry only: with no Lorentz factor, nothing is drawn contracted.
  const gamma = gammaValue ?? 1;
  const rho = scalarOf(rhoStationary);
  const rhoPrime = scalarOf(rhoMoving);
  const jx = xComponentOf(jStationary);
  const jxPrime = xComponentOf(jMoving);
  const v = boostFraction.toFixed(2);

  const frameK = "Laboratory frame K";
  const frameMoving = `Frame k, moving at v = ${v}c`;
  const kValues = `ρ = ${shown(rho)} C/m³, J_{x} = ${shown(jx)} A/m²`;
  const movingValues = `ρ′ = ${shown(rhoPrime)} C/m³, J′_{x} = ${shown(jxPrime)} A/m²`;

  let frames: ReactNode;
  if (mode === "neutral-conductor") {
    // The difference between the rows is exaggerated to one charge; its sign follows ρ and ρ′.
    const ionsK = 12;
    const electronsK = ionsK - sign(rho);
    const ionsMoving = Math.max(1, Math.round(12 * gamma));
    const electronsMoving = Math.max(1, ionsMoving - sign(rhoPrime));
    const net = (s: number) =>
      s < 0 ? "a net negative charge" : s > 0 ? "a net positive charge" : "no net charge";
    const movingCaption =
      boostFraction === 0
        ? "With v = 0, frame k is the laboratory frame and nothing changes."
        : `Seen from k, the whole wire moves ${boostFraction > 0 ? "left" : "right"} and both rows close up by γ = ${fixed(gamma, 4)}. ${
            sign(rhoPrime) < 0
              ? "The electrons close up very slightly more than the ions"
              : sign(rhoPrime) > 0
                ? "The electrons close up very slightly less than the ions"
                : "Both rows close up equally"
          }, so the wire carries ${net(sign(rhoPrime))}.${
            sign(rhoPrime) !== sign(rho)
              ? " The drawing exaggerates the difference to one electron; at a real drift speed it is far smaller."
              : ""
          }`;
    frames = (
      <>
        <Frame
          title={frameK}
          values={kValues}
          ariaLabel={`Wire in K: ${ionsK} positive ions and ${electronsK} electrons, evenly spaced`}
          caption={`Ions and electrons are ${sign(rho) === 0 ? "equally spaced, so the wire is neutral" : `unequal in number, so the wire carries ${net(sign(rho))}`}.${
            sign(jx) === 0
              ? " No current flows."
              : ` The electrons drift ${sign(jx) > 0 ? "left, which is a current to the right" : "right, which is a current to the left"}.`
          }`}
        >
          <rect x={4} y={16} width={W - 8} height={78} rx={6} fill="var(--panel)" />
          <ChargeRow n={ionsK} y={40} positive />
          <ChargeRow n={electronsK} y={70} positive={false} />
          <MotionArrow direction={-sign(jx)} y={114} words="electrons drift" />
        </Frame>
        <Frame
          title={frameMoving}
          values={movingValues}
          ariaLabel={`Wire in k: ${ionsMoving} positive ions and ${electronsMoving} electrons in the same length`}
          caption={movingCaption}
        >
          <rect
            x={4}
            y={16}
            width={W - 8}
            height={78}
            rx={6}
            fill="var(--panel)"
            stroke="var(--accent)"
            strokeWidth={1.5}
          />
          <ChargeRow n={ionsMoving} y={40} positive />
          <ChargeRow n={electronsMoving} y={70} positive={false} />
          <MotionArrow direction={-Math.sign(boostFraction)} y={114} words="wire moves" />
        </Frame>
      </>
    );
  } else if (mode === "convection") {
    const positive = sign(rho) >= 0;
    const n = 12;
    const ratio = rho !== null && rhoPrime !== null && rho !== 0 ? rhoPrime / rho : null;
    const nMoving = ratio === null ? n : Math.min(36, Math.max(1, Math.round(n * ratio)));
    frames = (
      <>
        <Frame
          title={frameK}
          values={kValues}
          ariaLabel={`Charge in K: ${n} charges moving along x`}
          caption="A cloud of charge moving along x carries a current J = ρu."
        >
          <line x1={4} x2={W - 4} y1={55} y2={55} stroke="var(--line)" strokeDasharray="4 4" />
          <ChargeRow n={n} y={55} positive={positive} />
          <MotionArrow direction={sign(jx) * sign(rho)} y={100} words="charge moves" />
        </Frame>
        <Frame
          title={frameMoving}
          values={movingValues}
          ariaLabel={`Charge in k: ${nMoving} charges in the same length`}
          caption={
            ratio === null
              ? "The model returned no density to compare."
              : `In k the density is ρ′/ρ = ${fixed(ratio, 3)} times the laboratory's, and the number of charges drawn follows that ratio.`
          }
        >
          <line x1={4} x2={W - 4} y1={55} y2={55} stroke="var(--line)" strokeDasharray="4 4" />
          <ChargeRow n={nMoving} y={55} positive={positive} />
          <MotionArrow
            direction={sign(jxPrime) * sign(rhoPrime)}
            y={100}
            words={sign(jxPrime) === 0 ? "charge at rest" : "charge moves"}
          />
        </Frame>
      </>
    );
  } else if (mode === "moving-sphere") {
    const q = scalarOf(sphereTotalStationary);
    const qPrime = scalarOf(sphereTotalMoving);
    frames = (
      <>
        <Frame
          title={frameK}
          values={`ρ = ${shown(rho)} C/m³`}
          ariaLabel={`Sphere in K with total charge ${shown(q)} coulombs`}
          caption="A sphere at rest in K, charged evenly through its volume."
        >
          <circle
            cx={W / 2}
            cy={56}
            r={46}
            fill="var(--plot)"
            fillOpacity={0.25}
            stroke="var(--plot)"
            strokeWidth={2}
          />
          <text x={W / 2} y={124} textAnchor="middle" style={label}>
            Q = {shown(q)} C
          </text>
        </Frame>
        <Frame
          title={frameMoving}
          values={`ρ′ = ${shown(rhoPrime)} C/m³`}
          ariaLabel={`The same sphere in k, flattened along x, total charge ${shown(qPrime)} coulombs`}
          caption={`In k the sphere is flattened along x by γ = ${fixed(gamma, 4)} and its charge density rises by the same factor, so the total charge is unchanged.`}
        >
          <ellipse
            cx={W / 2}
            cy={56}
            rx={46 / gamma}
            ry={46}
            fill="var(--accent)"
            fillOpacity={0.25}
            stroke="var(--accent)"
            strokeWidth={2}
          />
          <text x={W / 2} y={124} textAnchor="middle" style={label}>
            Q′ = {shown(qPrime)} C
          </text>
        </Frame>
      </>
    );
  } else if (mode === "current-loop") {
    const width = 180;
    frames = (
      <>
        <Frame
          title={frameK}
          values={null}
          ariaLabel="Current loop in K: current along the top and back along the bottom, no charge"
          caption="In K both legs are neutral: current flows round the loop, but no charge sits on it."
        >
          <rect
            x={(W - width) / 2}
            y={30}
            width={width}
            height={62}
            rx={4}
            fill="none"
            stroke="var(--plot)"
            strokeWidth={3}
          />
          <line
            x1={W / 2 - 20}
            y1={30}
            x2={W / 2 + 20}
            y2={30}
            stroke="var(--ink)"
            strokeWidth={2}
            markerEnd="url(#sr12-arrow)"
          />
          <line
            x1={W / 2 + 20}
            y1={92}
            x2={W / 2 - 20}
            y2={92}
            stroke="var(--ink)"
            strokeWidth={2}
            markerEnd="url(#sr12-arrow)"
          />
          <text x={W / 2} y={20} textAnchor="middle" style={label}>
            current I, no charge
          </text>
          <text x={W / 2} y={112} textAnchor="middle" style={label}>
            current I back, no charge
          </text>
          <text x={W / 2} y={65} textAnchor="middle" style={label}>
            Q = 0 C
          </text>
        </Frame>
        <Frame
          title={frameMoving}
          values={null}
          ariaLabel={`Current loop in k: top leg ${shown(scalarOf(loopLegChargePos))} coulombs, bottom leg ${shown(scalarOf(loopLegChargeNeg))} coulombs, total ${shown(scalarOf(loopTotal))} coulombs`}
          caption="In k the loop is shortened along x, and its two legs carry equal and opposite charges. The total is still zero."
        >
          <rect
            x={(W - width / gamma) / 2}
            y={30}
            width={width / gamma}
            height={62}
            rx={4}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={3}
          />
          <text x={W / 2} y={20} textAnchor="middle" style={label}>
            q′ = {shown(scalarOf(loopLegChargePos))} C
          </text>
          <text x={W / 2} y={112} textAnchor="middle" style={label}>
            q′ = {shown(scalarOf(loopLegChargeNeg))} C
          </text>
          <text x={W / 2} y={65} textAnchor="middle" style={label}>
            Q′ = {shown(scalarOf(loopTotal))} C
          </text>
        </Frame>
      </>
    );
  } else {
    // The pulse: a sketch only, two cubic curves shaped like a bell, not an evaluated density. Its
    // numbers are the continuity residuals in the table below.
    const bell = `M 4 100 C ${W / 2 - 60} 100 ${W / 2 - 30} 30 ${W / 2} 30 C ${W / 2 + 30} 30 ${W / 2 + 60} 100 ${W - 4} 100`;
    frames = (
      <>
        <Frame
          title={frameK}
          values={null}
          ariaLabel="A bell-shaped pulse of charge density in K"
          caption="A pulse of charge moving along x. This is a sketch, not drawn to scale."
        >
          <path d={bell} fill="none" stroke="var(--plot)" strokeWidth={2.5} />
          <line x1={4} x2={W - 4} y1={100} y2={100} stroke="var(--line)" />
        </Frame>
        <Frame
          title={frameMoving}
          values={null}
          ariaLabel="The same pulse described from k"
          caption="The same pulse described from k. Charge is conserved in both frames: the continuity residual ∂ρ/∂t + div J in the table below should be zero in each."
        >
          <path d={bell} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
          <line x1={4} x2={W - 4} y1={100} y2={100} stroke="var(--line)" />
        </Frame>
      </>
    );
  }

  return (
    <figure className="sr12-figure">
      <div className="sr12-figure-head">
        <h3>{MODE_TITLES[mode] ?? "Charge and current in two frames"}</h3>
        <p className="fine">
          v = {v}c, γ = {gammaValue === null ? "not computed" : fixed(gammaValue, 4)}
        </p>
      </div>
      <div className="sr12-frames">{frames}</div>
    </figure>
  );
}
