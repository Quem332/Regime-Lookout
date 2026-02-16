import React, { useState } from "react";

import { Modal } from "../components/Modal";
import { DebugPanel } from "../components/DebugPanel";

const DEFAULT_T = {
  hub: {
    settings: "Hub / Settings",
    refreshMock: "Refresh (mock)",
    nav: "Navigation",
    navText1: "Use the top bar to cycle pages: Daily → Score → Intraday → Hub.",
    navText2: "Tap a card to open details. Use 'Debug Logs' to copy error context.",
    about: "About",
    version: "Version",
    dataSources: "Data sources",
    disclaimer: "Disclaimer",
    discText:
      "This app is an interpretation tool (not financial advice). Data may be delayed or incomplete. Use at your own risk.",
  },
};


function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Btn({ onClick, children }) {
  return (
    <button
      data-swipe-ignore
      className="w-full rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-2 text-sm"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function PageHub({ t, lang, setLang, onRefresh, onClearCache }) {
  const [openNav, setOpenNav] = useState(false);
  const [openDisclaimer, setOpenDisclaimer] = useState(false);
  const [openData, setOpenData] = useState(false);
  const [openLogs, setOpenLogs] = useState(false);

  return (
    <div className="h-full flex flex-col gap-3">
      <Card title={t.hub.settings}>
        <div className="grid grid-cols-2 gap-2">
          <button
            data-swipe-ignore
            className={`rounded-xl border px-3 py-2 text-sm ${
              lang === "en" ? "bg-blue-500/20 border-blue-500/40" : "bg-white/5 border-white/10"
            }`}
            onClick={() => setLang("en")}
          >
            English
          </button>
          <button
            data-swipe-ignore
            className={`rounded-xl border px-3 py-2 text-sm ${
              lang === "ko" ? "bg-blue-500/20 border-blue-500/40" : "bg-white/5 border-white/10"
            }`}
            onClick={() => setLang("ko")}
          >
            한국어
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Btn onClick={onRefresh}>{t.hub.refreshMock}</Btn>
          <Btn onClick={onClearCache}>{lang === "ko" ? "캐시 삭제" : "Clear cache"}</Btn>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card title={t.hub.nav}>
          <div className="text-xs text-gray-400 leading-relaxed">
            {t.hub.navText1}
            <br />
            {t.hub.navText2}
          </div>
          <div className="mt-2">
            <Btn onClick={() => setOpenNav(true)}>{lang === "ko" ? "자세히" : "Details"}</Btn>
          </div>
        </Card>
        <Card title={t.hub.about}>
          <div className="text-xs text-gray-400 leading-relaxed">
            {t.hub.version}
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <Btn onClick={() => setOpenData(true)}>{t.hub.dataSources}</Btn>
            <Btn onClick={() => setOpenDisclaimer(true)}>{t.hub.disclaimer}</Btn>
          </div>
        </Card>
      </div>

      <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 p-3 flex flex-col">
        <div className="text-sm font-semibold">{lang === "ko" ? "로그" : "Logs"}</div>
        <div className="text-xs text-gray-400 mt-1">
          {lang === "ko"
            ? "문제 발생 시 여기 로그를 보고 원인을 추적합니다."
            : "Use logs to diagnose issues (API errors, fetch failures, swipe, etc.)."}
        </div>
        <div className="mt-3">
          <Btn onClick={() => setOpenLogs(true)}>{lang === "ko" ? "로그 열기" : "Open logs"}</Btn>
        </div>
      </div>

      {/* Modals */}
      <Modal open={openNav} onClose={() => setOpenNav(false)} title={t.hub.nav}>
        <div className="text-sm leading-relaxed text-gray-200">
          <div className="text-xs text-gray-400 mb-2">{lang === "ko" ? "제스처" : "Gestures"}</div>
          <div className="text-sm">{t.hub.navText1}</div>
          <div className="text-sm mt-1">{t.hub.navText2}</div>
        </div>
      </Modal>

      <Modal open={openData} onClose={() => setOpenData(false)} title={t.hub.dataSources}>
        <div className="text-sm leading-relaxed">
          <div className="text-gray-200">Yahoo Finance via yfinance</div>
          <div className="text-xs text-gray-400 mt-2">
            {lang === "ko"
              ? "무료 공개 데이터이며 지연/누락/일시 중단 가능성이 있습니다."
              : "Free public data; may be delayed, incomplete, or temporarily unavailable."}
          </div>
        </div>
      </Modal>

      <Modal open={openDisclaimer} onClose={() => setOpenDisclaimer(false)} title={t.hub.disclaimer}>
        <div className="text-sm leading-relaxed text-gray-200">{t.hub.discText}</div>
      </Modal>

      <Modal open={openLogs} onClose={() => setOpenLogs(false)} title={lang === "ko" ? "로그" : "Logs"}>
        <DebugPanel />
      </Modal>
    </div>
  );
}