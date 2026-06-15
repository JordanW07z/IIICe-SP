import { useEffect, useState } from "react";

export default function DetectionResults() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetch("/api/results")
      .then((r) => r.json())
      .then((body) => { setImages(body.images || []); setLoading(false); })
      .catch((e) => { setErr(e.message); setLoading(false); });
  }, []);

  if (loading) return <p style={{ color: "var(--muted)" }}>Loading results…</p>;
  if (err) return <p className="offline">⚠ Could not load results: {err}</p>;
  if (images.length === 0)
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <p style={{ color: "var(--muted)" }}>
          No detection results found. Run the notebook and make sure
          <code> detection_results/</code> is in the same folder you start the API from.
        </p>
      </div>
    );

  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
        {images.length} image{images.length !== 1 ? "s" : ""} from notebook detection run
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {images.map((img) => (
          <div key={img.name} className="card" style={{ padding: 8 }}>
            <img
              src={img.src}
              alt={img.name}
              style={{ width: "100%", borderRadius: 6, display: "block" }}
            />
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, textAlign: "center" }}>
              {img.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
