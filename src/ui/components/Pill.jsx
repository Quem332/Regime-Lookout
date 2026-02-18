import React from "react";
import { getTagBilingual } from "../../core/tagGlossary";

export function Pill({
  children,
  tone = "gray",
  label,
  msg,
  lang = "en",
  title,
  onClick,
  className = "",
  ...rest
}) {
  // Display text
  let display = children ?? label ?? "";
  let rawLabel = label ?? "";

  // Defensive: React can't render plain objects.
  let rawMsg = msg ?? "";
  if (display && typeof display === "object") {
    const obj = display;
    rawLabel = obj.label ?? obj.text ?? "";
    rawMsg = obj.msg ?? obj.hint ?? rawMsg ?? "";
    display = obj.label ?? obj.text ?? obj.msg ?? JSON.stringify(obj);
  } else {
    rawLabel = rawLabel || String(display ?? "");
  }

  const toneMap = {
    gray: "bg-gray-800 text-gray-200 border-gray-700",
    red: "bg-red-500 bg-opacity-15 text-red-300 border-red-500 border-opacity-40",
    yellow: "bg-yellow-500 bg-opacity-15 text-yellow-200 border-yellow-500 border-opacity-40",
    green: "bg-green-500 bg-opacity-15 text-green-200 border-green-500 border-opacity-40",
    blue: "bg-blue-500 bg-opacity-15 text-blue-200 border-blue-500 border-opacity-40",
  };

  // Optional tooltip for tags
  let tooltip = title ?? "";
  if (!tooltip && (rawMsg || rawLabel)) {
    const bi = getTagBilingual({ label: rawLabel, msg: rawMsg });
    tooltip = lang === "ko" ? (bi.koMsg || bi.enMsg || rawMsg) : (bi.enMsg || rawMsg || bi.koMsg);
  }

  const base =
    `inline-flex items-center px-2.5 py-1 rounded-full border text-xs ${toneMap[tone] || toneMap.gray} ${className}`;

  // Important: if clickable, use <button> so it actually works on mobile.
  if (typeof onClick === "function") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={base + " cursor-pointer"}
        title={tooltip || undefined}
        data-stop-toggle="1"
        data-no-tap-nav="1"
        {...rest}
      >
        {display}
      </button>
    );
  }

  return (
    <span className={base} title={tooltip || undefined} {...rest}>
      {display}
    </span>
  );
}
