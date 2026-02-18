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

export function PageHub({ api, t: tProp }) {
  // language (Hub-only control; persisted)
  const [lang, setLang] = useState(() => getStoredLang() || detectLang());

  // translator: accept function, dict, or fallback to built-in
  const t = useMemo(() => {
    if (typeof tProp === "function") return tProp;
    if (tProp && typeof tProp === "object") return createT(tProp);
    return createT(lang === "ko" ? I18N.ko : I18N.en);
  }, [tProp, lang]);

  const hub = (lang === "ko" ? I18N.ko.hub : I18N.en.hub) ?? I18N.en.hub;

  const [open, setOpen] = useState(false);
  const [logText, setLogText] = useState("");

  const logs = api?.logger?.getSnapshot?.({ max: 200 }) ?? null;

  const onOpenLogs = () => {
    try {
      const text = (typeof logger?.exportText === "function" ? logger.exportText() : null)
        || (logs ? JSON.stringify(logs, null, 2) : "No logs available.");
      setLogText(text);
      setOpen(true);
      logger.info("ui.hub_open_logs", { size: text?.length ?? 0 });
    } catch (e) {
      const msg = `Failed to read logs: ${e?.message ?? String(e)}`;
      setLogText(msg);
      setOpen(true);
      logger.warn("ui.hub_open_logs_failed", { message: msg });
    }
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text || "");
    } catch (e) {
      alert(`Copy failed: ${e?.message ?? String(e)}`);
    }
  };

  const onCopyLogs = async () => {
    const text = (typeof logger?.exportText === "function" ? logger.exportText() : null)
      || (logs ? JSON.stringify(logs, null, 2) : "(no logs)");
    setLogText(text);
    await copyText(text);
    logger.info("ui.hub_copy_logs", { size: text?.length ?? 0 });
  };

  const onCopyScores = async () => {
    const mri = api?.mri ?? api ?? null;
    const daily = mri?.daily ?? null;
    const status = mri?.status ?? null;

    const probs = daily?.probs && typeof daily.probs === "object" ? daily.probs : {};
    const top = Object.entries(probs)
      .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
      .sort((a, b) => b[1] - a[1])[0];

    const tagsArr = Array.isArray(daily?.tags) ? daily.tags : [];
    const tagsStr = tagsArr
      .map((x) => (typeof x === "object" ? (x?.label ?? x?.name ?? "[tag]") : String(x)))
      .join(", ");

    const lines = [
      `Regime-Lookout`,
      `SYNC: ${status?.market?.label ?? "--"}`,
      `asOf: ${daily?.meta?.asOf ?? status?.market?.asOf ?? "--"}`,
      `score: ${daily?.score != null ? Math.round(daily.score) : "--"}`,
      `Cfinal: ${daily?.Cfinal != null ? Math.round(daily.Cfinal) : "--"}`,
      `regime7: ${daily?.regime7 ?? "--"}`,
      `top: ${top ? `${top[0]} ${(top[1] * 100).toFixed(1)}%` : "--"}`,
      `corrAvg: ${fmtNum(daily?.corrAvgDaily, 2)}`,
      `V: ${Array.isArray(daily?.V) ? daily.V.map((v) => fmtNum(v, 2)).join(", ") : "--"}`,
      `tags: ${tagsStr || "--"}`,
    ];

    await copyText(lines.join("\n"));
    logger.info("ui.hub_copy_scores", { score: daily?.score ?? null, Cfinal: daily?.Cfinal ?? null, regime7: daily?.regime7 ?? null });
  };

  const setLangSafe = (next) => {
    const v = next === "ko" ? "ko" : "en";
    setLang(v);
    setStoredLang(v);
    try {
      window.dispatchEvent(new CustomEvent("mri_lang_changed", { detail: v }));
    } catch {}
    logger.info("ui.lang_set", { lang: v });
  };

  return (
    <div className="px-4 pt-20 pb-6" style={{ touchAction: "pan-y" }}>
      <div className="flex items-center justify-end gap-2 mb-3">
        {/* Hub controls (no duplicate title; top bar already shows HUB) */}
        <Pill data-stop-toggle="1" onClick={(e) => { e.stopPropagation(); setLangSafe("en"); }}>EN</Pill>
        <Pill data-stop-toggle="1" onClick={(e) => { e.stopPropagation(); setLangSafe("ko"); }}>KR</Pill>
        <Pill data-stop-toggle="1" onClick={(e) => { e.stopPropagation(); onCopyScores(); }}>Copy Scores</Pill>
      </div>


      <div className="grid gap-3">
        <Card title={hub?.diagnosticsTitle ?? "Diagnostics"} subtitle={hub?.diagnosticsSub ?? "Quick health checks"}>
          {(() => {
            const mri = api?.mri ?? api ?? null;
            const daily = mri?.daily ?? null;
            const intraday = mri?.intraday ?? null;
            const status = mri?.status ?? null;
            const health = status?.health ?? null;
            const schemaOk = daily?.meta?.schema?.ok ?? health?.schema?.ok ?? null;
            const got = daily?.meta?.schema?.got ?? health?.schema?.got ?? null;
            const expected = daily?.meta?.schema?.expected ?? health?.schema?.expected ?? null;
            const rows = [
              { k: "daily", v: !!daily },
              { k: "intraday", v: !!intraday },
              { k: "calendar", v: Array.isArray(status?.events) ? status.events.length : null },
              { k: "schema", v: schemaOk, extra: schemaOk === false ? `expected ${expected}, got ${got}` : (expected ? `v${expected}` : "") },
              { k: "lastError", v: health?.lastError ? String(health.lastError) : "" },
            ];
            return (
              <div className="space-y-1 text-xs text-white/80">
                {rows.map((r) => (
                  <div key={r.k} className="flex items-center justify-between">
                    <div className="opacity-80">{r.k}</div>
                    <div className="text-right">
                      {r.k === "calendar"
                        ? (r.v == null ? "--" : `${r.v}`)
                        : (typeof r.v === "boolean" ? (r.v ? "OK" : "FAIL") : (r.v ? String(r.v) : "--"))}
                      {r.extra ? <span className="ml-2 opacity-60">{r.extra}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </Card>
</div>

      <div className="grid gap-3">
        <Card title={hub.debugTitle ?? "Debug"} subtitle={hub.debugSubtitle ?? "Logs & tools"}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Pill data-stop-toggle="1" onClick={(e) => { e.stopPropagation(); onOpenLogs(); }}>
              {hub.openLogs ?? "Open Logs"}
            </Pill>
            <Pill
              data-stop-toggle="1"
              onClick={(e) => {
                e.stopPropagation();
                try {
                  localStorage.clear();
                } catch {}
                try {
                  sessionStorage.clear();
                } catch {}
                alert(hub.cleared ?? "Cleared.");
              }}
            >
              {hub.clearLocal ?? "Clear local"}
            </Pill>
            <Pill data-stop-toggle="1" onClick={(e) => { e.stopPropagation(); onCopyLogs(); }}>
              {hub.copy ?? "Copy"}
            </Pill>
          </div>
        </Card>

        <Card title="Recent Logs" subtitle="(latest 60)">
          <div className="text-xs text-white/70 whitespace-pre-wrap break-words" style={{ maxHeight: 220, overflow: "auto" }}>
            {(() => {
              const snap = (typeof logger?.getSnapshot === "function" && logger.getSnapshot()) || logs || null;
              const lines = snap?.lines || [];
              return lines.slice(-60).join("\n");
            })()}
          </div>
        </Card>

        <Card title={hub.aboutTitle ?? "About"} subtitle={hub.aboutSubtitle ?? "Disclaimer"}>
          <div style={{ lineHeight: 1.5 }}>
            <div>{hub.aboutLine1 ?? "Informational only."}</div>
            <div style={{ marginTop: 8 }}>{hub.aboutLine2 ?? "Use at your own risk."}</div>
          </div>
        </Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={hub.logsTitle ?? "Logs"}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Pill data-stop-toggle="1" onClick={(e) => { e.stopPropagation(); copyText(logText || ""); }}>
            {hub.copy ?? "Copy"}
          </Pill>
          <Pill data-stop-toggle="1" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
            {hub.close ?? "Close"}
          </Pill>
        </div>

        <pre
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.06)",
            overflow: "auto",
            maxHeight: 380,
            fontSize: 12,
            lineHeight: 1.35,
          }}
        >
          {logText}
        </pre>
      </Modal>
    </div>
  );
}