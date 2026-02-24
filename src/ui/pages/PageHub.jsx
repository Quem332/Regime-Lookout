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
  const tr = (k, fallback) => (typeof t === "function" ? (t(k, fallback) ?? fallback) : fallback);

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
            periods: daily?.periods ?? null,
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
    // Prefer logger dump, but always include a human-readable snapshot so debugging works even if logger is empty.
    const snap = (() => {
      const m = status?.market ?? null;
      const h = status?.health ?? null;
      const tm = status?.timers ?? null;
      const d = daily ?? null;
      const ia = intraday ?? null;

      const lines = [];
      lines.push("== STATUS SNAPSHOT ==");
      if (m) {
        lines.push(`market.label: ${m.label ?? "--"}`);
        lines.push(`market.asOf: ${m.asOf ?? "--"}`);
        lines.push(`market.fetchedAt: ${m.fetchedAt ?? "--"}`);
        lines.push(`market.latencyMin: ${m.latencyMin ?? "--"}`);
      } else {
        lines.push("market: --");
      }
      if (h) {
        lines.push(`health.label: ${h.label ?? "--"}`);
        lines.push(`health.ageMin: ${h.ageMin ?? "--"}`);
        lines.push(`health.lastOkAt: ${h.lastOkAt ?? "--"}`);
        lines.push(`health.lastError: ${h.lastError ?? "--"}`);
      } else {
        lines.push("health: --");
      }
      if (tm) {
        lines.push(`timers.countdown: ${tm.countdown ?? "--:--"}`);
        lines.push(`timers.nextKind: ${tm.nextKind ?? "--"}`);
        lines.push(`timers.nextUpdateInSec: ${tm.nextUpdateInSec ?? "--"}`);
        lines.push(`timers.pollMs: ${tm.pollMs ?? "--"}`);
      } else {
        lines.push("timers: --");
      }
      lines.push(`marketOpen: ${Boolean(status?.marketOpen)}`);

      lines.push("");
      lines.push("== DAILY ==");
      if (d) {
        lines.push(`daily.score: ${d.score ?? "--"}`);
        lines.push(`daily.Cfinal: ${d.Cfinal ?? "--"}`);
        lines.push(`daily.regime7: ${d.regime7 ?? "--"}`);
        lines.push(`daily.topK: ${d.topK ?? "--"}`);
        lines.push(`daily.meta.asOf: ${d.meta?.asOf ?? "--"}`);
        lines.push(`daily.meta.dataHealthLevel: ${d.meta?.dataHealthLevel ?? "--"}`);
      } else {
        lines.push("daily: --");
      }

      lines.push("");
      lines.push("== INTRADAY ==");
      const sc = ia?.scenario ?? ia?.scenarioPack ?? null;
      if (ia) {
        lines.push(`intraday.ts: ${ia.ts ?? ia.meta?.ts ?? "--"}`);
        lines.push(`intraday.zShort: ${ia.zShort ?? "--"}`);
        lines.push(`intraday.corrAvg: ${ia.corrAvg ?? "--"}`);
        lines.push(`intraday.corrSurge: ${ia.corrSurge ?? "--"}`);
        lines.push(`intraday.intervalUsed: ${ia.intervalUsed ?? "--"}`);
        lines.push(`intraday.dataHealthLevel: ${ia.dataHealthLevel ?? ia.meta?.dataHealthLevel ?? "--"}`);
      } else {
        lines.push("intraday: --");
      }
      if (sc) {
        lines.push(`intraday.scenario.Cfinal: ${sc.Cfinal ?? "--"}`);
        lines.push(`intraday.scenario.regime7: ${sc.regime7 ?? "--"}`);
        lines.push(`intraday.scenario.topK: ${sc.topK ?? "--"}`);
      }
      return lines.join("\n");
    })();

    const logTextRaw = (typeof api?.logger?.exportText === "function" && api.logger.exportText()) || "";
    const logText = logTextRaw && logTextRaw.trim().length >= 10 ? logTextRaw : "(logger empty)";

    const text = [
      snap,
      "",
      "== LOGGER ==",
      logText,
      "",
      "== EXPORT PACK ==",
      safeJson(exportPack),
      "",
    ].join("\n");

    openTextModal(tr("hubUi.logsTitle", "Logs"), text);
    api?.logger?.info?.("ui.hub_open_logs", { size: text.length });
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
    if (!ok) alert(tr("hubUi.copyFailed", "Copy failed."));
  };

  const onCopyLogs = async () => {
    const text = modalText || "";
    const ok = await copyToClipboard(text);
    api?.logger?.info?.("ui.hub_copy_logs", { ok, size: text.length });
    if (!ok) alert(tr("hubUi.copyFailed", "Copy failed."));
  };

  const onClearLocal = () => {
    try {
      localStorage.clear();
    } catch {}
    try {
      sessionStorage.clear();
    } catch {}
    api?.logger?.warn?.("ui.hub_clear_storage", { ok: true });
    alert(tr("hubUi.cleared", "Cleared local storage."));
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
            {tr("hubUi.copyExport", "Copy Export")}
          </Pill>
        </div>
      </div>

      <div className="grid gap-3">
        <Card title={tr("hubUi.debugTitle", "Debug")} subtitle={tr("hubUi.debugSub", "Logs / export")}>
          <div className="flex gap-2 flex-wrap">
            <Pill data-stop-toggle="1" onClick={(e) => { e.stopPropagation(); onOpenLogs(); }}>{tr("ui.openLogs", "Open Logs")}</Pill>
            <Pill data-stop-toggle="1" onClick={(e) => { e.stopPropagation(); onClearLocal(); }}>{tr("ui.clearLocal", "Clear Local")}</Pill>
          </div>
          <div className="mt-2 text-xs text-white/60">
            {status?.market?.label ? `SYNC: ${status.market.label}` : ""}
          </div>
        </Card>

        <Card title={tr("hubUi.aboutTitle", "About")} subtitle={tr("hubUi.aboutSub", "Interpretation, not prediction")}>
          <div className="text-sm text-white/70 leading-relaxed">
            {tr(
              "hubUi.aboutText",
              "Informational only. Not financial advice. Use at your own risk. Data may be delayed or unavailable."
            )}
          </div>
        </Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={modalTitle || ""}>
        <div className="flex justify-end gap-2">
          <Pill data-stop-toggle="1" onClick={(e) => { e.stopPropagation(); onCopyLogs(); }}>{tr("hubUi.copy", "Copy")}</Pill>
          <Pill data-stop-toggle="1" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>{tr("hubUi.close", "Close")}</Pill>
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
