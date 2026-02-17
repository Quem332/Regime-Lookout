export function getETNowParts() {
  // DST-safe: use Intl timeZone
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const now = new Date();

  // Some WebViews / older engines expose Intl but not `formatToParts`.
  // Use formatToParts when available; otherwise fall back to parsing `format()`.
  let map = null;
  try {
    if (typeof dtf.formatToParts === "function") {
      const parts = dtf.formatToParts(now);
      map = {};
      for (const p of parts) map[p.type] = p.value;
    }
  } catch {
    map = null;
  }

  if (!map) {
    // Example output (en-US): "Mon, 02/17/2026, 13:45"
    // Parse defensively.
    const s = String(dtf.format(now));
    const m = s.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat).*?(\d{2})\/(\d{2})\/(\d{4}).*?(\d{2}):(\d{2})/);
    const weekdayStr = m?.[1] ?? "Sun";
    const mo = Number(m?.[2] ?? 1);
    const d = Number(m?.[3] ?? 1);
    const y = Number(m?.[4] ?? 1970);
    const hh = Number(m?.[5] ?? 0);
    const mm = Number(m?.[6] ?? 0);
    const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { y, mo, d, hh, mm, dow: weekdayMap[weekdayStr] ?? 0 };
  }

  const weekdayStr = map.weekday;
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = weekdayMap[weekdayStr] ?? 0;

  return {
    y: Number(map.year),
    mo: Number(map.month),
    d: Number(map.day),
    hh: Number(map.hour),
    mm: Number(map.minute),
    dow: dayOfWeek,
  };
}

export function isMarketOpenET() {
  const { dow, hh, mm } = getETNowParts();
  const isWeekday = dow >= 1 && dow <= 5;
  const minutes = hh * 60 + mm;
  const open = 9 * 60 + 30; // 09:30
  const close = 16 * 60; // 16:00
  // Spec: regular trading hours; holidays can be added later
  return isWeekday && minutes >= open && minutes < close;
}

export function getMarketStatusLabel({ marketOpen, lang }) {
  if (lang === "ko") return marketOpen ? "열림" : "닫힘";
  return marketOpen ? "OPEN" : "CLOSED";
}

function fmtDuration(mins, lang) {
  const m = Math.max(0, Math.floor(mins));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (lang === "ko") {
    if (h <= 0) return `${r}분`;
    return `${h}시간 ${r}분`;
  }
  if (h <= 0) return `${r}m`;
  return `${h}h ${r}m`;
}

// Spec v2.3: simple time check (weekends only). Holidays can be added later.
// Returns:
// - if open: "{X} left" / "{X} 남음"
// - if closed: "opens in {X}" / "{X} 후 개장"
export function getMarketCountdownLabel(lang = "en") {
  const { dow, hh, mm } = getETNowParts();
  const minutes = hh * 60 + mm;
  const openM = 9 * 60 + 30;
  const closeM = 16 * 60;

  const isWeekday = dow >= 1 && dow <= 5;
  const isOpen = isWeekday && minutes >= openM && minutes < closeM;

  if (isOpen) {
    const left = closeM - minutes;
    return lang === "ko" ? `${fmtDuration(left, lang)} 남음` : `${fmtDuration(left, lang)} left`;
  }

  // Closed: compute minutes until next open (weekends only)
  let daysToAdd = 0;
  if (!isWeekday) {
    // Sat(6) -> +2 days, Sun(0) -> +1 day
    daysToAdd = dow === 6 ? 2 : 1;
  } else {
    // Weekday but outside hours
    if (minutes < openM) {
      daysToAdd = 0;
    } else {
      // after close -> next weekday (Fri -> Mon)
      daysToAdd = dow === 5 ? 3 : 1;
    }
  }

  const minutesToNextDay = (24 * 60 - minutes) % (24 * 60);
  const minsUntilOpen = daysToAdd === 0
    ? (openM - minutes)
    : minutesToNextDay + (daysToAdd - 1) * 24 * 60 + openM;

  return lang === "ko" ? `${fmtDuration(minsUntilOpen, lang)} 후 개장` : `opens in ${fmtDuration(minsUntilOpen, lang)}`;
}

