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

export function PageHub({ api, t: tProp }) {
  // ✅ fallback: MRIMarketDashboard가 t를 안 넘겨도 PageHub가 자체 선택
  const lang = detectLang();
  const t = useMemo(() => {
    const base = tProp ?? (lang === "ko" ? I18N.ko : I18N.en);
    // hub 누락 방어
    return {
      ...base,
      hub: base?.hub ?? I18N.en.hub,
    };
  }, [tProp, lang]);

  const hub = t.hub;

  const [open, setOpen] = useState(false);
  const [logText, setLogText] = useState("");

  const logs = api?.logger?.getSnapshot?.() ?? null;

  const onOpenLogs = () => {
    try {
      // logger가 없거나 형태가 달라도 안전하게 문자열 생성
      const snap =
        (typeof logger?.getSnapshot === "function" && logger.getSnapshot()) ||
        logs ||
        null;

      const text =
        snap != null ? JSON.stringify(snap, null, 2) : "No logs available.";
      setLogText(text);
      setOpen(true);
    } catch (e) {
      setLogText(`Failed to read logs: ${e?.message ?? String(e)}`);
      setOpen(true);
    }
  };

  const copyLogs = async () => {
    try {
      await navigator.clipboard.writeText(logText || "");
    } catch (e) {
      alert(`Copy failed: ${e?.message ?? String(e)}`);
    }
  };

  return (
    <div className="page">
      <div className="pageHeader">
        <div className="pageTitle">{hub.title}</div>
        <div className="pageSubtitle">{hub.subtitle}</div>
      </div>

      <div className="grid">
        <Card title={hub.debugTitle} subtitle={hub.debugSubtitle}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Pill onClick={onOpenLogs}>{hub.openLogs}</Pill>
            <Pill
              onClick={() => {
                try {
                  localStorage.clear();
                } catch {}
                try {
                  sessionStorage.clear();
                } catch {}
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
