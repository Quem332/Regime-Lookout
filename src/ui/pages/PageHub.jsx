import React, { useMemo, useState } from "react";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { Modal } from "../components/Modal";
import { logger } from "../../core/logger";
import { I18N, createT } from "../../core/i18n";

function getStoredLang() {
  try {
    return localStorage.getItem("mri_lang") || null;
  } catch {
    return null;
  }
}
function setStoredLang(lang) {
  try {
    localStorage.setItem("mri_lang", lang);
  } catch {}
}
function detectLang() {
  try {
    const l = (navigator.language || "en").toLowerCase();
    return l.startsWith("ko") ? "ko" : "en";
  } catch {
    return "en";
  }
}

function fmtNum(x, d = 2) {
  return typeof x === "number" && Number.isFinite(x) ? x.toFixed(d) : "--";
}

async function copyToClipboard(text) {
  const t = text || "";
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    // Fallback (older browsers)
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.setAttribute("readonly", "true");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function PageHub({ api, lang: langProp, t: tProp }) {
  // language: if parent passes lang, follow it; still allow Hub to toggle & persist.
  const [localLang, setLocalLang] = useState(() => getStoredLang() || detectLang());
  const lang = langProp || localLang;

  const t = useMemo(() => {
    if (typeof tProp === "function") return tProp;
    if (tProp && typeof tProp === "object") return createT(tProp);
    return createT(lang === "ko" ? I18N.ko : I18N.en);
  }, [tProp, lang]);

  const hub = (lang === "ko" ? I18N.ko.hub : I18N.en.hub) ?? I18N.en.hub;

  const [open, setOpen] = useState(false);
  const [logText, setLogText] = useState("");

  const snapshot = (typeof logger.getSnapshot === "function") ? logger.getSnapshot({ max: 200 }) : { lines: [] };
  const logs = snapshot?.lines ?? [];

  const onOpenLogs = () => {
    try {
      const text = (typeof logger?.exportText === "function" ? logger.exportText() : null)
        || (logs.length ? logs.map((l) => JSON.stringify(l)).join(String.fromCharCode(10)) : "No logs available.");
      setLogText(text);
      setOpen(true);
      logger.info?.("ui.hub_open_logs", { size: text?.length ?? 0 });
    } catch (e) {
      const msg = `Failed to read logs: ${e?.message ?? String(e)}`;
      setLogText(msg);
      setOpen(true);
      logger.warn?.("ui.hub_open_logs_failed", { message: msg });
    }
  };

  const onCopyLogs = async () => {
    const text = (typeof logger?.exportText === "function" ? logger.exportText() : null)
      || (logs.length ? logs.map((l) => JSON.stringify(l)).join(String.fromCharCode(10)) : "(no logs)");
    setLogText(text);
    const ok = await copyToClipboard(text);
    logger.info?.("ui.hub_copy_logs", { ok, size: text?.length ?? 0 });
    if (!ok) alert("Copy failed.");
  };

  const buildExportText = () => {
    const daily = api?.daily ?? api?.mri?.daily ?? api?.mri?.latest?.daily ?? null;
    const intraday = api?.intraday ?? api?.mri?.intraday ?? null;
    const status = api?.status ?? api?.mri?.status ?? null;
    const calendar = api?.calendar ?? api?.mri?.calendar ?? null;

    const pack = {
      asOf: daily?.asOf ?? daily?.meta?.asOf ?? api?.asOf ?? api?.mri?.asOf ?? null,
      regime: daily?.regime ?? daily?.regime7 ?? api?.regime ?? api?.mri?.regime ?? null,
      score: daily?.score ?? api?.score ?? api?.mri?.score ?? null,
      confidence: daily?.Cfinal ?? null,
      topScenario: daily?.topK ?? null,
      probs: daily?.probs ?? null,
      tags: daily?.tags ?? null,
      V: daily?.V ?? null,
      corrAvg: daily?.corrAvgDaily ?? null,
      status,
      intraday: intraday ? {
        zShort: intraday?.zShort ?? null,
        corrAvg: intraday?.corrAvg ?? null,
        corrSurge: intraday?.corrSurge ?? null,
        updatedAt: intraday?.meta?.asOf ?? intraday?.asOf ?? null,
      } : null,
      calendar: calendar?.events ?? [],
      meta: daily?.meta ?? null,
    };

    return [
      "MRI EXPORT",
      `asOf=${pack.asOf ?? "--"}`,
      `regime=${pack.regime ?? "--"}`,
      `score=${pack.score != null ? JSON.stringify(pack.score) : "--"}`,
      `confidence=${pack.confidence != null ? String(pack.confidence) : "--"}`,
      "",
      JSON.stringify(pack, null, 2),
      "",
    ].join(String.fromCharCode(10));
  };

  const onCopyExport = async () => {
    const text = buildExportText();
    const ok = await copyToClipboard(text);
    logger.info?.("ui.hub_copy_export", { ok, size: text?.length ?? 0 });
    if (!ok) alert("Copy failed.");
  };

  const toggleLang = () => {
    const next = (lang === "ko") ? "en" : "ko";
    setStoredLang(next);
    setLocalLang(next);
    try { window.dispatchEvent(new Event("mri_lang_changed")); } catch {}
    logger.info?.("ui.lang_set", { lang: next });
  };

  return (
    <div className="px-4 pt-20 pb-24">
      <div className="flex items-center justify-end gap-2 mb-3">
        <Pill tone="blue" onClick={toggleLang}>{lang === "ko" ? "K/E" : "E/K"}</Pill>
        <Pill tone="gray" onClick={onCopyExport}>Copy Export</Pill>
        <Pill tone="gray" onClick={onOpenLogs}>Open Logs</Pill>
        <Pill tone="gray" onClick={onCopyLogs}>Copy Logs</Pill>
      </div>

      <Card title={hub?.title ?? "MRI HUB"}>
        <div className="text-sm opacity-80">
          {(hub?.subtitle ?? "Utilities & info")}
        </div>
      </Card>

      <Card title="Diagnostics">
        <div className="text-xs opacity-80 space-y-1">
          <div>lang: <span className="opacity-90">{lang}</span></div>
          <div>daily: <span className="opacity-90">{Boolean(api?.daily ?? api?.mri?.daily) ? "ok" : "missing"}</span></div>
          <div>intraday: <span className="opacity-90">{Boolean(api?.intraday ?? api?.mri?.intraday) ? "ok" : "missing"}</span></div>
          <div>calendar: <span className="opacity-90">{Array.isArray(api?.calendar?.events) ? api.calendar.events.length : (Array.isArray(api?.mri?.calendar?.events) ? api.mri.calendar.events.length : 0)}</span></div>
          <div>logs: <span className="opacity-90">{logs.length}</span></div>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Debug Logs">
        <pre className="text-xs whitespace-pre-wrap break-words">{logText}</pre>
      </Modal>
    </div>
  );
}