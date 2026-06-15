import { useEffect, useState } from "react";

const COLORS = { water: "var(--water)", dont_water: "var(--dont)" };

export default function CameraCarousel({ shelves }) {
  const [idx, setIdx] = useState(0);
  const [images, setImages] = useState([]);

  useEffect(() => {
    fetch("/api/results")
      .then((r) => r.json())
      .then((b) => setImages(b.images || []))
      .catch(() => {});
  }, []);

  const shelf = shelves[idx];
  const image = images[idx];
  const total = shelves.length;

  function prev() { setIdx((i) => (i - 1 + total) % total); }
  function next() { setIdx((i) => (i + 1) % total); }

  return (
    <div>
      <div style={{ position: "relative", borderRadius: 10, overflow: "hidden",
        border: "1px solid var(--line)", background: "#11160f",
        aspectRatio: image ? "auto" : "4 / 3" }}>

        {/* Real detection image if available, else dark placeholder */}
        {image
          ? <img src={image.src} alt={image.name}
              style={{ width: "100%", display: "block", borderRadius: 10 }} />
          : <div style={{ aspectRatio: "4 / 3",
              background: "repeating-linear-gradient(135deg, #11160f, #11160f 12px, #141b12 12px, #141b12 24px)" }} />
        }

        {/* Shelf badge */}
        <div className="badge" style={{ position: "absolute", top: 8, left: 8, zIndex: 2 }}>
          Shelf {shelf.id} · {shelf.stage}
        </div>

        {/* YOLO bounding boxes (from mock or real API) */}
        {!image && shelf.detections.map((d, i) => {
          const [x, y, w, h] = d.box;
          return (
            <div key={i} style={{ position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`,
              width: `${w * 100}%`, height: `${h * 100}%`,
              border: `2px solid ${COLORS[d.label] || "#fff"}`, borderRadius: 4 }}>
              <span style={{ position: "absolute", top: -18, left: 0, fontSize: 11,
                background: COLORS[d.label], padding: "1px 4px", borderRadius: 3,
                whiteSpace: "nowrap" }}>
                {d.label} {d.confidence?.toFixed(2)}
              </span>
            </div>
          );
        })}

        {/* Prev / Next arrows */}
        <button onClick={prev} style={arrowStyle("left")}>&#8249;</button>
        <button onClick={next} style={arrowStyle("right")}>&#8250;</button>

        {/* Dot indicators */}
        <div style={{ position: "absolute", bottom: 8, left: "50%",
          transform: "translateX(-50%)", display: "flex", gap: 6, zIndex: 2 }}>
          {shelves.map((_, i) => (
            <div key={i} onClick={() => setIdx(i)} style={{
              width: 8, height: 8, borderRadius: "50%", cursor: "pointer",
              background: i === idx ? "var(--accent)" : "var(--line)",
              border: "1px solid var(--muted)"
            }} />
          ))}
        </div>
      </div>

      {/* Temp / RH below image */}
      <div className="badge" style={{ marginTop: 8, display: "block", textAlign: "center" }}>
        {shelf.temp}°C · {shelf.rh}% RH
        {image && <span style={{ marginLeft: 8, color: "var(--accent)" }}>{image.name}</span>}
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
    padding: "2px 10px", lineHeight: 1
  };
}
