import React from "react";

/**
 * TagList
 * - tags: ["A","B"] or [{text, tone}] 모두 지원
 * - tone: "good" | "warn" | "bad" | "neutral"
 */
export function TagList({ tags = [], title = "Reasoning Tags" }) {
  const items = Array.isArray(tags) ? tags : [];

  const normalize = (t) => {
    if (typeof t === "string") return { text: t, tone: "neutral" };
    if (t && typeof t === "object") {
      const text = t.text ?? t.label ?? String(t);
      const tone = t.tone ?? t.level ?? "neutral";
      return { text, tone };
    }
    return { text: String(t), tone: "neutral" };
  };

  const chipStyle = (tone) => {
    const base = {
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 12,
      lineHeight: 1,
      border: "1px solid rgba(255,255,255,0.15)",
      background: "rgba(255,255,255,0.06)",
      color: "rgba(255,255,255,0.92)",
      whiteSpace: "nowrap",
    };

    if (tone === "good")
      return {
        ...base,
        borderColor: "rgba(120,255,200,0.35)",
        background: "rgba(120,255,200,0.10)",
      };
    if (tone === "warn")
      return {
        ...base,
        borderColor: "rgba(255,220,120,0.35)",
        background: "rgba(255,220,120,0.10)",
      };
    if (tone === "bad")
      return {
        ...base,
        borderColor: "rgba(255,120,120,0.35)",
        background: "rgba(255,120,120,0.10)",
      };

    return base;
  };

  const norm = items.map(normalize).filter((x) => x.text && x.text !== "undefined");

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {title ? (
        <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>
          {title}
        </div>
      ) : null}

      {norm.length === 0 ? (
        <div style={{ fontSize: 12, opacity: 0.7 }}>No tags available.</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {norm.map((t, i) => (
            <span key={`${t.text}-${i}`} style={chipStyle(t.tone)}>
              {t.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default TagList;
