Regime-Lookout Patch (DeX-friendly polling) — overwrite files

Included:
- src/hooks/useMRIState.js
  * Polling cadence:
    - visible: 5 min (2 min in event window)
    - hidden: 10 min (do NOT stop; DeX/split-screen friendly)
  * UI timer tick:
    - visible: 1s
    - hidden: 5s
  * visibilitychange:
    - updates tick cadence + pollMs quickly
    - refreshLatest/refreshCalendar immediately when visible

- vite.config.js
  * workbox.cleanupOutdatedCaches: true

Apply:
1) Unzip into repo root (overwrite)
2) npm run build
3) git add src/hooks/useMRIState.js vite.config.js
   git commit -m "DeX-friendly polling cadence + SW cache cleanup"
   git push

After deploy, if you still see old behavior:
- Unregister Service Worker + Clear site data once.