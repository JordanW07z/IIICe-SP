import { getLive, getConfig } from "../api.js";
import { usePolling } from "../usePolling.js";
import { useEffect, useState } from "react";
import CameraPanel from "../components/CameraPanel.jsx";
import Gauge from "../components/Gauge.jsx";

export default function LiveMonitoring({ stage }) {
  const { data, error } = usePolling(getLive, 3000, []);
  const [cfg, setCfg] = useState(null);
  useEffect(() => { getConfig().then(setCfg).catch(() => {}); }, []);

  if (!data) return <p style={{ color: "var(--muted)" }}>Connecting to sensors…</p>;
  const band = cfg?.stages?.[stage] || {};
  const m = data.model_metrics;

  return (
    <div>
      {error && <p className="offline">⚠ Sensor/camera offline — showing last reading.</p>}
      <div className="row">
        <div className="card" style={{ flex: 2 }}>
          <h3>Camera — YOLO detection</h3>
          <div className="row">
            {data.shelves.map((s) => (
              <div key={s.id} style={{ flex: 1, minWidth: 220 }}>
                <CameraPanel shelf={s} />
                <div className="badge" style={{ marginTop: 6 }}>
                  {s.temp}°C · {s.rh}% RH
                </div>
              </div>
            ))}
          </div>
          <p className="badge" style={{ marginTop: 12 }}>
            Model — Precision {m.precision} · Recall {m.recall} · Accuracy {m.accuracy}
          </p>
        </div>
        <div className="card">
          <h3>Ambient climate</h3>
          <Gauge label="Temperature" value={data.ambient.temp} unit="°C"
            min={15} max={40} bandLow={band.temp_min} bandHigh={band.temp_max} />
          <Gauge label="Humidity" value={data.ambient.rh} unit="%"
            min={50} max={100} bandLow={band.rh_min} bandHigh={band.rh_max} />
          <p className="badge">Updated {data.timestamp}</p>
        </div>
      </div>
    </div>
  );
}
