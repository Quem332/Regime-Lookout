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

function safeHubDict(baseMaybe) {
  // Some parts of the app used `t` as a function in older builds.
  // If someone passes a function here, ignore it and fall back to our dictionaries.
  const baseObj =
    baseMaybe && typeof baseMaybe === "object" && !Array.isArray(baseMaybe) ? baseMaybe : null;

  const fallback = I18N?.en?.hub || {};
  const hub = (baseObj?.hub && typeof baseObj.hub === "object") ? baseObj.hub : null;

  // Provide stable keys used by this UI (prevents runtime crashes on missing i18n keys)
  return {
    title: hub?.title ?? fallback?.title ?? "Hub",
    subtitle: hub?.subtitle ?? fallback?.subtitle ?? "Utilities & info",
    debugTitle: hub?.debugTitle ?? fallback?.debugTitle ?? "Debug",
    debugSubtitle: hub?.debugSubtitle ?? fallback?.debugSubtitle ?? "Logs / reset local cache",
    openLogs: hub?.openLogs ?? fallback?.openLogs ?? "Open logs",
    clearLocal: hub?.clearLocal ?? fallback?.clearLocal ?? "Clear local storage",
    cleared: hub?.cleared ?? fallback?.cleared ?? "Cleared.",
    aboutTitle: hub?.aboutTitle ?? fallback?.aboutTitle ?? "About",
    aboutSubtitle: hub?.aboutSubtitle ?? fallback?.aboutSubtitle ?? "What this app is",
    aboutLine1: hub?.aboutLine1 ?? fallback?.aboutLine1 ?? "Regime-Lookout is a market regime interpretation dashboard.",
    aboutLine2: hub?.aboutLine2 ?? fallback?.aboutLine2 ?? "It is not financial advice and does not recommend trades.",
    logsTitle: hub?.logsTitle ?? fallback?.logsTitle ?? "Debug logs",
    copy: hub?.copy ?? fallback?.copy ?? "Copy",
    close: hub?.close ?? fallback?.close ?? "Close",
  };
}

export function PageHub({ api, t: tProp }) {
  const lang = detectLang();

  const baseDict = useMemo(() => {
    // If parent passes a dict, use it. Otherwise select by language.
    const picked = lang === "ko" ? I18N?.ko : I18N?.en;
    return (tProp && typeof tProp === "object") ? tProp : picked;
  }, [tProp, lang]);

  const hub = useMemo(() => safeHubDict(baseDict), [baseDict]);

  const [open, setOpen] = useState(false);
  const [logText, setLogText] = useState("");

  // NOTE: optional-call (?.()) only guards null/undefined, not "callable".
  // If a bundler or a prop mistake turns getSnapshot into a non-function, it would crash with
  // "... is not a function". So we hard-guard callability here.
  const logsFromApi =
    typeof api?.logger?.getSnapshot === "function" ? api.logger.getSnapshot() : null;

  const onOpenLogs = () => {
    try {
      const snap =
        (typeof logger?.getSnapshot === "function" && logger.getSnapshot()) ||
        logsFromApi ||
        null;

      const text = snap != null ? JSON.stringify(snap, null, 2) : "No logs available.";
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
        <Card>
          <div className="cardTitle">{hub.debugTitle}</div>
          <div className="cardSubtitle">{hub.debugSubtitle}</div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
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

        <Card>
          <div className="cardTitle">{hub.aboutTitle}</div>
          <div className="cardSubtitle">{hub.aboutSubtitle}</div>

          <div style={{ lineHeight: 1.5, marginTop: 12 }}>
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
