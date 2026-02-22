import React from "react";
import { getTagBilingual } from "../../core/tagGlossary";

/**
 * TagList
 * - tags: ["A","B"] or [{text,label,msg,tone,level}] 모두 지원
 * - tone: "good" | "warn" | "bad" | "neutral"
 * - level: "green" | "yellow" | "red"  (engine output)
 */
export function TagList({ tags = [], title = "Reasoning Tags", lang = "en" }) {
  const items = Array.isArray(tags) ? tags : [];

  const levelToTone = (lvl) => {
    if (lvl === "green") return "good";
    if (lvl === "yellow") return "warn";
    if (lvl === "red") return "bad";
    return null;
  };

  const normalize = (t) => {
    if (typeof t === "string") return { text: t, tone: "neutral", msg: "" };
    if (t && typeof t === "object") {
      const text = t.text ?? t.label ?? String(t);
      const tone = t.tone ?? levelToTone(t.level) ?? t.level ?? "neutral";
      const msg = t.msg ?? t.hint ?? "";
      return { text, tone, msg, raw: t };
    }
    return { text: String(t), tone: "neutral", msg: "" };
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

  // de-dupe by label (after bilingual mapping) so the same tag doesn't show twice
  const unique = [];
  const seen = new Set();
  for (const x of norm) {
    const bi = getTagBilingual({ label: x.text, msg: x.msg, ...(x.raw || {}) });
    const key = `${bi.enLabel || ""}__${bi.koLabel || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...x, bi });
  }

  const order = ["bad", "warn", "neutral", "good"];
  const grouped = order
    .map((tone) => ({ tone, items: unique.filter((x) => x.tone === tone) }))
    .filter((g) => g.items.length);

  const toneLabel = (tone) => {
    if (lang === "ko") {
      if (tone === "bad") return "주의(중요)";
      if (tone === "warn") return "경고";
      if (tone === "neutral") return "참고";
      if (tone === "good") return "완화";
      return "태그";
    }
    if (tone === "bad") return "High priority";
    if (tone === "warn") return "Warnings";
    if (tone === "neutral") return "Info";
    if (tone === "good") return "Stabilizers";
    return "Tags";
  };


  return (
    <div style={{ display: "grid", gap: 10 }}>
      {title ? (
        <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>
          {title}
        </div>
      ) : null}

      {unique.length === 0 ? (
        <div style={{ fontSize: 12, opacity: 0.7 }}>No tags available.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {grouped.map((g) => (
            <div key={g.tone} style={{ display: "grid", gap: 6 }}>
              {grouped.length > 1 ? (
                <div style={{ fontSize: 11, opacity: 0.65, letterSpacing: 0.2 }}>{toneLabel(g.tone)}</div>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {g.items.map((t, i) => {
                  const titleText = (lang === "ko" ? (t.bi.koMsg || t.bi.enMsg) : (t.bi.enMsg || t.bi.koMsg)) || "";
                  return (
                    <span
                      key={`${lang === "ko" ? t.bi.koLabel : t.bi.enLabel}-${i}`}
                      style={chipStyle(t.tone)}
                      title={titleText || undefined}
                    >
                      {lang === "ko" ? t.bi.koLabel : t.bi.enLabel}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TagList;
