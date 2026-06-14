import { useEffect, useState } from "react";

// Upload a real mushroom photo → POST it to the FastAPI /api/detect endpoint, which runs
// the actual YOLOv8 model → draw the returned water/don't-water boxes over the image.
// This is the real model's function living inside the frontend (vs the synthetic live feed).
const COLORS = { water: "var(--water)", dont_water: "var(--dont)" };

export default function DetectUpload() {
  const [status, setStatus] = useState(null);
  const [imgUrl, setImgUrl] = useState(null);
  const [dets, setDets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetch("/api/detect/status").then((r) => r.json()).then(setStatus).catch(() => {});
  }, []);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setDets([]); setBusy(true);
    setImgUrl(URL.createObjectURL(file));
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/detect", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      const body = await res.json();
      setDets(body.detections || []);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Run YOLOv8 on a photo</h3>
      {status && !status.available && (
        <p className="offline">⚠ Real YOLO inactive: {status.status}</p>
      )}
      <input type="file" accept="image/*" onChange={onFile} aria-label="upload mushroom photo" />
      {busy && <p className="badge" style={{ marginTop: 8 }}>Running detection…</p>}
      {err && <p className="offline">{err}</p>}
      {imgUrl && (
        <div style={{ position: "relative", display: "inline-block", marginTop: 12,
          maxWidth: "100%" }}>
          <img src={imgUrl} alt="uploaded shelf" style={{ maxWidth: "100%", borderRadius: 8,
            display: "block" }} />
          {dets.map((d, i) => {
            const [x, y, w, h] = d.box;
            return (
              <div key={i} style={{ position: "absolute", left: `${x * 100}%`,
                top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`,
                border: `2px solid ${COLORS[d.label] || "#fff"}`, borderRadius: 4 }}>
                <span style={{ position: "absolute", top: -18, left: 0, fontSize: 11,
                  background: COLORS[d.label] || "#444", padding: "1px 4px", borderRadius: 3,
                  whiteSpace: "nowrap" }}>
                  {d.label} {d.confidence?.toFixed(2)}
                </span>
              </div>
            );
          })}
          {imgUrl && !busy && dets.length === 0 && !err && status?.available && (
            <p className="badge" style={{ marginTop: 8 }}>No mushrooms detected.</p>
          )}
        </div>
      )}
    </div>
  );
}
