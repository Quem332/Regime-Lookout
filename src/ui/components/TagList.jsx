import React from "react";
import { getTagBilingual } from "../../core/tagGlossary";

/**
 * TagList
 * - tags: ["A","B"] or [{text,label,msg,tone,level}] 모두 지원
 * - tone: "good" | "warn" | "bad" | "neutral"
 * - level: "green" | "yellow" | "red"  (engine output)
 */
export function TagList({ tags = [], title = null, lang = "en" }) {
  const items = Array.isArray(tags) ? tags : [];
  const titleFinal = title || (lang === "ko" ? "태그" : "Reasoning Tags");

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

  const norm = items
    .map(normalize)
    .filter((x) => x && x.text && x.text !== "undefined");

  // Deduplicate by displayed label (after bilingual mapping), to prevent "double tags"
  const unique = Array.from(
    new Map(
      norm.map((t) => {
        const bi = getTagBilingual({ label: t.text, msg: t.msg, ...(t.raw || {}) });
        const label = lang === "ko" ? bi.koLabel : bi.enLabel;
        const key = (label || "").toString().replace(/^[^\w\u3131-\uD79D]+\s*/, "").trim();
        return [key || label || t.text, { ...t, bi }];
      })
    ).values()
  );

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {titleFinal ? (
        <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>
          {titleFinal}
        </div>
      ) : null}

      {unique.length === 0 ? (
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {lang === "ko" ? "태그 없음" : "No tags"}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {unique.map((t, i) => {
            const bi = t.bi;
            const titleText =
              (lang === "ko" ? (bi.koMsg || bi.enMsg) : (bi.enMsg || bi.koMsg)) || "";
            return (
              <span
                key={`${lang === "ko" ? bi.koLabel : bi.enLabel}-${i}`}
                style={chipStyle(t.tone)}
                title={titleText || undefined}
              >
                {lang === "ko" ? bi.koLabel : bi.enLabel}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TagList;
