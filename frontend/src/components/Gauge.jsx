// A simple horizontal gauge with the safe band shaded and the current value marked.
export default function Gauge({ label, value, unit, min, max, bandLow, bandHigh }) {
  const clamp = (v) => Math.max(min, Math.min(max, v));
  const pct = (v) => ((clamp(v) - min) / (max - min)) * 100;
  const inBand = bandLow != null && value >= bandLow && value <= bandHigh;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span style={{ color: "var(--muted)" }}>{label}</span>
        <span style={{ color: inBand ? "var(--accent)" : "var(--warn)" }}>
          {value?.toFixed(1)}{unit}
        </span>
      </div>
      <div style={{ position: "relative", height: 10, background: "var(--panel-2)",
        borderRadius: 6, marginTop: 6, overflow: "hidden" }}>
        {bandLow != null && (
          <div style={{ position: "absolute", left: `${pct(bandLow)}%`,
            width: `${pct(bandHigh) - pct(bandLow)}%`, top: 0, bottom: 0,
            background: "rgba(76,175,80,0.25)" }} />
        )}
        <div style={{ position: "absolute", left: `${pct(value)}%`, top: -2, bottom: -2,
          width: 3, background: inBand ? "var(--accent)" : "var(--warn)" }} />
      </div>
    </div>
  );
}
