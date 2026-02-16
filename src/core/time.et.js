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
  const parts = dtf.formatToParts(new Date());
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  // weekday not numeric; we’ll infer using Date in ET by reconstructing is tricky,
  // so instead: approximate weekday via local Date but shift is unsafe.
  // Better: format weekday and map.
  const weekdayStr = map.weekday; // e.g. "Mon"
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

