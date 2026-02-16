import React, { useEffect, useMemo, useState } from "react";
import { logger } from "../../core/logger";

function formatRow(e) {
  const data = e.data == null ? "" : (() => {
    try {
      return JSON.stringify(e.data);
    } catch {
      return "[unserializable]";
    }
  })();
  return `${e.ts} [${e.level}] ${e.event}${data ? ` — ${data}` : ""}`;
}

export function DebugPanel() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem("mri_debug_open") === "1";
    } catch {
      return false;
    }
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsub = logger.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("mri_debug_open", open ? "1" : "0");
    } catch {}
  }, [open]);

  const logs = useMemo(() => logger.getLogs(), [tick]);
  const last = logs.slice(-80).reverse();

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold flex items-center gap-2">
          <span className="text-gray-400" aria-hidden>\uD83D\uDC1B</span>
          Debug Logs
        </div>
        <button
          className="text-xs px-3 py-1 rounded-full border border-gray-700 bg-gray-900 text-gray-200"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      <div className="text-xs text-gray-400 mb-3">
        Logs are kept in-memory (ring buffer). Recent WARN/ERROR are also persisted so you can reload after a crash and still export them.
      </div>

      {open && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <button
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border bg-gray-900 text-gray-200 border-gray-700"
              onClick={async () => {
                const text = logger.exportText();
                try {
                  await navigator.clipboard.writeText(text);
                  logger.info("debug.copy_logs", { size: text.length });
                } catch (e) {
                  logger.warn("debug.copy_failed", { message: String(e) });
                }
              }}
            >
              <span aria-hidden>\u2398</span>
              Copy
            </button>
            <button
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border bg-gray-900 text-gray-200 border-gray-700"
              onClick={() => logger.downloadText()}
            >
              <span aria-hidden>⬇</span>
              Download
            </button>
            <button
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border bg-gray-900 text-gray-200 border-gray-700"
              onClick={() => {
                logger.clear();
                logger.info("debug.clear_logs");
              }}
            >
              <span aria-hidden>\u2716</span>
              Clear
            </button>

            <div className="ml-auto text-xs text-gray-500">Stored: {logs.length}</div>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 max-h-64 overflow-auto">
            {last.length === 0 ? (
              <div className="text-xs text-gray-500">No logs yet.</div>
            ) : (
              <pre className="text-[10px] text-gray-200 whitespace-pre-wrap break-words">
                {last.map(formatRow).join("\n\n")}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}
