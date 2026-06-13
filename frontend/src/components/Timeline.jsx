// 24-hour strip; the recommended [start,end) window is highlighted.
export default function Timeline({ window }) {
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const [start, end] = window || [null, null];
  const inWindow = (h) => start != null && h >= start && h < end;
  return (
    <div>
      <div style={{ display: "flex", gap: 2 }}>
        {hours.map((h) => (
          <div key={h} title={`${h}:00`} style={{ flex: 1, height: 26, borderRadius: 3,
            background: inWindow(h) ? "var(--accent)" : "var(--panel-2)" }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between",
        color: "var(--muted)", fontSize: 11, marginTop: 4 }}>
        <span>00:00</span><span>12:00</span><span>23:00</span>
      </div>
    </div>
  );
}
