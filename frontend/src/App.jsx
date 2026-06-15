import { useState } from "react";
import LiveMonitoring from "./screens/LiveMonitoring.jsx";
import IrrigationTiming from "./screens/IrrigationTiming.jsx";

const STAGES = ["none", "small_medium", "mature"];

export default function App() {
  const [tab, setTab] = useState("live");
  const [stage, setStage] = useState("small_medium");

  return (
    <div className="app">
      <header className="brand">
        <h1>🍄 SpotShrooms</h1>
        <span className="tag">Eyes on every mushroom, anytime, anywhere</span>
      </header>

      <div className="row" style={{ alignItems: "center", marginTop: 12 }}>
        <div className="tabs">
          <button className={`tab ${tab === "live" ? "active" : ""}`}
            onClick={() => setTab("live")}>Live Monitoring</button>
          <button className={`tab ${tab === "timing" ? "active" : ""}`}
            onClick={() => setTab("timing")}>Irrigation Timing</button>
        </div>
        <label style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 13 }}>
          Stage&nbsp;
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {tab === "live" && <LiveMonitoring stage={stage} />}
      {tab === "timing" && <IrrigationTiming stage={stage} />}
    </div>
  );
}
