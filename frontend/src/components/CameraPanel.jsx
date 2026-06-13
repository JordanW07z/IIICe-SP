// CSS-rendered "camera frame" with normalized detection boxes overlaid.
// No external image needed (and no YOLO weights in this repo) — green = water, red = don't-water.
const COLORS = { water: "var(--water)", dont_water: "var(--dont)" };

export default function CameraPanel({ shelf }) {
  return (
    <div style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: 10,
      overflow: "hidden", border: "1px solid var(--line)",
      background: "repeating-linear-gradient(135deg, #11160f, #11160f 12px, #141b12 12px, #141b12 24px)" }}>
      <div className="badge" style={{ position: "absolute", top: 8, left: 8, zIndex: 2 }}>
        Shelf {shelf.id} · {shelf.stage}
      </div>
      {shelf.detections.map((d, i) => {
        const [x, y, w, h] = d.box;
        return (
          <div key={i} data-testid="det-box" className={`box-${d.label}`}
            style={{ position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`,
              width: `${w * 100}%`, height: `${h * 100}%`,
              border: `2px solid ${COLORS[d.label] || "#fff"}`, borderRadius: 4 }}>
            <span style={{ position: "absolute", top: -18, left: 0, fontSize: 11,
              background: COLORS[d.label], padding: "1px 4px", borderRadius: 3,
              whiteSpace: "nowrap" }}>
              {d.label} {d.confidence.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
