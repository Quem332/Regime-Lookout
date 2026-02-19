import React, { useMemo, useState } from "react";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { Modal } from "../components/Modal";

// Hub: debug + settings. Must never crash even if api is partial.

function safeJson(x) {
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text || "");
    return true;
  } catch {
    // Fallback
    try {
      const ta = document.createElement("textarea");
      ta.value = text || "";
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return Boolean(ok);
    } catch {
      return false;
    }
  }
}

export function PageHub({ api, t, lang, onToggleLang }) {
  const hubTitle = t?.("hub.title", "Hub") ?? "Hub";

  const [open, setOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalText, setModalText] = useState("");

  const mri = api?.mri ?? null;
  const daily = mri?.daily ?? null;
  const intraday = mri?.intraday ?? null;
  const status = mri?.status ?? null;

  const exportPack = useMemo(() => {
    // This is what we copy for debugging / sharing.
    // Keep it stable and null-safe.
    return {
      schema: status?.health?.schema ?? null,
      market: status?.market ?? null,
      health: status?.health ?? null,
      timers: status?.timers ?? null,
      marketOpen: Boolean(status?.marketOpen),
      eventWindow: status?.eventWindow ?? null,
      daily: daily
        ? {
            score: daily?.score ?? null,
            Cfinal: daily?.Cfinal ?? null,
            regime7: daily?.regime7 ?? null,
            topK: daily?.topK ?? null,
            probs: daily?.probs ?? null,
            tags: daily?.tags ?? null,
            V: daily?.V ?? null,
            meta: daily?.meta ?? null,
          }
        : null,
      intraday,
      ts: new Date().toISOString(),
      lang: lang ?? null,
    };
  }, [daily, intraday, status, lang]);

  const openTextModal = (title, text) => {
    setModalTitle(title);
    setModalText(text || "");
    setOpen(true);
  };

  const onOpenLogs = () => {
    const logText =
      (typeof api?.logger?.exportText === "function" && api.logger.exportText()) ||
      "(logger.exportText unavailable)";
    openTextModal("Logs", logText);
    api?.logger?.info?.("ui.hub_open_logs", { size: logText.length });
  };

  const onCopyExport = async () => {
    // Copy full pack (not just score)
    const text = [
      "Regime-Lookout Export",
      `lang=${lang ?? "--"}`,
      "",
      safeJson(exportPack),
      "",
    ].join("\n");

    const ok = await copyToClipboard(text);
    api?.logger?.info?.("ui.hub_copy_export", { ok, size: text.length });
    if (!ok) alert("Copy failed.");
  };

  const onCopyLogs = async () => {
    const text = modalText || "";
    const ok = await copyToClipboard(text);
    api?.logger?.info?.("ui.hub_copy_logs", { ok, size: text.length });
    if (!ok) alert("Copy failed.");
  };

  const onClearLocal = () => {
    try {
      localStorage.clear();
    } catch {}
    try {
      sessionStorage.clear();
    } catch {}
    api?.logger?.warn?.("ui.hub_clear_storage", { ok: true });
    alert("Cleared local storage.");
  };

  return (
    <div className="px-4 pb-6" style={{ touchAction: "pan-y" }}>
      {/* No duplicate title here; top bar already shows HUB */}

      <div className="flex items-center justify-between mb-3">
        <div />
        <div className="flex items-center gap-2">
          <Pill data-stop-toggle="1" onClick={(e) => { e.stopPropagation(); onToggleLang?.(); }}>
            {t?.("ui.langToggle", "K/E") ?? "K/E"}
          </Pill>
          <Pill data-stop-toggle="1" onClick={(e) => { e.stopPropagation(); onCopyExport(); }}>
            Copy Export
          </Pill>
        </div>
      </div>

      <div className="grid gap-3">
        <Card title="Debug" subtitle="Logs / export">
          <div className="flex gap-2 flex-wrap">
            <Pill data-stop-toggle="1" onClick={(e) => { e.stopPropagation(); onOpenLogs(); }}>Open Logs</Pill>
            <Pill data-stop-toggle="1" onClick={(e) => { e.stopPropagation(); onClearLocal(); }}>Clear Local</Pill>
          </div>
          <div className="mt-2 text-xs text-white/60">
            {status?.market?.label ? `SYNC: ${status.market.label}` : ""}
          </div>
        </Card>

        <Card title="About" subtitle="Interpretation, not prediction">
          <div className="text-sm text-white/70 leading-relaxed">
            Informational only. Not financial advice. Use at your own risk. Data may be delayed or unavailable.
          </div>
        </Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={modalTitle || ""}>
        <div className="flex justify-end gap-2">
          <Pill data-stop-toggle="1" onClick={(e) => { e.stopPropagation(); onCopyLogs(); }}>Copy</Pill>
          <Pill data-stop-toggle="1" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>Close</Pill>
        </div>

        <pre
          className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10 text-xs leading-snug"
          style={{ whiteSpace: "pre-wrap" }}
        >
          {modalText}
        </pre>
      </Modal>
    </div>
  );
}
