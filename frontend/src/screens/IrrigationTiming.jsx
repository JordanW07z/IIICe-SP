import { useCallback } from "react";
import { getTiming } from "../api.js";
import { usePolling } from "../usePolling.js";
import Timeline from "../components/Timeline.jsx";

function fmtWindow(w) {
  if (!w || !w.window) return "No suitable window today";
  const [a, b] = w.window;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(a)}:00 – ${pad(b)}:00`;
}

export default function IrrigationTiming({ stage }) {
  const fetcher = useCallback(() => getTiming(stage), [stage]);
  const { data, error } = usePolling(fetcher, 4000, [stage]);

  if (!data) return <p style={{ color: "var(--muted)" }}>Asking the irrigation AI…</p>;
  const { live, best_window, optimum, now } = data;
  const go = live.irrigate;

  return (
    <div>
      {error && <p className="offline">⚠ API offline — showing last decision.</p>}
      <div className="row">
        <div className="card" style={{ flex: 1.2 }}>
          <h3>Decision now</h3>
          <div style={{ fontSize: 40, fontWeight: 700,
            color: go ? "var(--accent)" : "var(--warn)" }}>
            {go ? "IRRIGATE NOW" : "WAIT"}
          </div>
          <p style={{ color: "var(--muted)" }}>{live.reason}</p>
          <p className="badge">Now: {now.temp}°C · {now.rh}% RH ·
            growth gain {live.growth_gain.toFixed(3)}</p>
        </div>
        <div className="card">
          <h3>Identified optimum ({stage})</h3>
          <div style={{ fontSize: 22 }}>{optimum.temp}°C · {optimum.rh}% RH</div>
          <p className="badge">predicted growth {optimum.growth.toFixed(2)}</p>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Recommended watering window</h3>
        <div style={{ fontSize: 20, marginBottom: 10 }}>{fmtWindow(best_window)}</div>
        <Timeline window={best_window?.window} />
      </div>
    </div>
  );
}
