import React, { useEffect, useMemo, useState } from "react";
import { logger } from "../../core/logger";

/**
 * PWA install UX helper.
 * - Android/Chromium: uses beforeinstallprompt to show an Install button.
 * - iOS/Safari: cannot prompt install; shows a short instruction.
 *
 * This is intentionally small and dismissible. It is not required for the app to function.
 */
function isIOS() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  // iOS Safari uses navigator.standalone
  // Other browsers use display-mode media query
  const nav = window.navigator;
  return Boolean(nav.standalone) || window.matchMedia?.("(display-mode: standalone)")?.matches;
}

export function InstallBanner({ lang = "en" }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const copy = useMemo(() => {
    const en = {
      title: "Install as an app",
      bodyAndroid: "Add this dashboard to your home screen for faster access.",
      bodyIOS: "Open in Safari → Share → Add to Home Screen.",
      install: "Install",
      close: "Dismiss",
    };
    const ko = {
      title: "앱처럼 설치",
      bodyAndroid: "홈 화면에 추가하면 앱처럼 빠르게 열 수 있어요.",
      bodyIOS: "Safari에서 열기 → 공유 → 홈 화면에 추가.",
      install: "설치",
      close: "닫기",
    };
    return lang === "ko" ? ko : en;
  }, [lang]);

  // Hide banner if recently dismissed
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mri_install_banner_dismissed_at");
      if (!raw) return;
      const t = Number(raw);
      if (!Number.isFinite(t)) return;
      const days7 = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - t < days7) setDismissed(true);
    } catch {
      // ignore
    }
  }, []);

  // Capture beforeinstallprompt on Android/Chromium
  useEffect(() => {
    const handler = (e) => {
      // Prevent mini-infobar
      e.preventDefault?.();
      setDeferredPrompt(e);
      logger.info("pwa.beforeinstallprompt_captured");
    };
    window.addEventListener?.("beforeinstallprompt", handler);
    return () => window.removeEventListener?.("beforeinstallprompt", handler);
  }, []);

  // Don't show if already installed / standalone
  if (dismissed || isStandalone()) return null;

  const showIOS = isIOS() && !deferredPrompt;
  const showAndroid = Boolean(deferredPrompt);

  if (!showIOS && !showAndroid) {
    // No install path detected; stay quiet.
    return null;
  }

  const onDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem("mri_install_banner_dismissed_at", String(Date.now()));
    } catch {
      // ignore
    }
    logger.info("pwa.banner_dismissed");
  };

  const onInstall = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt?.();
      const res = await deferredPrompt.userChoice;
      logger.info("pwa.install_choice", { outcome: res?.outcome || null });
    } catch (e) {
      logger.warn("pwa.install_failed", { message: e?.message });
    } finally {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="mb-3">
      <div className="rounded-xl border border-gray-700 bg-gray-900/60 px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{copy.title}</div>
            <div className="text-xs text-gray-300 mt-0.5">
              {showAndroid ? copy.bodyAndroid : copy.bodyIOS}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showAndroid && (
              <button
                onClick={onInstall}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30"
              >
                {copy.install}
              </button>
            )}
            <button
              onClick={onDismiss}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 border border-gray-700"
            >
              {copy.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
