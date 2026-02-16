import React from "react";

export function Gauge({
  value = 0,
  min = 0,
  max = 100,
  size = 160,
  stroke = 12,
  label = "Today Score",
  sublabel = "",
}) {
  const v = Number.isFinite(value) ? value : 0;
  const clamped = Math.max(min, Math.min(max, v));
  const pct = (clamped - min) / (max - min || 1);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;

  return (
    <div style={{ display: "grid", placeItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(120,200,255,0.95)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            padding: 12,
          }}
        >
          <div style={{ fontSize: 34, fontWeight: 800 }}>
            {Math.round(clamped)}
          </div>
          <div style={{ opacity: 0.85, fontSize: 12 }}>{label}</div>
          {sublabel ? (
            <div style={{ opacity: 0.65, fontSize: 11 }}>{sublabel}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default Gauge;
