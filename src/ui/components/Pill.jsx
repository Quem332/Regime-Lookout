export function Pill({ children, tone = "gray" }) {
  let content = children;
  // Defensive: React can't render plain objects.
  // Some callsites pass structured objects (e.g., {level,label,msg}).
  if (content && typeof content === "object") {
    if ("msg" in content) content = content.msg;
    else if ("label" in content) content = content.label;
    else content = JSON.stringify(content);
  }
  const toneMap = {
    gray: "bg-gray-800 text-gray-200 border-gray-700",
    red: "bg-red-500 bg-opacity-15 text-red-300 border-red-500 border-opacity-40",
    yellow: "bg-yellow-500 bg-opacity-15 text-yellow-200 border-yellow-500 border-opacity-40",
    green: "bg-green-500 bg-opacity-15 text-green-200 border-green-500 border-opacity-40",
    blue: "bg-blue-500 bg-opacity-15 text-blue-200 border-blue-500 border-opacity-40",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs ${toneMap[tone]}`}>
      {content}
    </span>
  );
}

