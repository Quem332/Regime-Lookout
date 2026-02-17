import React, { useMemo, useState } from "react";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { Modal } from "../components/Modal";
import { logger } from "../../core/logger";
import { I18N } from "../../core/i18n";

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
  // fallback: if parent doesn't pass t
  const lang = detectLang();
  const t = useMemo(() => {
    const base = tProp ?? (lang === "ko" ? I18N.ko : I18N.en);
    return { ...base, hub: base?.hub ?? I18N.en.hub };
  }, [tProp, lang]);

  const hub = t.hub;

  const [open, setOpen] = useState(false);
  const [logText, setLogText] = useState("");

  const logs = api?.logger?.getSnapshot?.() ?? null;

  const onOpenLogs = () => {
    try {
      const snap =
        (typeof logger?.getSnapshot === "function" && logger.getSnapshot()) ||
        logs ||
        null;
      const text = snap != null ? JSON.stringify(snap, null, 2) : "No logs available.";
      setLogText(text);
      setOpen(true);
    } catch (e) {
      setLogText(`Failed to read logs: ${e?.message ?? String(e)}`);
      setOpen(true);
    }
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text || "");
    } catch (e) {
      alert(`Copy failed: ${e?.message ?? String(e)}`);
    }
  };

  const copyLogs = async () => copyText(logText || "");

  // NEW: copy the current score pack (corner button request)
  const onCopyScores = async () => {
    const daily = api?.mri?.daily ?? null;
    const status = api?.mri?.status ?? null;

    const probs = daily?.probs && typeof daily.probs === "object" ? daily.probs : {};
    const top = Object.entries(probs)
      .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
      .sort((a, b) => b[1] - a[1])[0];

    const lines = [
      `Regime-Lookout`,
      `SYNC: ${status?.market?.label ?? "--"}`,
      `asOf: ${daily?.meta?.asOf ?? daily?.meta?.asOfStr ?? daily?.meta?.asOf ?? status?.market?.asOf ?? "--"}`,
      `score: ${daily?.score != null ? Math.round(daily.score) : "--"}`,
      `Cfinal: ${daily?.Cfinal != null ? Math.round(daily.Cfinal) : "--"}`,
      `regime7: ${daily?.regime7 ?? "--"}`,
      `top: ${top ? `${top[0]} ${(top[1] * 100).toFixed(1)}%` : "--"}`,
      `corrAvg: ${fmtNum(daily?.corrAvgDaily, 2)}`,
      `V: ${Array.isArray(daily?.V) ? daily.V.map((v) => fmtNum(v, 2)).join(", ") : "--"}`,
      `tags: ${Array.isArray(daily?.tags) ? daily.tags.join(", ") : "--"}`,
    ];

    await copyText(lines.join("\n"));
  };

  return (
    <div className="px-4 pb-6" style={{ touchAction: "pan-y" }}>
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-xl font-bold tracking-tight text-white">MRI HUB</div>
          <div className="text-sm text-white/70">Utilities &amp; info</div>
        </div>

        {/* corner copy button */}
        <Pill data-stop-toggle="1" onClick={(e)=>{ e.stopPropagation(); onCopyScores(); }}>Copy Scores</Pill>
      </div>

      <div className="grid gap-3">
        <Card title={hub.debugTitle} subtitle={hub.debugSubtitle}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Pill onClick={onOpenLogs}>{hub.openLogs}</Pill>
            <Pill
              onClick={() => {
                try { localStorage.clear(); } catch {}
                try { sessionStorage.clear(); } catch {}
                alert(hub.cleared);
              }}
            >
              {hub.clearLocal}
            </Pill>
          </div>
        </Card>

        <Card title={hub.aboutTitle} subtitle={hub.aboutSubtitle}>
          <div style={{ lineHeight: 1.5 }}>
            <div>{hub.aboutLine1}</div>
            <div style={{ marginTop: 8 }}>{hub.aboutLine2}</div>
          </div>
        </Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={hub.logsTitle}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Pill onClick={copyLogs}>{hub.copy}</Pill>
          <Pill onClick={() => setOpen(false)}>{hub.close}</Pill>
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
