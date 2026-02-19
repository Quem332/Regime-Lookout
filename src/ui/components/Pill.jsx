import { getTagBilingual } from "../../core/tagGlossary";

/**
 * Pill / Chip component.
 * - By default renders a <span>.
 * - If onClick is provided, renders a <button type="button"> so it is truly interactive.
 * - Pass-through props supported (data-*, onClick, className, etc).
 */
export function Pill({
  children,
  tone = "gray",
  label,
  msg,
  lang = "en",
  title,
  className = "",
  onClick,
  ...rest
}) {
  // Display text
  let display = children ?? label ?? "";
  let rawLabel = label ?? "";

  // Defensive: React can't render plain objects.
  // Some callsites pass structured objects (e.g., {level,label,msg}).
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

  const baseCls = `inline-flex items-center px-2.5 py-1 rounded-full border text-xs ${toneMap[tone]} ${className}`.trim();

  // If clickable, use <button> so it actually receives click/tap, focus, etc.
  if (typeof onClick === "function") {
    return (
      <button
        type="button"
        className={baseCls}
        title={tooltip || undefined}
        onClick={onClick}
        // Help nav / tap-to-toggle systems ignore this element as a gesture origin.
        data-no-tap-nav="1"
        data-stop-toggle="1"
        {...rest}
      >
        {display}
      </button>
    );
  }

  return (
    <span className={baseCls} title={tooltip || undefined} {...rest}>
      {display}
    </span>
  );
}
