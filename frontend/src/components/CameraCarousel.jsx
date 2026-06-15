import { useEffect, useState } from "react";

const STAGE_COLORS = {
  mature: "var(--water)",
  small_medium: "var(--dont)",
  none: "var(--muted)",
  unknown: "var(--muted)",
};

const STAGE_ORDER = ["none", "small_medium", "mature", "unknown"];

export default function CameraCarousel({ ambient }) {
  const [images, setImages] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/results")
      .then((r) => r.json())
      .then((b) => {
        // Sort images by stage order
        const sorted = (b.images || []).slice().sort((a, b) =>
          STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage)
        );
        setImages(sorted);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "var(--muted)" }}>Loading camera scans…</p>;

  if (images.length === 0)
    return (
      <div style={{ aspectRatio: "4 / 3", borderRadius: 10, border: "1px solid var(--line)",
        background: "repeating-linear-gradient(135deg, #11160f, #11160f 12px, #141b12 12px, #141b12 24px)",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          No scan images yet — run the notebook to generate detection_results/
        </p>
      </div>
    );

  const image = images[idx];
  const total = images.length;
  const stageColor = STAGE_COLORS[image.stage] || "var(--muted)";

  function prev() { setIdx((i) => (i - 1 + total) % total); }
  function next() { setIdx((i) => (i + 1) % total); }

  return (
    <div>
      <div style={{ position: "relative", borderRadius: 10, overflow: "hidden",
        border: "1px solid var(--line)" }}>

        <img src={image.src} alt={image.name}
          style={{ width: "100%", display: "block", borderRadius: 10 }} />

        {/* Stage badge */}
        <div style={{ position: "absolute", top: 8, left: 8, zIndex: 2,
          background: stageColor, color: "#fff", borderRadius: 8,
          padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
          {image.stage}
        </div>

        {/* Scan counter */}
        <div className="badge" style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}>
          Scan {idx + 1} / {total}
        </div>

        {/* Arrows */}
        <button onClick={prev} style={arrowStyle("left")}>&#8249;</button>
        <button onClick={next} style={arrowStyle("right")}>&#8250;</button>

        {/* Dot indicators */}
        <div style={{ position: "absolute", bottom: 8, left: "50%",
          transform: "translateX(-50%)", display: "flex", gap: 6, zIndex: 2 }}>
          {images.map((img, i) => (
            <div key={i} onClick={() => setIdx(i)} style={{
              width: 8, height: 8, borderRadius: "50%", cursor: "pointer",
              background: i === idx ? STAGE_COLORS[img.stage] : "var(--line)",
              border: "1px solid var(--muted)",
            }} />
          ))}
        </div>
      </div>

      {/* Info row below image */}
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <div className="badge">{image.name}</div>
        {ambient && (
          <div className="badge">{ambient.temp}°C · {ambient.rh}% RH</div>
        )}
        <div className="badge" style={{ color: stageColor }}>
          {image.stage === "small_medium" && "⛔ Don't water"}
          {image.stage === "mature" && "💧 Water"}
          {image.stage === "none" && "— No mushrooms"}
          {image.stage === "unknown" && "? Stage unknown"}
        </div>
      </div>
    </div>
  );
}

function arrowStyle(side) {
  return {
    position: "absolute", top: "50%", [side]: 8,
    transform: "translateY(-50%)",
    background: "rgba(0,0,0,0.5)", border: "none", color: "#fff",
    fontSize: 28, borderRadius: 6, cursor: "pointer", zIndex: 2,
    padding: "2px 10px", lineHeight: 1,
  };
}
